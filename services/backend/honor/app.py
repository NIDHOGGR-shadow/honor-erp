import json
import secrets
import time
from datetime import timedelta
from pathlib import Path
from typing import Annotated
from urllib.parse import urlencode

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from . import inventory, payments, receipts, schemas as S
from .accounts import notify_account_change, sync_verified_email
from .config import get_settings
from .db import database, session
from .logging import logger
from .models import (
    Audit,
    Balance,
    Company,
    CompanySessionBlock,
    Identity,
    Invitation,
    Location,
    LocationGrant,
    LoginSession,
    Membership,
    Movement,
    Order,
    OrderLine,
    PaymentAttempt,
    Outbox,
    Product,
    RateWindow,
    SerialUnit,
    Transfer,
    now,
    uid,
)
from .security import (
    COOKIE,
    admin_create_identity,
    Scope,
    aware,
    cipher,
    current,
    digest,
    hasher,
    identify,
    provider_call,
    provider_tokens,
    start_session,
    verified_user,
)

Db = Annotated[Session, Depends(session)]
Key = Annotated[str | None, Header(alias="Idempotency-Key")]
log = logger("honor.api")


def company_json(company):
    return {
        "id": company.id,
        "name": company.name,
        "slug": company.slug,
        "currency": company.currency,
        "timezone": company.timezone,
    }


def receipt_response(db, order):
    content = receipts.receipt_pdf(receipts.receipt_data(db, order))
    return Response(
        content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="honor-receipt-{order.id}.pdf"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


def product_json(product, costs=False):
    result = {
        k: getattr(product, k)
        for k in (
            "id",
            "sku",
            "name",
            "description",
            "category",
            "tracking",
            "price_minor",
            "reorder_point",
            "published",
            "image_url",
        )
    }
    if costs:
        result["cost_minor"] = product.cost_minor
    return result


def order_json(db, order, staff=False):
    result = {
        k: getattr(order, k)
        for k in ("id", "customer_name", "total_minor", "currency", "payment_status", "status")
    }
    result.update(
        expires_at=order.expires_at.isoformat(),
        created_at=order.created_at.isoformat(),
        lines=[
            {
                "product_id": x.product_id,
                "name": x.name,
                "quantity": x.quantity,
                "price_minor": x.price_minor,
                "returned_quantity": x.returned_quantity,
                "sku": x.sku,
                "serials": x.serials if order.status == "FULFILLED" else [],
            }
            for x in inventory.lines(db, order)
        ],
    )
    collection = db.get(Location, order.location_id)
    result["receipt_ready"] = bool(
        db.scalar(
            select(PaymentAttempt.id).where(
                PaymentAttempt.order_id == order.id, PaymentAttempt.paid_reference.is_not(None)
            )
        )
    )
    result["paid_at"] = order.paid_at.isoformat() if order.paid_at else None
    result["fulfilled_at"] = order.fulfilled_at.isoformat() if order.fulfilled_at else None
    result["collection_location"] = {"name": collection.name, "address": collection.address}
    if staff:
        result.update(location_id=order.location_id, email=order.email)
        result["serials"] = [
            {"product_id": x.product_id, "serial": x.serial, "status": x.status}
            for x in db.scalars(
                select(SerialUnit).where(
                    SerialUnit.company_id == order.company_id, SerialUnit.order_id == order.id
                )
            )
        ]
    return result


def scope_query(query, cls, scope, field="location_id"):
    query = query.where(cls.company_id == scope.company_id)
    if scope.member.role != "ADMIN":
        query = query.where(getattr(cls, field).in_(scope.locations))
    return query


def rate_limit(db, request, action, identifier="", limit=10, period=900):
    bucket = int(time.time()) // period
    ip = request.client.host if request.client else "unknown"
    key = digest(f"{action}:{ip}:{identifier.lower()}:{bucket}")
    count = db.scalar(
        insert(RateWindow)
        .values(key=key, hits=1, expires_at=now() + timedelta(seconds=period))
        .on_conflict_do_update(index_elements=[RateWindow.key], set_={"hits": RateWindow.hits + 1})
        .returning(RateWindow.hits)
    )
    db.commit()  # Failed sign-ins still consume their rate allowance.
    if count > limit:
        raise HTTPException(429, "Too many attempts; please try again later")


def validate_grants(db, company_id, role, ids):
    ids = sorted(set(ids))
    if role != "ADMIN" and not ids:
        raise HTTPException(422, "Assign at least one location")
    actual = list(
        db.scalars(select(Location.id).where(Location.company_id == company_id, Location.id.in_(ids)))
    )
    if len(actual) != len(ids):
        raise HTTPException(404, "Location not found")
    return ids


def create_app(settings=None, sessions=None, route_class=None):
    settings = settings or get_settings()
    engine, factory = database(settings.database_url) if sessions is None else (None, sessions)
    app = FastAPI(
        title="Honor Inventory API", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json"
    )
    if route_class is not None:
        app.router.route_class = route_class
    app.state.sessions, app.state.settings = factory, settings
    app.state.engine = engine
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
        allow_headers=["Content-Type", "X-Company-Id", "X-Order-Key", "Idempotency-Key"],
    )

    @app.middleware("http")
    async def boundaries(request, call_next):
        started = time.monotonic()
        request.state.request_id = uid()
        origin = request.headers.get("Origin", "").rstrip("/")
        if request.method not in {"GET", "HEAD", "OPTIONS"} and origin and origin not in settings.origins:
            return JSONResponse({"detail": "Request origin is not allowed"}, status_code=403)
        try:
            if int(request.headers.get("Content-Length", "0")) > 1_000_000:
                return JSONResponse({"detail": "Request is too large"}, status_code=413)
        except ValueError:
            return JSONResponse({"detail": "Invalid content length"}, status_code=400)
        response = await call_next(request)
        log.info(
            "request",
            extra={
                "request_id": request.state.request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "elapsed_ms": round((time.monotonic() - started) * 1000),
            },
        )
        response.headers["X-Request-Id"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(IntegrityError)
    async def integrity_error(request, exc):
        return JSONResponse(
            {
                "detail": "This record conflicts with existing data. No stock change was committed.",
                "request_id": request.state.request_id,
            },
            status_code=409,
        )

    @app.exception_handler(OperationalError)
    async def database_error(request, exc):
        # Includes connection failures and transaction deadlocks: retry with the same command key.
        return JSONResponse(
            {
                "detail": "Database temporarily unavailable; retry with the same command key.",
                "request_id": request.state.request_id,
            },
            status_code=503,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        # Pydantic's default error payload can echo password/token input.
        return JSONResponse(
            {
                "detail": "Check the supplied fields",
                "fields": [".".join(str(v) for v in e["loc"]) for e in exc.errors()],
            },
            status_code=422,
        )

    @app.get("/api/health")
    def health(db: Db):
        db.execute(select(Company.id).limit(1))
        return {"status": "ok"}

    @app.get("/api/v1/config")
    def configuration():
        return {
            "development": settings.environment == "development",
            "auth_provider": settings.auth_provider,
            "payments": settings.payment_provider,
            "fulfilment": "COLLECTION",
            "shipping_available": False,
        }

    @app.post("/api/v1/auth/login")
    def login(data: S.Login, request: Request, response: Response, db: Db):
        rate_limit(db, request, "login", data.email)
        user, tokens = identify(db, settings, data.email, data.password)
        start_session(db, settings, user, tokens, response)
        return {"id": user.id, "name": user.name, "email": user.email}

    @app.post("/api/v1/auth/register")
    def register(data: S.Registration, request: Request, db: Db):
        rate_limit(db, request, "register", data.email, limit=5)
        return register_identity(data, db)

    def register_identity(data, db, redirect=""):
        if settings.auth_provider == "development":
            if not db.scalar(select(Identity.id).where(Identity.email == data.email.lower())):
                db.add(
                    Identity(
                        id=uid(),
                        email=data.email.lower(),
                        name=data.name,
                        password_hash=hasher.hash(data.password),
                    )
                )
                db.commit()
            return {"message": "You can now sign in with your account"}
        provider_call(
            settings,
            "POST",
            "/signup" + ("?" + urlencode({"redirect_to": redirect}) if redirect else ""),
            payload={"email": data.email, "password": data.password, "data": {"name": data.name}},
        )
        return {"message": "Check your inbox to verify your email, then sign in"}

    @app.post("/api/v1/auth/activate-invitation")
    def activate_invitation(data: S.InvitationActivation, request: Request, db: Db):
        rate_limit(db, request, "activate", data.email, limit=5)
        item = db.scalar(select(Invitation).where(Invitation.token_hash == digest(data.token)))
        if (
            not item
            or item.accepted
            or aware(item.expires_at) <= now()
            or item.email != data.email.strip().lower()
        ):
            raise HTTPException(400, "Ask your administrator for a current invitation for this email")
        redirect = settings.app_origin.rstrip("/") + "/workspace?" + urlencode({"invite": data.token})
        return register_identity(data, db, redirect)

    @app.post("/api/v1/auth/exchange")
    def exchange(request: Request, response: Response, db: Db, payload: dict):
        rate_limit(db, request, "exchange", limit=10)
        if settings.auth_provider != "supabase":
            raise HTTPException(404, "Not found")
        token = payload.get("access_token", "")
        if not isinstance(token, str) or len(token) > 8000:
            raise HTTPException(422, "Invalid token")
        profile = verified_user(settings, token)
        # Store only after verifying a refresh as well; arbitrary caller-supplied refresh tokens are not trusted.
        tokens = provider_call(
            settings,
            "POST",
            "/token?grant_type=refresh_token",
            payload={"refresh_token": payload.get("refresh_token", "")},
        )
        checked = verified_user(settings, tokens["access_token"])
        if checked["id"] != profile["id"]:
            raise HTTPException(403, "Session identity mismatch")
        user = db.get(Identity, profile["id"])
        if not user:
            user = Identity(
                id=profile["id"],
                email=profile["email"].lower(),
                name=profile.get("user_metadata", {}).get("name") or profile["email"].split("@")[0],
            )
            db.add(user)
            db.flush()
        else:
            sync_verified_email(db, user, checked)
        start_session(db, settings, user, tokens, response)
        return {"signed_in": True}

    @app.post("/api/v1/auth/logout")
    def logout(request: Request, response: Response, db: Db):
        _, active = current(db, request)
        active.revoked = True
        db.commit()
        response.delete_cookie(COOKIE, path="/")
        return {"signed_out": True}

    @app.post("/api/v1/auth/reauthenticate")
    def reauthenticate(data: S.Login, request: Request, db: Db):
        user, active = current(db, request)
        rate_limit(db, request, "reauth", user.id)
        checked, _ = identify(db, settings, user.email, data.password)
        if checked.id != user.id or data.email.lower() != user.email:
            raise HTTPException(403, "Identity mismatch")
        active.verified_at = now()
        db.commit()
        return {"verified": True}

    @app.post("/api/v1/auth/password")
    def change_password(data: S.PasswordChange, request: Request, response: Response, db: Db):
        user, active = current(db, request)
        rate_limit(db, request, "password", user.id, limit=5)
        identify(db, settings, user.email, data.current_password)
        if data.new_password == data.current_password:
            raise HTTPException(422, "Choose a different private password")
        tokens = None
        if settings.auth_provider == "development":
            user.password_hash = hasher.hash(data.new_password)
        else:
            tokens = provider_tokens(db, settings, active)
            provider_call(
                settings,
                "PUT",
                "/user",
                token=tokens["access_token"],
                payload={"password": data.new_password},
            )
        db.execute(
            update(LoginSession)
            .where(LoginSession.user_id == user.id, LoginSession.id != active.id)
            .values(revoked=True)
        )
        active.verified_at = now()
        user.must_change_password = False
        active.revoked = True
        notify_account_change(db, user, "password_changed")
        start_session(db, settings, user, tokens, response)
        return {"message": "Password changed; other Honor sessions signed out"}

    @app.post("/api/v1/auth/email")
    def change_email(data: S.EmailChange, request: Request, db: Db):
        user, active = current(db, request)
        rate_limit(db, request, "email", user.id, limit=3)
        identify(db, settings, user.email, data.current_password)
        email = data.email.strip().lower()
        if email == user.email:
            raise HTTPException(422, "Enter your new email address")
        if settings.auth_provider != "supabase":
            raise HTTPException(400, "Verified email changes require managed identity")
        tokens = provider_tokens(db, settings, active)
        provider_call(settings, "PUT", "/user", token=tokens["access_token"], payload={"email": email})
        notify_account_change(db, user, "email_change_requested", new_email=email)
        db.commit()
        return {
            "message": "Check your current and new inboxes to confirm the change. Your staff ID stays the same."
        }

    @app.post("/api/v1/auth/recover")
    def recover(data: S.Recovery, request: Request, db: Db):
        rate_limit(db, request, "recover", data.email, limit=3)
        if settings.auth_provider == "supabase":
            provider_call(settings, "POST", "/recover", payload={"email": data.email})
        return {"message": "If the account exists, a recovery email will be sent"}

    @app.post("/api/v1/auth/recovery-password")
    def recovery_password(data: S.RecoveryPassword, request: Request, db: Db):
        rate_limit(db, request, "recovery-token", limit=5)
        if settings.auth_provider != "supabase":
            raise HTTPException(400, "Recovery emails require managed identity")
        tokens = provider_call(
            settings, "POST", "/verify", payload={"type": "recovery", "token_hash": data.token_hash}
        )
        profile = verified_user(settings, tokens["access_token"])
        provider_call(
            settings, "PUT", "/user", token=tokens["access_token"], payload={"password": data.new_password}
        )
        user = db.get(Identity, profile["id"])
        if user:
            user.must_change_password = False
            notify_account_change(db, user, "password_reset")
        db.execute(update(LoginSession).where(LoginSession.user_id == profile["id"]).values(revoked=True))
        db.commit()
        return {"message": "Password reset. Sign in with your new password."}

    @app.post("/api/v1/auth/mfa/enrol")
    def enrol(request: Request, db: Db):
        _, active = current(db, request)
        tokens = provider_tokens(db, settings, active)
        result = provider_call(
            settings,
            "POST",
            "/factors",
            token=tokens["access_token"],
            payload={"factor_type": "totp", "friendly_name": "Honor authenticator"},
        )
        db.commit()
        return result

    @app.post("/api/v1/auth/mfa/verify")
    def verify_mfa(data: S.MfaCode, request: Request, db: Db):
        user, active = current(db, request)
        rate_limit(db, request, "mfa", user.id, limit=8)
        tokens = provider_tokens(db, settings, active)
        challenge = provider_call(
            settings, "POST", f"/factors/{data.factor_id}/challenge", token=tokens["access_token"], payload={}
        )
        tokens = provider_call(
            settings,
            "POST",
            f"/factors/{data.factor_id}/verify",
            token=tokens["access_token"],
            payload={"challenge_id": challenge["id"], "code": data.code},
        )
        active.provider_tokens = cipher(settings).encrypt(json.dumps(tokens).encode()).decode()
        active.mfa, active.verified_at = True, now()
        db.commit()
        return {"verified": True}

    @app.get("/api/v1/me")
    def me(request: Request, db: Db):
        user, active = current(db, request)
        memberships = list(
            db.scalars(select(Membership).where(Membership.user_id == user.id, Membership.active.is_(True)))
        )
        companies = [{**company_json(db.get(Company, m.company_id)), "role": m.role} for m in memberships]
        factors = []
        if settings.auth_provider == "supabase" and active.provider_tokens:
            tokens = provider_tokens(db, settings, active)
            profile = provider_call(settings, "GET", "/user", token=tokens["access_token"])
            if profile.get("email_confirmed_at") and profile.get("id") == user.id:
                sync_verified_email(db, user, profile)
            factors = [{"id": f["id"], "status": f.get("status")} for f in profile.get("factors", [])]
            db.commit()
        return {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "companies": companies,
            "mfa": active.mfa,
            "factors": factors,
            "session_id": active.id,
            "must_change_password": user.must_change_password,
        }

    @app.post("/api/v1/companies", status_code=201)
    def create_company(data: S.CompanyInput, request: Request, db: Db):
        raise HTTPException(403, "Honor is one business. Contact its administrator for staff access.")

    @app.get("/api/v1/locations")
    def locations(request: Request, db: Db):
        scope = Scope(db, request)
        query = select(Location).where(Location.company_id == scope.company_id)
        if scope.member.role != "ADMIN":
            query = query.where(Location.id.in_(scope.locations))
        return [
            {"id": x.id, "name": x.name, "address": x.address, "fulfil_online": x.fulfil_online}
            for x in db.scalars(query.order_by(Location.name))
        ]

    @app.get("/api/v1/transfer-destinations")
    def destinations(request: Request, db: Db):
        scope = Scope(db, request)
        scope.require("ADMIN", "MANAGER", "STOCK")
        return [
            {"id": x.id, "name": x.name}
            for x in db.scalars(
                select(Location).where(Location.company_id == scope.company_id).order_by(Location.name)
            )
        ]

    @app.post("/api/v1/locations", status_code=201)
    def add_location(data: S.LocationInput, request: Request, db: Db):
        scope = Scope(db, request)
        scope.require("ADMIN")
        location = Location(id=uid(), company_id=scope.company_id, **data.model_dump())
        db.add(location)
        inventory.audit(db, scope.company_id, scope.user.id, "location.created", location_id=location.id)
        db.commit()
        return {
            "id": location.id,
            "name": location.name,
            "address": location.address,
            "fulfil_online": location.fulfil_online,
        }

    @app.get("/api/v1/products")
    def products(request: Request, db: Db):
        scope = Scope(db, request)
        return [
            product_json(p, scope.member.role in {"ADMIN", "MANAGER"})
            for p in db.scalars(
                select(Product)
                .where(Product.company_id == scope.company_id)
                .order_by(Product.name)
                .limit(1000)
            )
        ]

    @app.post("/api/v1/products", status_code=201)
    def add_product(data: S.ProductInput, request: Request, db: Db):
        scope = Scope(db, request)
        scope.require("ADMIN", "MANAGER")
        product = Product(id=uid(), company_id=scope.company_id, **data.model_dump())
        db.add(product)
        inventory.audit(db, scope.company_id, scope.user.id, "product.created", product_id=product.id)
        db.commit()
        return product_json(product, True)

    @app.put("/api/v1/products/{product_id}")
    def edit_product(product_id: str, data: S.ProductInput, request: Request, db: Db):
        scope = Scope(db, request)
        scope.require("ADMIN", "MANAGER")
        product = inventory.scoped(db, Product, scope.company_id, product_id, lock=True)
        if product.tracking != data.tracking and db.scalar(
            select(Movement.id)
            .where(Movement.company_id == scope.company_id, Movement.product_id == product.id)
            .limit(1)
        ):
            raise HTTPException(409, "Tracking type cannot change after stock movements")
        for key, value in data.model_dump().items():
            setattr(product, key, value)
        inventory.audit(db, scope.company_id, scope.user.id, "product.updated", product_id=product.id)
        db.commit()
        return product_json(product, True)

    @app.get("/api/v1/stock/balances")
    def balances(request: Request, db: Db):
        scope = Scope(db, request)
        return [
            {
                "product_id": x.product_id,
                "location_id": x.location_id,
                "on_hand": x.on_hand,
                "reserved": x.reserved,
                "available": x.on_hand - x.reserved,
            }
            for x in db.scalars(scope_query(select(Balance), Balance, scope))
        ]

    @app.get("/api/v1/stock/movements")
    def movements(request: Request, db: Db, limit: int = Query(default=100, ge=1, le=500)):
        scope = Scope(db, request)
        return [
            {
                "id": x.id,
                "product_id": x.product_id,
                "location_id": x.location_id,
                "delta": x.delta,
                "kind": x.kind,
                "reference": x.reference,
                "reason": x.reason,
                "created_at": x.created_at.isoformat(),
                "actor_id": x.actor_id,
            }
            for x in db.scalars(
                scope_query(select(Movement), Movement, scope)
                .order_by(Movement.created_at.desc())
                .limit(limit)
            )
        ]

    @app.get("/api/v1/stock/serials")
    def serials(request: Request, db: Db, product_id: str, location_id: str):
        scope = Scope(db, request)
        scope.require("ADMIN", "MANAGER", "STOCK")
        scope.location(location_id)
        inventory.scoped(db, Product, scope.company_id, product_id)
        return [
            {"id": x.id, "serial": x.serial, "status": x.status}
            for x in db.scalars(
                select(SerialUnit)
                .where(
                    SerialUnit.company_id == scope.company_id,
                    SerialUnit.product_id == product_id,
                    SerialUnit.location_id == location_id,
                )
                .order_by(SerialUnit.serial)
                .limit(1000)
            )
        ]

    @app.get("/api/v1/stock/serial-search")
    def serial_search(request: Request, db: Db, serial: str = Query(min_length=1, max_length=100)):
        from sqlalchemy.dialects.postgresql import JSONB

        scope = Scope(db, request)
        scope.require("ADMIN", "MANAGER", "STOCK")
        unit = db.scalar(
            scope_query(select(SerialUnit), SerialUnit, scope).where(SerialUnit.serial == serial.strip())
        )
        if not unit:
            raise HTTPException(404, "Device not found in your permitted locations")
        product = db.get(Product, unit.product_id)
        history = db.execute(
            scope_query(
                select(Order, OrderLine).join(OrderLine, OrderLine.order_id == Order.id), Order, scope
            )
            .where(OrderLine.serials.cast(JSONB).contains([unit.serial]))
            .order_by(Order.created_at.desc())
            .limit(50)
        )
        return {
            "serial": unit.serial,
            "product_id": unit.product_id,
            "product": product.name,
            "sku": product.sku,
            "location_id": unit.location_id,
            "status": unit.status,
            "order_id": unit.order_id,
            "sales": [
                {
                    "order_id": order.id,
                    "customer_name": order.customer_name,
                    "product": line.name,
                    "status": order.status,
                    "created_at": order.created_at.isoformat(),
                }
                for order, line in history
            ],
        }

    @app.post("/api/v1/receipts")
    def receive(data: S.StockInput, request: Request, db: Db, idempotency_key: Key = None):
        return inventory.receive(db, Scope(db, request), data, idempotency_key)

    @app.post("/api/v1/adjustments")
    def adjustment(data: S.AdjustmentInput, request: Request, db: Db, idempotency_key: Key = None):
        return inventory.adjust(db, Scope(db, request), data, idempotency_key)

    @app.get("/api/v1/transfers")
    def transfers(request: Request, db: Db):
        scope = Scope(db, request)
        query = select(Transfer).where(Transfer.company_id == scope.company_id)
        if scope.member.role != "ADMIN":
            query = query.where(
                or_(Transfer.source_id.in_(scope.locations), Transfer.destination_id.in_(scope.locations))
            )
        return [
            {
                k: getattr(x, k)
                for k in ("id", "product_id", "source_id", "destination_id", "quantity", "status", "reason")
            }
            for x in db.scalars(query.order_by(Transfer.created_at.desc()).limit(200))
        ]

    @app.post("/api/v1/transfers")
    def transfer(data: S.TransferInput, request: Request, db: Db, idempotency_key: Key = None):
        return inventory.dispatch(db, Scope(db, request), data, idempotency_key)

    @app.post("/api/v1/transfers/{transfer_id}/receive")
    def receive_transfer(transfer_id: str, request: Request, db: Db, idempotency_key: Key = None):
        return inventory.receive_transfer(db, Scope(db, request), transfer_id, idempotency_key)

    @app.get("/api/v1/orders")
    def orders(request: Request, db: Db):
        scope = Scope(db, request)
        return [
            order_json(db, x, True)
            for x in db.scalars(
                scope_query(select(Order), Order, scope).order_by(Order.created_at.desc()).limit(200)
            )
        ]

    @app.post("/api/v1/orders/{order_id}/fulfil")
    def fulfil(order_id: str, request: Request, db: Db, data: S.FulfilInput, idempotency_key: Key = None):
        return inventory.fulfil(db, Scope(db, request), order_id, idempotency_key, data)

    @app.get("/api/v1/orders/{order_id}/receipt.pdf")
    def staff_receipt(order_id: str, request: Request, db: Db):
        scope = Scope(db, request)
        order = inventory.scoped(db, Order, scope.company_id, order_id)
        scope.location(order.location_id)
        return receipt_response(db, order)

    @app.post("/api/v1/orders/{order_id}/returns")
    def return_item(
        order_id: str, data: S.ReturnInput, request: Request, db: Db, idempotency_key: Key = None
    ):
        return inventory.inspected_return(db, Scope(db, request), order_id, data, idempotency_key)

    @app.get("/api/v1/team")
    def team(request: Request, db: Db):
        scope = Scope(db, request)
        scope.require("ADMIN")
        result = []
        for member in db.scalars(select(Membership).where(Membership.company_id == scope.company_id)):
            user = db.get(Identity, member.user_id)
            grants = list(
                db.scalars(
                    select(LocationGrant.location_id).where(
                        LocationGrant.company_id == scope.company_id, LocationGrant.user_id == user.id
                    )
                )
            )
            result.append(
                {
                    "id": user.id,
                    "name": user.name,
                    "email": user.email,
                    "role": member.role,
                    "active": member.active,
                    "location_ids": grants,
                }
            )
        return result

    @app.post("/api/v1/team", status_code=201)
    def create_staff_account(data: S.StaffAccount, request: Request, db: Db):
        scope = Scope(db, request)
        scope.sensitive(settings)
        rate_limit(db, request, "staff-create", scope.user.id, limit=10)
        ids = validate_grants(db, scope.company_id, data.role, data.location_ids)
        email = data.email.strip().lower()
        db.scalar(select(Company).where(Company.id == scope.company_id).with_for_update())
        if db.scalar(select(Identity.id).where(Identity.email == email)):
            raise HTTPException(409, "Account already exists. Send an invitation instead.")
        if settings.auth_provider == "development":
            user = Identity(
                id=uid(),
                email=email,
                name=data.name,
                password_hash=hasher.hash(data.temporary_password),
                must_change_password=True,
            )
        else:
            profile = admin_create_identity(
                settings, email=email, name=data.name, password=data.temporary_password
            )
            user = Identity(id=profile["id"], email=email, name=data.name, must_change_password=True)
        db.add(user)
        db.flush()
        db.add(Membership(company_id=scope.company_id, user_id=user.id, role=data.role, active=data.active))
        db.flush()
        for location_id in ids:
            db.add(LocationGrant(company_id=scope.company_id, user_id=user.id, location_id=location_id))
        if settings.auth_provider == "supabase":
            db.add(
                Outbox(company_id=scope.company_id, kind="STAFF_CONFIRMATION_EMAIL", payload={"email": email})
            )
        inventory.audit(
            db, scope.company_id, scope.user.id, "member.created", user_id=user.id, role=data.role
        )
        db.commit()
        return {
            "id": user.id,
            "must_change_password": True,
            "email_status": "QUEUED" if settings.auth_provider == "supabase" else "DEVELOPMENT",
        }

    @app.patch("/api/v1/team/{user_id}")
    def edit_member(user_id: str, data: S.MemberInput, request: Request, db: Db):
        scope = Scope(db, request)
        scope.sensitive(settings)
        db.scalar(select(Company).where(Company.id == scope.company_id).with_for_update())
        member = db.scalar(
            select(Membership)
            .where(Membership.company_id == scope.company_id, Membership.user_id == user_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if not member:
            raise HTTPException(404, "Member not found")
        if user_id == scope.user.id and (not data.active or data.role != "ADMIN"):
            raise HTTPException(409, "Ask another administrator to change your own access")
        count = db.scalar(
            select(func.count())
            .select_from(Membership)
            .where(
                Membership.company_id == scope.company_id,
                Membership.role == "ADMIN",
                Membership.active.is_(True),
            )
        )
        if (
            member.role == "ADMIN"
            and member.active
            and (data.role != "ADMIN" or not data.active)
            and count <= 1
        ):
            raise HTTPException(409, "The company must retain an active administrator")
        ids = validate_grants(db, scope.company_id, data.role, data.location_ids)
        member.role, member.active = data.role, data.active
        db.execute(
            delete(LocationGrant).where(
                LocationGrant.company_id == scope.company_id, LocationGrant.user_id == user_id
            )
        )
        for location_id in ids:
            db.add(LocationGrant(company_id=scope.company_id, user_id=user_id, location_id=location_id))
        inventory.audit(
            db,
            scope.company_id,
            scope.user.id,
            "member.access_changed",
            user_id=user_id,
            role=data.role,
            active=data.active,
            location_ids=ids,
        )
        db.commit()
        return {"updated": True}

    @app.post("/api/v1/team/{user_id}/sign-out")
    def kick_member(user_id: str, request: Request, db: Db):
        scope = Scope(db, request)
        scope.sensitive(settings)
        if not db.get(Membership, (scope.company_id, user_id)):
            raise HTTPException(404, "Member not found")
        for session_id in db.scalars(
            select(LoginSession.id).where(LoginSession.user_id == user_id, LoginSession.revoked.is_(False))
        ):
            db.execute(
                insert(CompanySessionBlock)
                .values(company_id=scope.company_id, session_id=session_id)
                .on_conflict_do_nothing()
            )
        inventory.audit(db, scope.company_id, scope.user.id, "member.signed_out", user_id=user_id)
        db.commit()
        return {"signed_out": True}

    @app.post("/api/v1/team/{user_id}/recover")
    def member_recover(user_id: str, request: Request, db: Db):
        scope = Scope(db, request)
        scope.sensitive(settings)
        if not db.get(Membership, (scope.company_id, user_id)):
            raise HTTPException(404, "Member not found")
        if settings.auth_provider != "supabase":
            raise HTTPException(
                400,
                "Recovery emails require managed identity. Development users can change their own password in Security.",
            )
        user = db.get(Identity, user_id)
        provider_call(settings, "POST", "/recover", payload={"email": user.email})
        inventory.audit(db, scope.company_id, scope.user.id, "member.recovery_requested", user_id=user_id)
        db.commit()
        return {"requested": True}

    @app.post("/api/v1/invitations", status_code=201)
    def invite(data: S.InviteInput, request: Request, db: Db):
        scope = Scope(db, request)
        scope.sensitive(settings)
        ids = validate_grants(db, scope.company_id, data.role, data.location_ids)
        raw = secrets.token_urlsafe(32)
        for previous in db.scalars(
            select(Invitation)
            .where(
                Invitation.company_id == scope.company_id,
                Invitation.email == data.email.lower(),
                Invitation.accepted.is_(False),
            )
            .with_for_update()
        ):
            previous.accepted = True  # A newer invitation invalidates older unused links.
        item = Invitation(
            id=uid(),
            company_id=scope.company_id,
            email=data.email.lower(),
            role=data.role,
            locations=ids,
            token_hash=digest(raw),
            expires_at=now() + timedelta(days=2),
        )
        db.add(item)
        url = settings.app_origin.rstrip("/") + "/workspace?invite=" + raw
        db.add(
            Outbox(
                company_id=scope.company_id,
                kind="INVITATION_EMAIL",
                payload={"email": data.email, "url": url},
            )
        )
        inventory.audit(
            db, scope.company_id, scope.user.id, "member.invited", invitation_id=item.id, role=data.role
        )
        db.commit()
        return {
            "id": item.id,
            "email_status": "QUEUED",
            "development_link": url if settings.environment == "development" else None,
        }

    @app.post("/api/v1/invitations/accept")
    def accept_invitation(data: S.AcceptInvite, request: Request, db: Db):
        user, _ = current(db, request)
        item = db.scalar(
            select(Invitation).where(Invitation.token_hash == digest(data.token)).with_for_update()
        )
        if not item or item.accepted or aware(item.expires_at) <= now() or item.email != user.email.lower():
            raise HTTPException(
                400, "Invitation is invalid, expired, already used or belongs to another email"
            )
        if db.get(Membership, (item.company_id, user.id)):
            raise HTTPException(409, "An administrator must update this existing membership")
        db.add(Membership(company_id=item.company_id, user_id=user.id, role=item.role))
        db.flush()
        for location_id in item.locations:
            db.add(LocationGrant(company_id=item.company_id, user_id=user.id, location_id=location_id))
        item.accepted = True
        inventory.audit(db, item.company_id, user.id, "member.invitation_accepted", invitation_id=item.id)
        db.commit()
        return {"company_id": item.company_id}

    @app.get("/api/v1/audit")
    def audit_log(request: Request, db: Db):
        scope = Scope(db, request)
        scope.require("ADMIN")
        return [
            {
                "id": x.id,
                "action": x.action,
                "actor_id": x.actor_id,
                "details": x.details,
                "created_at": x.created_at.isoformat(),
            }
            for x in db.scalars(
                select(Audit)
                .where(Audit.company_id == scope.company_id)
                .order_by(Audit.created_at.desc())
                .limit(200)
            )
        ]

    @app.get("/api/v1/jobs")
    def job_status(request: Request, db: Db):
        scope = Scope(db, request)
        scope.require("ADMIN")
        return [
            {
                "id": x.id,
                "kind": x.kind,
                "status": x.status,
                "attempts": x.attempts,
                "last_error": x.last_error,
            }
            for x in db.scalars(
                select(Outbox)
                .where(Outbox.company_id == scope.company_id)
                .order_by(Outbox.available_at.desc())
                .limit(100)
            )
        ]

    @app.get("/api/v1/storefront/{slug}")
    def catalogue(slug: str, db: Db):
        company = db.scalar(select(Company).where(Company.slug == slug))
        if not company:
            raise HTTPException(404, "Shop not found")
        products = list(
            db.scalars(
                select(Product)
                .where(Product.company_id == company.id, Product.published.is_(True))
                .order_by(Product.name)
                .limit(1000)
            )
        )
        result = []
        for product in products:
            available = db.scalar(
                select(func.coalesce(func.max(Balance.on_hand - Balance.reserved), 0))
                .join(
                    Location,
                    (Location.company_id == Balance.company_id) & (Location.id == Balance.location_id),
                )
                .where(
                    Balance.company_id == company.id,
                    Balance.product_id == product.id,
                    Location.fulfil_online.is_(True),
                )
            )
            result.append(
                {
                    k: v
                    for k, v in product_json(product).items()
                    if k not in {"reorder_point", "tracking", "published"}
                }
                | {"available": available}
            )
        enabled = settings.payment_provider != "disabled" and (
            settings.payment_provider == "sandbox" or settings.merchant_company_id == company.id
        )
        return {
            "company": {"name": company.name, "slug": company.slug, "currency": company.currency},
            "products": result,
            "locations": [
                {"id": loc.id, "name": loc.name, "address": loc.address}
                for loc in db.scalars(
                    select(Location)
                    .where(Location.company_id == company.id, Location.fulfil_online.is_(True))
                    .order_by(Location.name)
                )
            ],
            "checkout_enabled": enabled,
            "payment_methods": payments.checkout_channels(settings, company.currency) if enabled else [],
            "simulation": settings.payment_provider == "sandbox",
            "fulfilment": "COLLECTION",
        }

    @app.post("/api/v1/storefront/{slug}/checkouts", status_code=201)
    def checkout(slug: str, data: S.Checkout, request: Request, db: Db, idempotency_key: Key = None):
        rate_limit(db, request, "checkout", limit=60, period=60)
        company = db.scalar(select(Company).where(Company.slug == slug))
        if not company:
            raise HTTPException(404, "Shop not found")
        payments.guard_merchant(settings, company.id)
        customer_id = current(db, request)[0].id if request.cookies.get(COOKIE) else None
        return inventory.reserve(db, company, data, idempotency_key, settings, customer_id)

    @app.get("/api/v1/customer/me")
    def customer_profile(request: Request, db: Db):
        user, _ = current(db, request)
        return {"id": user.id, "name": user.name, "email": user.email}

    @app.get("/api/v1/customer/orders")
    def customer_orders(request: Request, db: Db, shop: str = Query(min_length=1, max_length=80)):
        user, _ = current(db, request)
        orders = db.scalars(
            select(Order)
            .join(Company)
            .where(Order.customer_id == user.id, Company.slug == shop)
            .order_by(Order.created_at.desc())
            .limit(200)
        )
        return [order_json(db, order) for order in orders]

    @app.get("/api/v1/customer/orders/{order_id}")
    def customer_order(order_id: str, request: Request, db: Db, x_order_key: str = Header(default="")):
        customer_id = current(db, request)[0].id if not x_order_key and request.cookies.get(COOKIE) else None
        order = payments.order_access(db, order_id, x_order_key, customer_id)
        if order.status == "RESERVED" and aware(order.expires_at) <= now():
            order = db.scalar(
                select(Order)
                .where(Order.id == order.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if order.status == "RESERVED" and aware(order.expires_at) <= now():
                inventory.release(db, order, "EXPIRED")
                db.commit()
        return order_json(db, order)

    @app.post("/api/v1/checkouts/{order_id}/payment")
    def payment(order_id: str, request: Request, db: Db, x_order_key: str = Header(default="")):
        customer_id = current(db, request)[0].id if not x_order_key and request.cookies.get(COOKIE) else None
        return payments.begin_payment(db, order_id, x_order_key, settings, customer_id)

    @app.post("/api/v1/customer/orders/{order_id}/verify-payment")
    def verify_payment(order_id: str, request: Request, db: Db, x_order_key: str = Header(default="")):
        customer_id = current(db, request)[0].id if not x_order_key and request.cookies.get(COOKIE) else None
        order = payments.order_access(db, order_id, x_order_key, customer_id)
        rate_limit(db, request, "verify-payment", order.id, limit=10, period=60)
        payments.guard_merchant(settings, order.company_id)
        attempt = db.scalar(select(PaymentAttempt).where(PaymentAttempt.order_id == order.id))
        if not attempt:
            raise HTTPException(409, "Start hosted checkout before checking a payment")
        if order.payment_status == "UNPAID":
            if attempt.provider == "sandbox":
                raise HTTPException(409, "No real payment exists in the development simulator")
            verified = payments.verified_payment(settings, attempt)
            payments.apply_verified(db, settings, attempt.id, verified)
            db.commit()
        return order_json(db, order)

    @app.get("/api/v1/customer/orders/{order_id}/receipt.pdf")
    def customer_receipt(order_id: str, request: Request, db: Db, x_order_key: str = Header(default="")):
        customer_id = current(db, request)[0].id if not x_order_key and request.cookies.get(COOKIE) else None
        order = payments.order_access(db, order_id, x_order_key, customer_id)
        return receipt_response(db, order)

    @app.post("/api/v1/checkouts/{order_id}/simulate")
    def simulate(order_id: str, db: Db, x_order_key: str = Header(default="")):
        return payments.simulate_payment(db, settings, order_id, x_order_key)

    @app.post("/api/v1/customer/orders/{order_id}/cancel")
    def cancel(order_id: str, request: Request, db: Db, x_order_key: str = Header(default="")):
        customer_id = current(db, request)[0].id if not x_order_key and request.cookies.get(COOKIE) else None
        payments.order_access(db, order_id, x_order_key, customer_id)
        order = db.scalar(
            select(Order)
            .where(Order.id == order_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if order.status != "RESERVED" or order.payment_status != "UNPAID":
            raise HTTPException(409, "Contact the company to cancel this order")
        inventory.release(db, order, "CANCELLED")
        inventory.audit(db, order.company_id, "customer", "order.cancelled", order_id=order.id)
        db.commit()
        return {"status": "CANCELLED"}

    @app.post("/api/v1/payment-webhooks/{provider}")
    async def webhook(provider: str, request: Request, db: Db):
        raw = await request.body()
        if len(raw) > 500_000:
            raise HTTPException(413, "Event is too large")
        signature = request.headers.get(
            "x-paystack-signature" if provider == "paystack" else "stripe-signature", ""
        )
        return payments.store_event(db, settings, provider, raw, signature)

    # Optional same-origin dashboard hosting; API routes above take precedence.
    dist = Path(__file__).resolve().parents[3] / "dist"
    if (dist / "assets").exists():
        from fastapi.staticfiles import StaticFiles

        app.mount("/assets", StaticFiles(directory=dist / "assets", check_dir=False), name="assets")

        @app.get("/{path:path}")
        def frontend(path: str):
            if path.startswith("api/"):
                raise HTTPException(404, "Not found")
            return FileResponse(dist / "index.html")

    return app
