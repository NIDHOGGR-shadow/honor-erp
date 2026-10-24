from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Login(Input):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: str = Field(min_length=1, max_length=256)


class Registration(Login):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("password")
    @classmethod
    def long_password(cls, value):
        if len(value) < 12:
            raise ValueError("Use at least 12 characters")
        return value


class PasswordChange(Input):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=12, max_length=256)


class EmailChange(Input):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    current_password: str = Field(min_length=1, max_length=256)


class InvitationActivation(Registration):
    token: str = Field(min_length=32, max_length=200)


class Recovery(Input):
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class RecoveryPassword(Input):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    token_hash: str = Field(min_length=20, max_length=500)
    new_password: str = Field(min_length=12, max_length=256)


class CompanyInput(Input):
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=3, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    timezone: str = Field(default="UTC", max_length=80)

    @field_validator("currency")
    @classmethod
    def supported_currency(cls, value):
        if value not in {"NGN", "USD", "GBP", "EUR", "GHS", "ZAR", "KES"}:
            raise ValueError("Choose a supported currency with two decimal minor units")
        return value

    @field_validator("timezone")
    @classmethod
    def timezone_exists(cls, value):
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError:
            raise ValueError("Use an IANA timezone") from None
        return value


class LocationInput(Input):
    name: str = Field(min_length=2, max_length=100)
    address: str = Field(default="", max_length=300)
    fulfil_online: bool = False

    @model_validator(mode="after")
    def collection_address(self):
        if self.fulfil_online and len(self.address) < 5:
            raise ValueError("Give customers a collection address")
        return self


class ProductInput(Input):
    sku: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=3000)
    category: str = Field(default="General", max_length=80)
    tracking: Literal["QUANTITY", "SERIAL"] = "QUANTITY"
    price_minor: int = Field(strict=True, ge=0, le=2_000_000_000)
    cost_minor: int = Field(default=0, strict=True, ge=0, le=2_000_000_000)
    reorder_point: int = Field(default=5, strict=True, ge=0, le=1_000_000)
    published: bool = False
    image_url: str = Field(default="", max_length=2000)

    @field_validator("image_url")
    @classmethod
    def safe_image(cls, value):
        if value and not value.startswith("https://"):
            raise ValueError("Product images must use HTTPS")
        return value


class StockInput(Input):
    product_id: str = Field(min_length=1, max_length=36)
    location_id: str = Field(min_length=1, max_length=36)
    quantity: int = Field(strict=True, ge=1, le=1_000_000)
    serials: list[str] = Field(default_factory=list, max_length=1000)
    reason: str = Field(min_length=3, max_length=300)

    @field_validator("serials")
    @classmethod
    def clean_serials(cls, value):
        if any(not s.strip() or len(s.strip()) > 100 for s in value):
            raise ValueError("Serials must contain 1–100 characters")
        return [s.strip() for s in value]


class TransferInput(StockInput):
    destination_id: str = Field(min_length=1, max_length=36)


class MemberInput(Input):
    role: Literal["ADMIN", "MANAGER", "STOCK", "SALES"]
    active: bool = True
    location_ids: list[str] = Field(default_factory=list, max_length=100)


class InviteInput(MemberInput):
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class StaffAccount(InviteInput):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    name: str = Field(min_length=1, max_length=120)
    temporary_password: str = Field(min_length=12, max_length=256)


class AcceptInvite(Input):
    token: str = Field(min_length=32, max_length=200)


class CheckoutLine(Input):
    product_id: str = Field(min_length=1, max_length=36)
    quantity: int = Field(strict=True, ge=1, le=100)


class Checkout(Input):
    customer_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    client_token: str = Field(min_length=32, max_length=128)
    lines: list[CheckoutLine] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def no_duplicate_lines(self):
        if len({line.product_id for line in self.lines}) != len(self.lines):
            raise ValueError("Combine duplicate product lines")
        return self


class ReturnInput(StockInput):
    restock: bool = True


class FulfilLine(Input):
    product_id: str = Field(min_length=1, max_length=36)
    serials: list[str] = Field(min_length=1, max_length=100)

    @field_validator("serials")
    @classmethod
    def clean_serials(cls, value):
        cleaned = [x.strip() for x in value]
        if any(not x or len(x) > 100 for x in cleaned) or len(set(cleaned)) != len(cleaned):
            raise ValueError("Scan one unique serial / IMEI for each device")
        return cleaned


class FulfilInput(Input):
    devices: list[FulfilLine] = Field(default_factory=list, max_length=50)

    @model_validator(mode="after")
    def unique_products(self):
        if len({x.product_id for x in self.devices}) != len(self.devices):
            raise ValueError("Combine device scans for the same product")
        return self


class AdjustmentInput(Input):
    product_id: str = Field(min_length=1, max_length=36)
    location_id: str = Field(min_length=1, max_length=36)
    delta: int = Field(strict=True, ge=-1_000_000, le=1_000_000)
    reason: str = Field(min_length=5, max_length=300)

    @field_validator("delta")
    @classmethod
    def nonzero(cls, value):
        if value == 0:
            raise ValueError("Adjustment must change the quantity")
        return value


class MfaCode(Input):
    factor_id: str = Field(max_length=80)
    code: str = Field(pattern=r"^\d{6}$")
