import hashlib
import hmac
import json
import time

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from .inventory import audit, confirm_payment, release
from .models import Company, Order, Outbox, PaymentAttempt, ProviderEvent, now, uid
from .security import aware, digest


def external(method, url, secret, **kwargs):
    try:
        response = httpx.request(
            method,
            url,
            headers={"Authorization": f"Bearer {secret}", **kwargs.pop("headers", {})},
            timeout=20,
            **kwargs,
        )
        response.raise_for_status()
        data = response.json()
        if data.get("status") is False:
            raise ValueError("Provider rejected request")
        return data
    except (httpx.HTTPError, ValueError):
        raise HTTPException(
            503,
            "Payment provider is unavailable or the attempt needs reconciliation. No order was marked paid.",
        ) from None


def guard_merchant(settings, company_id):
    if settings.payment_provider == "disabled":
        raise HTTPException(503, "Online payments are not configured for this shop")
    if settings.payment_provider != "sandbox" and settings.merchant_company_id != company_id:
        raise HTTPException(503, "This company does not have a configured merchant account")


def order_access(db, order_id, token, customer_id=None):
    order = db.get(Order, order_id)
    owned = order and customer_id and order.customer_id == customer_id
    if not order or not (owned or hmac.compare_digest(order.access_hash, digest(token or ""))):
        raise HTTPException(404, "Order not found")
    return order


def begin_payment(db, order_id, token, settings, customer_id=None):
    order_access(db, order_id, token, customer_id)
    order = db.scalar(
        select(Order).where(Order.id == order_id).with_for_update().execution_options(populate_existing=True)
    )
    guard_merchant(settings, order.company_id)
    if order.status == "RESERVED" and aware(order.expires_at) <= now():
        release(db, order, "EXPIRED")
        db.commit()
        raise HTTPException(409, "Reservation expired; please start checkout again")
    if order.status != "RESERVED":
        raise HTTPException(409, "This order is no longer awaiting checkout")
    attempt = db.scalar(select(PaymentAttempt).where(PaymentAttempt.order_id == order.id))
    if not attempt:
        attempt = PaymentAttempt(
            id=uid(), order_id=order.id, provider=settings.payment_provider, reference="honor-" + uid()
        )
        db.add(attempt)
    elif attempt.provider != settings.payment_provider:
        raise HTTPException(409, "The payment configuration changed; contact the company")
    db.commit()  # Persist the stable reference before any provider network call.
    if attempt.checkout_url:
        return {"url": attempt.checkout_url, "provider": attempt.provider}
    if attempt.provider == "sandbox":
        return {"url": None, "provider": "sandbox", "simulation": True}
    shop = (
        settings.shop_origin
        or settings.app_origin.rstrip("/") + "/shop/" + db.get(Company, order.company_id).slug
    )
    callback = shop.rstrip("/") + "/?order=" + order.id
    if attempt.provider == "paystack":
        data = external(
            "POST",
            "https://api.paystack.co/transaction/initialize",
            settings.payment_secret,
            json={
                "email": order.email,
                "amount": order.total_minor,
                "currency": order.currency,
                "reference": attempt.reference,
                "callback_url": callback,
            },
        )["data"]
        attempt.checkout_url, attempt.provider_id = data["authorization_url"], attempt.reference
    else:
        data = external(
            "POST",
            "https://api.stripe.com/v1/checkout/sessions",
            settings.payment_secret,
            headers={"Idempotency-Key": attempt.id},
            data={
                "mode": "payment",
                "customer_email": order.email,
                "client_reference_id": attempt.reference,
                "success_url": callback,
                "cancel_url": callback,
                "line_items[0][price_data][currency]": order.currency.lower(),
                "line_items[0][price_data][unit_amount]": str(order.total_minor),
                "line_items[0][price_data][product_data][name]": "Honor order " + order.id[:8],
                "line_items[0][quantity]": "1",
            },
        )
        attempt.checkout_url, attempt.provider_id = data["url"], data["id"]
    if not attempt.checkout_url.startswith("https://"):
        raise HTTPException(503, "Payment provider returned an invalid checkout address")
    db.commit()
    return {"url": attempt.checkout_url, "provider": attempt.provider}


def verify_signature(settings, provider, raw, signature):
    if provider != settings.payment_provider or provider not in {"paystack", "stripe"}:
        raise HTTPException(404, "Payment provider not configured")
    if provider == "paystack":
        expected = hmac.new(settings.payment_secret.encode(), raw, hashlib.sha512).hexdigest()
        valid = hmac.compare_digest(expected.encode(), (signature or "").encode())
    else:
        parts = [p.split("=", 1) for p in (signature or "").split(",") if "=" in p]
        stamps = [v for k, v in parts if k == "t"]
        signatures = [v for k, v in parts if k == "v1"]
        try:
            stamp = stamps[0]
            expected = hmac.new(
                settings.payment_webhook_secret.encode(), stamp.encode() + b"." + raw, hashlib.sha256
            ).hexdigest()
            valid = abs(time.time() - int(stamp)) <= 300 and any(
                hmac.compare_digest(expected.encode(), v.encode()) for v in signatures
            )
        except (IndexError, ValueError):
            valid = False
    if not valid:
        raise HTTPException(400, "Invalid payment signature")


def store_event(db, settings, provider, raw, signature):
    verify_signature(settings, provider, raw, signature)
    try:
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError()
        if provider == "paystack":
            reference = payload["data"]["reference"]
            event_key = str(payload["data"]["id"]) + ":" + payload["event"]
        else:
            reference = payload["data"]["object"].get("client_reference_id", "")
            event_key = payload["id"]
    except (ValueError, KeyError, TypeError):
        raise HTTPException(400, "Malformed payment event") from None
    event_id = digest(provider + ":" + event_key)
    attempt = db.scalar(
        select(PaymentAttempt).where(
            PaymentAttempt.reference == reference, PaymentAttempt.provider == provider
        )
    )
    if not attempt:
        return {"received": True}  # Valid but unrelated events do not disclose order existence.
    order = db.get(Order, attempt.order_id)
    guard_merchant(settings, order.company_id)
    inserted = db.scalar(
        insert(ProviderEvent)
        .values(id=event_id, provider=provider, payload=payload, processed=False, created_at=now())
        .on_conflict_do_nothing()
        .returning(ProviderEvent.id)
    )
    if inserted:
        db.add(Outbox(company_id=order.company_id, kind="PAYMENT_EVENT", payload={"event_id": event_id}))
    db.commit()
    return {"received": True}


def verified_payment(settings, attempt, event=None):
    if attempt.provider == "paystack":
        data = external(
            "GET", "https://api.paystack.co/transaction/verify/" + attempt.reference, settings.payment_secret
        )["data"]
        return {
            "paid": data["status"] == "success",
            "reference": data["reference"],
            "amount": data["amount"],
            "currency": data["currency"].upper(),
            "transaction": str(data["id"]),
        }
    session_id = attempt.provider_id or ((event or {}).get("data", {}).get("object", {}).get("id"))
    if not session_id or not session_id.startswith("cs_"):
        raise HTTPException(409, "Checkout session requires investigation")
    data = external(
        "GET", "https://api.stripe.com/v1/checkout/sessions/" + session_id, settings.payment_secret
    )
    return {
        "paid": data["payment_status"] == "paid",
        "reference": data["client_reference_id"],
        "amount": data["amount_total"],
        "currency": data["currency"].upper(),
        "transaction": data.get("payment_intent") or data["id"],
    }


def apply_verified(db, settings, attempt_id, verification):
    attempt = db.get(PaymentAttempt, attempt_id)
    order = db.scalar(
        select(Order)
        .where(Order.id == attempt.order_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    guard_merchant(settings, order.company_id)
    if not verification["paid"]:
        raise HTTPException(409, "Payment has not succeeded")
    if (
        verification["reference"] != attempt.reference
        or verification["amount"] != order.total_minor
        or verification["currency"] != order.currency
    ):
        raise HTTPException(409, "Payment amount, currency or reference does not match the order")
    if attempt.paid_reference and attempt.paid_reference != verification["transaction"]:
        raise HTTPException(409, "An additional transaction requires manual investigation")
    attempt.paid_reference = verification["transaction"]
    confirm_payment(db, order, verification["transaction"])


def process_event(db, settings, event_id):
    event = db.scalar(select(ProviderEvent).where(ProviderEvent.id == event_id).with_for_update())
    if not event or event.processed:
        return
    payload = event.payload
    relevant = (
        payload.get("event") == "charge.success"
        if event.provider == "paystack"
        else payload.get("type") in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}
    )
    if relevant:
        reference = (
            payload["data"]["reference"]
            if event.provider == "paystack"
            else payload["data"]["object"]["client_reference_id"]
        )
        attempt = db.scalar(
            select(PaymentAttempt).where(
                PaymentAttempt.reference == reference, PaymentAttempt.provider == event.provider
            )
        )
        verification = verified_payment(settings, attempt, payload)
        apply_verified(db, settings, attempt.id, verification)
    event.processed = True
    db.commit()


def simulate_payment(db, settings, order_id, token):
    if settings.environment != "development" or settings.payment_provider != "sandbox":
        raise HTTPException(404, "Not found")
    order_access(db, order_id, token)
    attempt = db.scalar(select(PaymentAttempt).where(PaymentAttempt.order_id == order_id))
    if not attempt:
        raise HTTPException(409, "Start checkout first")
    order = db.get(Order, order_id)
    apply_verified(
        db,
        settings,
        attempt.id,
        {
            "paid": True,
            "reference": attempt.reference,
            "amount": order.total_minor,
            "currency": order.currency,
            "transaction": "simulation:" + attempt.id,
        },
    )
    audit(db, order.company_id, "development", "payment.simulated", order_id=order.id)
    db.commit()
    return {"id": order.id, "payment_status": order.payment_status, "simulation": True}
