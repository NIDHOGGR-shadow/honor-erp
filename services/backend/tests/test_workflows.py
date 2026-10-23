import hashlib
import hmac
import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError

from honor import payments
from honor.cli import reconcile
from honor.inventory import expire
from honor.models import Balance, Identity, LoginSession, Order, Outbox, ProviderEvent, SerialUnit, now
from conftest import PASSWORD, checkout, paid_order


def post(env, path, body=None, key=None, **headers):
    return env["client"].post(
        "/api/v1" + path, json=body, headers={"Idempotency-Key": key or str(uuid4()), **headers}
    )


def stock(env, product="phone", location="main"):
    with env["sessions"]() as db:
        x = db.get(Balance, (env["company"], env[product], env[location]))
        return (x.on_hand, x.reserved) if x else (0, 0)


def test_receipt_replay_and_changed_payload(env):
    body = {
        "product_id": env["charger"],
        "location_id": env["main"],
        "quantity": 2,
        "reason": "Supplier delivery",
        "serials": [],
    }
    key = str(uuid4())
    first = post(env, "/receipts", body, key)
    assert first.status_code == 200, first.text
    assert post(env, "/receipts", body, key).json() == first.json()
    assert stock(env, "charger") == (12, 0)
    assert post(env, "/receipts", {**body, "quantity": 3}, key).status_code == 409
    assert not any(reconcile(env["sessions"]).values())


def test_duplicate_serial_receipt_rolls_back_balance(env):
    body = {
        "product_id": env["phone"],
        "location_id": env["main"],
        "quantity": 2,
        "reason": "Checked delivery",
        "serials": ["NEW-001", "TEST-IMEI-001"],
    }
    assert post(env, "/receipts", body).status_code == 409
    assert stock(env) == (1, 0)
    with env["sessions"]() as db:
        assert db.scalar(select(func.count()).select_from(SerialUnit)) == 1


@pytest.mark.parametrize("quantity", [0, -1, 1.5, True, "2"])
def test_quantities_must_be_positive_integers(env, quantity):
    response = post(
        env,
        "/receipts",
        {
            "product_id": env["charger"],
            "location_id": env["main"],
            "quantity": quantity,
            "reason": "Checked delivery",
        },
    )
    assert response.status_code == 422
    assert stock(env, "charger") == (10, 0)


def test_customer_catalogue_redacts_internal_fields(env):
    response = env["client"].get("/api/v1/storefront/test-shop")
    assert response.status_code == 200
    raw = response.text
    assert "cost_minor" not in raw and "TEST-IMEI" not in raw and "company_id" not in raw
    assert len(response.json()["products"]) == 2


def test_checkout_reserves_without_physical_issue(env):
    response, token = checkout(env)
    assert response.status_code == 201, response.text
    assert stock(env) == (1, 1)
    assert checkout(env)[0].status_code == 409
    order = response.json()
    assert env["client"].get(f"/api/v1/customer/orders/{order['id']}").status_code == 404
    assert (
        env["client"]
        .get(f"/api/v1/customer/orders/{order['id']}", headers={"X-Order-Key": token})
        .status_code
        == 200
    )
    assert not any(reconcile(env["sessions"]).values())


def test_multiline_checkout_failure_leaves_all_stock_unchanged(env):
    response = post(
        env,
        "/storefront/test-shop/checkouts",
        {
            "customer_name": "Buyer",
            "email": "buyer@example.test",
            "client_token": str(uuid4()),
            "lines": [
                {"product_id": env["charger"], "quantity": 1},
                {"product_id": env["phone"], "quantity": 2},
            ],
        },
    )
    assert response.status_code == 409
    assert stock(env, "charger") == (10, 0) and stock(env) == (1, 0)


def test_paid_order_fulfilment_and_replay(env):
    order, token = paid_order(env)
    assert stock(env) == (1, 1)
    key = str(uuid4())
    response = post(env, f"/orders/{order['id']}/fulfil", key=key)
    assert response.status_code == 200, response.text
    assert post(env, f"/orders/{order['id']}/fulfil", key=key).status_code == 200
    assert post(env, f"/orders/{order['id']}/fulfil").status_code == 409
    assert stock(env) == (0, 0)
    assert not any(reconcile(env["sessions"]).values())


def test_unpaid_order_cannot_be_fulfilled_or_client_marked_paid(env):
    response, token = checkout(env)
    assert post(env, f"/orders/{response.json()['id']}/fulfil").status_code == 409
    response = post(
        env,
        "/storefront/test-shop/checkouts",
        {
            "customer_name": "Buyer",
            "email": "buyer@example.test",
            "client_token": str(uuid4()),
            "lines": [{"product_id": env["charger"], "quantity": 1}],
            "payment_status": "PAID",
        },
    )
    assert response.status_code == 422


def test_serial_return_reuses_unit_and_refuses_excess(env):
    order, _ = paid_order(env)
    assert post(env, f"/orders/{order['id']}/fulfil").status_code == 200
    body = {
        "product_id": env["phone"],
        "location_id": env["main"],
        "quantity": 1,
        "serials": ["TEST-IMEI-001"],
        "reason": "Inspected, unused",
        "restock": True,
    }
    assert post(env, f"/orders/{order['id']}/returns", body).status_code == 200
    assert post(env, f"/orders/{order['id']}/returns", body).status_code == 409
    with env["sessions"]() as db:
        assert db.scalar(select(func.count()).select_from(SerialUnit)) == 1
    assert stock(env) == (1, 0)
    assert not any(reconcile(env["sessions"]).values())


def test_transfer_unavailable_until_receipt(env):
    body = {
        "product_id": env["phone"],
        "location_id": env["main"],
        "destination_id": env["warehouse"],
        "quantity": 1,
        "serials": ["TEST-IMEI-001"],
        "reason": "Warehouse allocation",
    }
    response = post(env, "/transfers", body)
    assert response.status_code == 200, response.text
    assert stock(env) == (0, 0) and stock(env, location="warehouse") == (0, 0)
    assert post(env, f"/transfers/{response.json()['id']}/receive").status_code == 200
    assert stock(env, location="warehouse") == (1, 0)
    assert post(env, f"/transfers/{response.json()['id']}/receive").status_code == 409
    assert not any(reconcile(env["sessions"]).values())


def test_expiry_releases_stock_and_late_payment_does_not_oversell(env):
    response, token = checkout(env)
    order_id = response.json()["id"]
    assert (
        env["client"]
        .post(f"/api/v1/checkouts/{order_id}/payment", headers={"X-Order-Key": token})
        .status_code
        == 200
    )
    with env["sessions"]() as db:
        db.get(Order, order_id).expires_at = now() - timedelta(minutes=1)
        db.commit()
        expire(db)
        db.commit()
    assert stock(env) == (1, 0)
    assert checkout(env)[0].status_code == 201
    assert (
        env["client"]
        .post(f"/api/v1/checkouts/{order_id}/simulate", headers={"X-Order-Key": token})
        .status_code
        == 200
    )
    with env["sessions"]() as db:
        assert db.get(Order, order_id).payment_status == "REFUND_REQUIRED"
    assert stock(env) == (1, 1)
    assert not any(reconcile(env["sessions"]).values())


def test_cross_company_and_location_requests_are_denied(env):
    body = {
        "product_id": env["other_product"],
        "location_id": env["main"],
        "quantity": 1,
        "reason": "Checked delivery",
    }
    assert post(env, "/receipts", body).status_code == 404
    with TestClient(env["app"]) as staff:
        assert (
            staff.post(
                "/api/v1/auth/login", json={"email": "staff@example.test", "password": PASSWORD}
            ).status_code
            == 200
        )
        staff.headers.update({"X-Company-Id": env["company"]})
        response = staff.post(
            "/api/v1/receipts",
            headers={"Idempotency-Key": str(uuid4())},
            json={**body, "product_id": env["charger"], "location_id": env["warehouse"]},
        )
        assert response.status_code == 403
        staff.headers.update({"X-Company-Id": env["other"]})
        assert staff.get("/api/v1/products").status_code == 403


def test_suspend_and_force_signout_take_effect_for_existing_sessions(env):
    with TestClient(env["app"]) as staff:
        staff.post("/api/v1/auth/login", json={"email": "staff@example.test", "password": PASSWORD})
        staff.headers.update({"X-Company-Id": env["company"]})
        assert staff.get("/api/v1/products").status_code == 200
        assert post(env, f"/team/{env['staff']}/sign-out").status_code == 200
        assert staff.get("/api/v1/products").status_code == 403
        staff.post("/api/v1/auth/login", json={"email": "staff@example.test", "password": PASSWORD})
        assert staff.get("/api/v1/products").status_code == 200
        result = env["client"].patch(
            f"/api/v1/team/{env['staff']}",
            json={"role": "STOCK", "active": False, "location_ids": [env["main"]]},
        )
        assert result.status_code == 200, result.text
        assert staff.get("/api/v1/products").status_code == 403


def test_last_admin_and_stale_verification_are_protected(env):
    response = env["client"].patch(
        f"/api/v1/team/{env['admin']}", json={"role": "SALES", "active": True, "location_ids": [env["main"]]}
    )
    assert response.status_code == 409
    with env["sessions"]() as db:
        for active in db.scalars(select(LoginSession)):
            active.verified_at = now() - timedelta(minutes=6)
        db.commit()
    assert post(env, f"/team/{env['staff']}/sign-out").status_code == 403


def test_password_change_hashes_password_and_revokes_other_sessions(env):
    with TestClient(env["app"]) as other:
        other.post("/api/v1/auth/login", json={"email": "admin@example.test", "password": PASSWORD})
        response = post(
            env,
            "/auth/password",
            {"current_password": PASSWORD, "new_password": "A changed password with spaces!"},
        )
        assert response.status_code == 200, response.text
        assert other.get("/api/v1/me").status_code == 401
    with env["sessions"]() as db:
        assert db.get(Identity, env["admin"]).password_hash.startswith("$argon2")


def test_invitation_is_email_bound_single_use_and_server_assigns_role(env):
    invited = post(
        env,
        "/invitations",
        {"email": "stranger@example.test", "role": "SALES", "location_ids": [env["main"]], "active": True},
    )
    assert invited.status_code == 201, invited.text
    token = invited.json()["development_link"].split("invite=")[1]
    assert post(env, "/invitations/accept", {"token": token}).status_code == 400
    with TestClient(env["app"]) as user:
        user.post("/api/v1/auth/login", json={"email": "stranger@example.test", "password": PASSWORD})
        assert (
            user.post("/api/v1/invitations/accept", json={"token": token, "role": "ADMIN"}).status_code == 422
        )
        assert user.post("/api/v1/invitations/accept", json={"token": token}).status_code == 200
        assert user.post("/api/v1/invitations/accept", json={"token": token}).status_code == 400
        user.headers.update({"X-Company-Id": env["company"]})
        assert "cost_minor" not in user.get("/api/v1/products").text
        assert user.get("/api/v1/team").status_code == 403


def test_untrusted_origin_cannot_write_using_session_cookie(env):
    response = env["client"].post(
        "/api/v1/locations", json={"name": "Injected"}, headers={"Origin": "https://attacker.invalid"}
    )
    assert response.status_code == 403


def test_append_only_history_is_enforced_in_postgres(env):
    with env["sessions"]() as db:
        with pytest.raises(SQLAlchemyError):
            db.execute(text("UPDATE honor.stock_movements SET delta=99"))
        db.rollback()


def test_validation_does_not_echo_passwords(env):
    response = post(env, "/auth/login", {"email": "invalid", "password": "never-echo-this", "role": "ADMIN"})
    assert response.status_code == 422 and "never-echo-this" not in response.text


def test_signed_duplicate_webhooks_process_payment_once(env, monkeypatch):
    result, token = checkout(env, "charger", 1)
    order_id = result.json()["id"]
    env["client"].post(f"/api/v1/checkouts/{order_id}/payment", headers={"X-Order-Key": token})
    settings = env["settings"]
    settings.payment_provider, settings.payment_secret, settings.merchant_company_id = (
        "paystack",
        "test-webhook-secret",
        env["company"],
    )
    from honor.models import PaymentAttempt

    with env["sessions"]() as db:
        attempt = db.scalar(select(PaymentAttempt).where(PaymentAttempt.order_id == order_id))
        attempt.provider = "paystack"
        db.commit()
        reference = attempt.reference
    raw = json.dumps({"event": "charge.success", "data": {"id": 1234, "reference": reference}}).encode()
    signature = hmac.new(settings.payment_secret.encode(), raw, hashlib.sha512).hexdigest()
    path = "/api/v1/payment-webhooks/paystack"
    assert env["client"].post(path, content=raw, headers={"x-paystack-signature": "bad"}).status_code == 400
    for _ in range(2):
        assert (
            env["client"].post(path, content=raw, headers={"x-paystack-signature": signature}).status_code
            == 200
        )
    verification = {
        "paid": True,
        "reference": reference,
        "amount": 10000,
        "currency": "NGN",
        "transaction": "1234",
    }
    monkeypatch.setattr(payments, "verified_payment", lambda *args: verification)
    with env["sessions"]() as db:
        assert db.scalar(select(func.count()).select_from(ProviderEvent)) == 1
        event_id = db.scalar(select(ProviderEvent.id))
        payments.process_event(db, settings, event_id)
        payments.process_event(db, settings, event_id)
        assert db.get(Order, order_id).payment_status == "PAID"
        assert db.scalar(select(func.count()).select_from(Outbox).where(Outbox.kind == "ORDER_EMAIL")) == 1
    assert stock(env, "charger") == (10, 1)


def test_wrong_payment_amount_is_not_accepted(env):
    result, token = checkout(env)
    order_id = result.json()["id"]
    env["client"].post(f"/api/v1/checkouts/{order_id}/payment", headers={"X-Order-Key": token})
    from honor.models import PaymentAttempt

    with env["sessions"]() as db:
        attempt = db.scalar(select(PaymentAttempt).where(PaymentAttempt.order_id == order_id))
        with pytest.raises(Exception) as failure:
            payments.apply_verified(
                db,
                env["settings"],
                attempt.id,
                {
                    "paid": True,
                    "reference": attempt.reference,
                    "amount": 1,
                    "currency": "NGN",
                    "transaction": "bad",
                },
            )
        assert failure.value.status_code == 409
        db.rollback()
        assert db.get(Order, order_id).payment_status == "UNPAID"


def test_production_rejects_simulated_identity_and_payments():
    from honor.config import Settings

    with pytest.raises(ValueError):
        Settings(
            environment="production",
            auth_provider="development",
            payment_provider="sandbox",
            session_secret="a" * 40,
            database_url="postgresql+psycopg://localhost/honor",
        )


def test_warehouse_stock_is_not_advertised_for_collection(env):
    body = {
        "product_id": env["phone"],
        "location_id": env["main"],
        "destination_id": env["warehouse"],
        "quantity": 1,
        "serials": ["TEST-IMEI-001"],
        "reason": "Warehouse allocation",
    }
    result = post(env, "/transfers", body)
    assert result.status_code == 200
    assert post(env, f"/transfers/{result.json()['id']}/receive").status_code == 200
    products = env["client"].get("/api/v1/storefront/test-shop").json()["products"]
    assert next(p for p in products if p["id"] == env["phone"])["available"] == 0
    assert checkout(env)[0].status_code == 409


def test_failed_email_job_remains_visible_and_retriable(env):
    from honor.jobs import run_once

    with env["sessions"]() as db:
        db.add(
            Outbox(
                company_id=env["company"],
                kind="INVITATION_EMAIL",
                payload={"email": "invite@example.test", "url": "https://example.test/invitation"},
            )
        )
        db.commit()
    assert run_once(env["sessions"], env["settings"])
    with env["sessions"]() as db:
        job = db.scalar(select(Outbox))
        assert job.status == "PENDING" and job.attempts == 1
        assert job.last_error == "RuntimeError"


def test_collection_address_is_in_private_order_details(env):
    result, token = checkout(env)
    details = (
        env["client"]
        .get(f"/api/v1/customer/orders/{result.json()['id']}", headers={"X-Order-Key": token})
        .json()
    )
    assert details["collection_location"] == {"name": "Main", "address": "Test collection address"}


@pytest.mark.skipif(
    os.environ.get("HONOR_EMBEDDED_TEST") == "1",
    reason="Native PostgreSQL required to verify concurrent transactions; embedded backend serializes connections",
)
def test_two_concurrent_buyers_cannot_reserve_last_unit(env):
    gate = Barrier(2)

    def buy(_):
        with TestClient(env["app"]) as buyer:
            gate.wait(timeout=10)
            return buyer.post(
                "/api/v1/storefront/test-shop/checkouts",
                headers={"Idempotency-Key": str(uuid4())},
                json={
                    "customer_name": "Concurrent buyer",
                    "email": "buyer@example.test",
                    "client_token": str(uuid4()),
                    "lines": [{"product_id": env["phone"], "quantity": 1}],
                },
            ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(buy, range(2)))
    assert sorted(results) == [201, 409]
    assert stock(env) == (1, 1)
    assert not any(reconcile(env["sessions"]).values())
