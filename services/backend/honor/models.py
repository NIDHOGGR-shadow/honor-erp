from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    JSON,
    MetaData,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def uid():
    return str(uuid4())


def now():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    metadata = MetaData(schema="honor")


class Company(Base):
    __tablename__ = "companies"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    currency: Mapped[str] = mapped_column(String(3))
    timezone: Mapped[str] = mapped_column(String(80), default="UTC")


class Identity(Base):
    __tablename__ = "identities"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str | None] = mapped_column(Text)


class LoginSession(Base):
    __tablename__ = "login_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("identities.id"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    provider_tokens: Mapped[str | None] = mapped_column(Text)
    mfa: Mapped[bool] = mapped_column(Boolean, default=False)


class Membership(Base):
    __tablename__ = "memberships"
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("identities.id"), primary_key=True)
    role: Mapped[str] = mapped_column(String(16))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (CheckConstraint("role IN ('ADMIN','MANAGER','STOCK','SALES')", name="valid_role"),)


class CompanySessionBlock(Base):
    __tablename__ = "company_session_blocks"
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("login_sessions.id"), primary_key=True)


class Location(Base):
    __tablename__ = "locations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    address: Mapped[str] = mapped_column(String(300), default="")
    fulfil_online: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (UniqueConstraint("company_id", "id"), UniqueConstraint("company_id", "name"))


class LocationGrant(Base):
    __tablename__ = "location_grants"
    company_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    location_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    __table_args__ = (
        ForeignKeyConstraint(["company_id", "user_id"], ["memberships.company_id", "memberships.user_id"]),
        ForeignKeyConstraint(["company_id", "location_id"], ["locations.company_id", "locations.id"]),
    )


class Product(Base):
    __tablename__ = "products"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    sku: Mapped[str] = mapped_column(String(80))
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(80), default="General")
    tracking: Mapped[str] = mapped_column(String(16), default="QUANTITY")
    price_minor: Mapped[int] = mapped_column(Integer)
    cost_minor: Mapped[int] = mapped_column(Integer, default=0)
    reorder_point: Mapped[int] = mapped_column(Integer, default=5)
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    image_url: Mapped[str] = mapped_column(Text, default="")
    __table_args__ = (
        UniqueConstraint("company_id", "id"),
        UniqueConstraint("company_id", "sku"),
        CheckConstraint("price_minor >= 0 AND cost_minor >= 0 AND reorder_point >= 0", name="valid_prices"),
        CheckConstraint("tracking IN ('QUANTITY','SERIAL')", name="valid_tracking"),
    )


class Balance(Base):
    __tablename__ = "stock_balances"
    company_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    product_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    location_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    on_hand: Mapped[int] = mapped_column(Integer, default=0)
    reserved: Mapped[int] = mapped_column(Integer, default=0)
    __table_args__ = (
        ForeignKeyConstraint(["company_id", "product_id"], ["products.company_id", "products.id"]),
        ForeignKeyConstraint(["company_id", "location_id"], ["locations.company_id", "locations.id"]),
        CheckConstraint("on_hand >= 0 AND reserved >= 0 AND reserved <= on_hand", name="valid_balance"),
    )


class SerialUnit(Base):
    __tablename__ = "serial_units"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    company_id: Mapped[str] = mapped_column(String(36), index=True)
    product_id: Mapped[str] = mapped_column(String(36))
    location_id: Mapped[str] = mapped_column(String(36))
    serial: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="AVAILABLE")
    order_id: Mapped[str | None] = mapped_column(String(36), index=True)
    __table_args__ = (
        ForeignKeyConstraint(["company_id", "product_id"], ["products.company_id", "products.id"]),
        ForeignKeyConstraint(["company_id", "location_id"], ["locations.company_id", "locations.id"]),
        UniqueConstraint("company_id", "serial"),
        ForeignKeyConstraint(["company_id", "order_id"], ["orders.company_id", "orders.id"]),
        CheckConstraint(
            "status IN ('AVAILABLE','RESERVED','SOLD','QUARANTINE','IN_TRANSIT')", name="valid_serial_status"
        ),
    )


class Command(Base):
    __tablename__ = "commands"
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), primary_key=True)
    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(64))
    result: Mapped[dict | None] = mapped_column(JSON)


class Movement(Base):
    __tablename__ = "stock_movements"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    company_id: Mapped[str] = mapped_column(String(36), index=True)
    product_id: Mapped[str] = mapped_column(String(36))
    location_id: Mapped[str] = mapped_column(String(36))
    delta: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(24))
    reference: Mapped[str] = mapped_column(String(128))
    actor_id: Mapped[str] = mapped_column(String(36))
    reason: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        ForeignKeyConstraint(["company_id", "product_id"], ["products.company_id", "products.id"]),
        ForeignKeyConstraint(["company_id", "location_id"], ["locations.company_id", "locations.id"]),
        CheckConstraint("delta <> 0", name="nonzero_movement"),
        Index("movement_lookup", "company_id", "created_at"),
    )


class Audit(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    actor_id: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(80))
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Invitation(Base):
    __tablename__ = "invitations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    email: Mapped[str] = mapped_column(String(254))
    role: Mapped[str] = mapped_column(String(16))
    locations: Mapped[list] = mapped_column(JSON)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    accepted: Mapped[bool] = mapped_column(Boolean, default=False)


class Order(Base):
    __tablename__ = "orders"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("identities.id"), index=True)
    location_id: Mapped[str] = mapped_column(String(36))
    customer_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254))
    access_hash: Mapped[str] = mapped_column(String(64))
    total_minor: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3))
    payment_status: Mapped[str] = mapped_column(String(24), default="UNPAID")
    status: Mapped[str] = mapped_column(String(24), default="RESERVED")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        UniqueConstraint("company_id", "id"),
        ForeignKeyConstraint(["company_id", "location_id"], ["locations.company_id", "locations.id"]),
        CheckConstraint("total_minor >= 0", name="valid_order_total"),
    )


class OrderLine(Base):
    __tablename__ = "order_lines"
    order_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    product_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(36))
    name: Mapped[str] = mapped_column(String(160))
    quantity: Mapped[int] = mapped_column(Integer)
    price_minor: Mapped[int] = mapped_column(Integer)
    returned_quantity: Mapped[int] = mapped_column(Integer, default=0)
    __table_args__ = (
        ForeignKeyConstraint(["company_id", "order_id"], ["orders.company_id", "orders.id"]),
        ForeignKeyConstraint(["company_id", "product_id"], ["products.company_id", "products.id"]),
        CheckConstraint(
            "quantity > 0 AND price_minor >= 0 AND returned_quantity >= 0 AND returned_quantity <= quantity",
            name="valid_order_line",
        ),
    )


class PaymentAttempt(Base):
    __tablename__ = "payment_attempts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), unique=True)
    provider: Mapped[str] = mapped_column(String(20))
    reference: Mapped[str] = mapped_column(String(160), unique=True)
    checkout_url: Mapped[str | None] = mapped_column(Text)
    paid_reference: Mapped[str | None] = mapped_column(String(160), unique=True)
    provider_id: Mapped[str | None] = mapped_column(String(160))


class ProviderEvent(Base):
    __tablename__ = "provider_events"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    provider: Mapped[str] = mapped_column(String(20))
    payload: Mapped[dict] = mapped_column(JSON)
    processed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Outbox(Base):
    __tablename__ = "outbox"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    kind: Mapped[str] = mapped_column(String(40))
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(12), default="PENDING")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(String(160))


class RateWindow(Base):
    __tablename__ = "rate_windows"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    hits: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Transfer(Base):
    __tablename__ = "transfers"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    company_id: Mapped[str] = mapped_column(String(36), index=True)
    product_id: Mapped[str] = mapped_column(String(36))
    source_id: Mapped[str] = mapped_column(String(36))
    destination_id: Mapped[str] = mapped_column(String(36))
    quantity: Mapped[int] = mapped_column(Integer)
    serial_ids: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="DISPATCHED")
    reason: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        ForeignKeyConstraint(["company_id", "product_id"], ["products.company_id", "products.id"]),
        ForeignKeyConstraint(["company_id", "source_id"], ["locations.company_id", "locations.id"]),
        ForeignKeyConstraint(["company_id", "destination_id"], ["locations.company_id", "locations.id"]),
        CheckConstraint("quantity > 0 AND source_id <> destination_id", name="valid_transfer"),
    )
