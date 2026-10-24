from functools import lru_cache
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HONOR_", env_file=".env", extra="ignore")
    environment: str = "production"
    database_url: str = ""
    session_secret: str = ""
    auth_provider: str = "supabase"
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    supabase_secret_key: str = ""
    app_origin: str = "http://localhost:3000"
    shop_origin: str = ""
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    cookie_secure: bool = True
    session_hours: int = 12
    reservation_minutes: int = 15
    payment_provider: str = "disabled"
    payment_secret: str = ""
    payment_webhook_secret: str = ""
    paystack_channels: str = "card,bank_transfer"
    merchant_company_id: str = ""
    resend_api_key: str = ""
    email_from: str = ""

    @model_validator(mode="after")
    def validate_environment(self):
        if not self.database_url or len(self.session_secret) < 32:
            raise ValueError(
                "Set HONOR_DATABASE_URL and a random HONOR_SESSION_SECRET of at least 32 characters"
            )
        if self.auth_provider not in {"supabase", "development"}:
            raise ValueError("Unsupported identity provider")
        if self.payment_provider not in {"disabled", "sandbox", "paystack", "stripe"}:
            raise ValueError("Unsupported payment provider")
        allowed = {
            "card",
            "bank",
            "bank_transfer",
            "ussd",
            "qr",
            "mobile_money",
            "apple_pay",
            "eft",
            "capitec_pay",
            "payattitude",
        }
        channels = [x.strip() for x in self.paystack_channels.split(",") if x.strip()]
        if not channels or len(channels) != len(set(channels)) or set(channels) - allowed:
            raise ValueError("Configure supported, unique Paystack checkout channels")
        if self.environment != "development":
            if self.auth_provider == "development" or self.payment_provider == "sandbox":
                raise ValueError(
                    "Development identity and sandbox simulation are forbidden outside development"
                )
            if not self.database_url.startswith("postgresql") or not self.cookie_secure:
                raise ValueError("Production requires PostgreSQL and secure cookies")
            if not self.app_origin.startswith("https://"):
                raise ValueError("Production requires an HTTPS application origin")
            if self.shop_origin and not self.shop_origin.startswith("https://"):
                raise ValueError("Production storefront requires HTTPS")
        if self.auth_provider == "supabase" and (
            not self.supabase_url.startswith("https://") or not self.supabase_publishable_key
        ):
            raise ValueError("Configure Supabase URL and publishable key")
        if self.payment_provider in {"paystack", "stripe"} and (
            not self.payment_secret or not self.merchant_company_id
        ):
            raise ValueError("Configure a payment secret and the authorised merchant company")
        if self.payment_provider == "stripe" and not self.payment_webhook_secret:
            raise ValueError("Configure Stripe webhook signing secret")
        if not 1 <= self.session_hours <= 24 or not 1 <= self.reservation_minutes <= 60:
            raise ValueError("Session or reservation duration outside supported limits")
        return self

    @property
    def origins(self):
        return [x.strip().rstrip("/") for x in self.allowed_origins.split(",") if x.strip()]


@lru_cache
def get_settings():
    return Settings()
