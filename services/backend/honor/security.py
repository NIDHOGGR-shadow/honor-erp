import base64
import hashlib
import json
import secrets
from datetime import timedelta
from functools import lru_cache

import httpx
from cryptography.fernet import Fernet
from fastapi import HTTPException, Request, Response
from sqlalchemy import select

from .models import CompanySessionBlock, Identity, LoginSession, Membership, LocationGrant, now, uid
from .transport import request as http_request


@lru_cache(maxsize=1)
def _password_hasher():
    # Production uses Supabase Auth; only local development needs Argon2.
    from argon2 import PasswordHasher

    return PasswordHasher()


class _LazyPasswordHasher:
    def hash(self, *args, **kwargs):
        return _password_hasher().hash(*args, **kwargs)

    def verify(self, *args, **kwargs):
        return _password_hasher().verify(*args, **kwargs)


hasher = _LazyPasswordHasher()
COOKIE = "honor_session"


def digest(value: str):
    return hashlib.sha256(value.encode()).hexdigest()


def aware(value):
    return value.replace(tzinfo=now().tzinfo) if value.tzinfo is None else value


def cipher(settings):
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(settings.session_secret.encode()).digest()))


def provider_call(settings, method, path, *, token=None, payload=None):
    headers = {"apikey": settings.supabase_publishable_key}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        result = http_request(
            method,
            settings.supabase_url.rstrip("/") + "/auth/v1" + path,
            headers=headers,
            json=payload,
            timeout=15,
        )
    except httpx.HTTPError:
        raise HTTPException(503, "Identity service unavailable; please retry") from None
    if result.status_code >= 400:
        raise HTTPException(
            400, "Identity request failed. Check your credentials, verification or security code."
        )
    return result.json()


def admin_create_identity(settings, *, email, name, password):
    if not settings.supabase_secret_key:
        raise HTTPException(503, "Administrator account creation is not connected. Use an invitation.")
    headers = {"apikey": settings.supabase_secret_key}
    # New sb_secret keys belong in apikey; only legacy JWT service keys use Bearer.
    if not settings.supabase_secret_key.startswith("sb_secret_"):
        headers["Authorization"] = "Bearer " + settings.supabase_secret_key
    try:
        result = http_request(
            "POST",
            settings.supabase_url.rstrip("/") + "/auth/v1/admin/users",
            headers=headers,
            json={
                "email": email,
                "password": password,
                "email_confirm": False,
                "user_metadata": {"name": name},
            },
            timeout=15,
        )
    except httpx.HTTPError:
        raise HTTPException(
            503, "Identity service unavailable. Check account status before retrying."
        ) from None
    if result.status_code >= 400:
        raise HTTPException(409, "Account could not be created. Use an invitation for an existing account.")
    profile = result.json()
    if not profile.get("id") or profile.get("email", "").lower() != email:
        raise HTTPException(502, "Identity service returned an unexpected account")
    return profile


def verified_user(settings, token):
    user = provider_call(settings, "GET", "/user", token=token)
    if not user.get("email_confirmed_at") or not user.get("email"):
        raise HTTPException(403, "Verify your email before signing in")
    return user


def token_mfa(access_token):
    # Called only after the Auth server has validated this token or returned it over TLS.
    try:
        part = access_token.split(".")[1]
        return json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))).get("aal") == "aal2"
    except (ValueError, IndexError, KeyError):
        return False


def identify(db, settings, email, password):
    email = email.strip().lower()
    if settings.auth_provider == "development":
        from argon2.exceptions import VerificationError, InvalidHashError

        user = db.scalar(select(Identity).where(Identity.email == email))
        try:
            if user and user.password_hash and hasher.verify(user.password_hash, password):
                return user, None
        except (VerificationError, InvalidHashError):
            pass
        # Keep a similar hashing cost for unknown identities.
        if not user:
            hasher.hash(password)
        raise HTTPException(401, "Email or password is incorrect")
    tokens = provider_call(
        settings, "POST", "/token?grant_type=password", payload={"email": email, "password": password}
    )
    profile = verified_user(settings, tokens["access_token"])
    user = db.get(Identity, profile["id"])
    if not user:
        user = Identity(
            id=profile["id"],
            email=profile["email"].lower(),
            name=profile.get("user_metadata", {}).get("name") or email.split("@")[0],
        )
        db.add(user)
        db.flush()
    else:
        from .accounts import sync_verified_email

        sync_verified_email(db, user, profile)
    return user, tokens


def start_session(db, settings, user, tokens, response: Response):
    raw = secrets.token_urlsafe(32)
    active = LoginSession(
        id=uid(),
        user_id=user.id,
        token_hash=digest(raw),
        expires_at=now() + timedelta(hours=settings.session_hours),
        provider_tokens=cipher(settings).encrypt(json.dumps(tokens).encode()).decode() if tokens else None,
        mfa=token_mfa(tokens["access_token"]) if tokens else False,
    )
    db.add(active)
    db.commit()
    response.set_cookie(
        COOKIE,
        raw,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.session_hours * 3600,
        path="/",
    )
    return active


def current(db, request: Request):
    raw = request.cookies.get(COOKIE, "")
    active = db.scalar(select(LoginSession).where(LoginSession.token_hash == digest(raw))) if raw else None
    if not active or active.revoked or aware(active.expires_at) <= now():
        raise HTTPException(401, "Sign in to continue")
    user = db.get(Identity, active.user_id)
    if not user:
        raise HTTPException(401, "Sign in to continue")
    if user.must_change_password and request.url.path not in {
        "/api/v1/me",
        "/api/v1/auth/password",
        "/api/v1/auth/logout",
    }:
        raise HTTPException(403, "Replace your temporary password before using Honor")
    return user, active


def provider_tokens(db, settings, active):
    if not active.provider_tokens:
        raise HTTPException(400, "This action requires managed identity")
    tokens = json.loads(cipher(settings).decrypt(active.provider_tokens).decode())
    # Refresh before provider actions. Refreshes remain server-side and do not bypass app-session revocation.
    if tokens.get("expires_at", 0) <= now().timestamp() + 60:
        tokens = provider_call(
            settings,
            "POST",
            "/token?grant_type=refresh_token",
            payload={"refresh_token": tokens["refresh_token"]},
        )
        active.provider_tokens = cipher(settings).encrypt(json.dumps(tokens).encode()).decode()
        db.flush()
    return tokens


class Scope:
    def __init__(self, db, request):
        self.user, self.session = current(db, request)
        self.company_id = request.headers.get("X-Company-Id", "")
        self.member = db.get(Membership, (self.company_id, self.user.id))
        if not self.member or not self.member.active:
            raise HTTPException(403, "No active access to this company")
        if db.get(CompanySessionBlock, (self.company_id, self.session.id)):
            raise HTTPException(
                403, "Your administrator signed you out of this company. Sign in again to continue."
            )
        self.locations = set(
            db.scalars(
                select(LocationGrant.location_id).where(
                    LocationGrant.company_id == self.company_id, LocationGrant.user_id == self.user.id
                )
            )
        )

    def require(self, *roles):
        if self.member.role not in roles:
            raise HTTPException(403, "Your company administrator controls this permission")

    def location(self, location_id):
        if self.member.role != "ADMIN" and location_id not in self.locations:
            raise HTTPException(403, "This location is outside your access")

    def sensitive(self, settings):
        self.require("ADMIN")
        if now() - aware(self.session.verified_at) > timedelta(minutes=5):
            raise HTTPException(403, "Re-enter your password in Security before changing access")
        if settings.environment != "development" and not self.session.mfa:
            raise HTTPException(403, "Verify an authenticator code in Security before changing access")
