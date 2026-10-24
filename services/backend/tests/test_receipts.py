from uuid import uuid4
import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest

from fastapi.testclient import TestClient
from sqlalchemy import select

from honor import payments
from honor.app import create_app
from honor.config import Settings
from honor.models import OrderLine, PaymentAttempt, SerialUnit
from honor.receipts import receipt_data
from honor.cli import reconcile
from conftest import PASSWORD, checkout, paid_order
from test_workflows import post, stock


def test_private_receipt_waits_for_verified_payment_and_handover(env):
    response, key = checkout(env)
    order_id = response.json()["id"]
    url = f"/api/v1/customer/orders/{order_id}/receipt.pdf"
    assert env["client"].get(url).status_code == 409
    env["client"].post(f"/api/v1/checkouts/{order_id}/payment", headers={"X-Order-Key": key})
    env["client"].post(f"/api/v1/checkouts/{order_id}/simulate", headers={"X-Order-Key": key})
    with env["sessions"]() as db:
        from honor.models import Order

        data = receipt_data(db, db.get(Order, order_id))
        assert data["paid_at"] and not data["fulfilled_at"]
        assert data["lines"][0]["device_pending"] and data["lines"][0]["serials"] == []
    response = env["client"].get(url)
    assert response.status_code == 200 and response.content.startswith(b"%PDF-")
    assert "no-store" in response.headers["cache-control"]
    with TestClient(env["app"]) as stranger:
        assert stranger.get(url).status_code == 404
        stranger.post("/api/v1/auth/login", json={"email": "stranger@example.test", "password": PASSWORD})
        assert stranger.get(url).status_code == 404
        assert stranger.get(url, headers={"X-Order-Key": "wrong"}).status_code == 404
    assert post(env, f"/orders/{order_id}/fulfil").status_code == 200
    detail = env["client"].get(f"/api/v1/customer/orders/{order_id}").json()
    assert detail["lines"][0]["serials"] == ["TEST-IMEI-001"]
    assert detail["fulfilled_at"] and detail["receipt_ready"]
    with TestClient(env["app"]) as guest:
        assert guest.get(url, headers={"X-Order-Key": key}).status_code == 200


def test_handover_rejects_missing_unknown_or_duplicate_identifiers_without_stock_issue(env):
    order, _ = paid_order(env)
    path = f"/orders/{order['id']}/fulfil"
    assert post(env, path, {"devices": []}).status_code == 422
    assert (
        post(env, path, {"devices": [{"product_id": env["phone"], "serials": ["UNKNOWN"]}]}).status_code
        == 409
    )
    assert (
        post(
            env,
            path,
            {"devices": [{"product_id": env["phone"], "serials": ["TEST-IMEI-001", "TEST-IMEI-001"]}]},
        ).status_code
        == 422
    )
    assert stock(env) == (1, 1)
    assert env["client"].get(f"/api/v1/customer/orders/{order['id']}").json()["lines"][0]["serials"] == []


def test_quantity_items_need_no_device_scan(env):
    order, _ = paid_order(env, "charger")
    assert post(env, f"/orders/{order['id']}/fulfil", {"devices": []}).status_code == 200
    assert stock(env, "charger") == (9, 0)
    detail = env["client"].get(f"/api/v1/customer/orders/{order['id']}").json()
    assert detail["receipt_ready"] and detail["lines"][0]["serials"] == []
    assert not any(reconcile(env["sessions"]).values())


def test_handover_can_issue_another_available_device_and_receipt_survives_return(env):
    order, _ = paid_order(env)
    assert (
        post(
            env,
            "/receipts",
            {
                "product_id": env["phone"],
                "location_id": env["main"],
                "quantity": 1,
                "serials": ["ACTUAL-HANDOVER"],
                "reason": "Checked delivery",
            },
        ).status_code
        == 200
    )
    payload = {"devices": [{"product_id": env["phone"], "serials": ["ACTUAL-HANDOVER"]}]}
    key = str(uuid4())
    path = f"/orders/{order['id']}/fulfil"
    assert post(env, path, payload, key).status_code == 200
    assert post(env, path, payload, key).status_code == 200
    assert (
        post(
            env, path, {"devices": [{"product_id": env["phone"], "serials": ["TEST-IMEI-001"]}]}, key
        ).status_code
        == 409
    )
    assert stock(env) == (1, 0)
    with env["sessions"]() as db:
        units = {u.serial: u.status for u in db.scalars(select(SerialUnit))}
        assert units == {"TEST-IMEI-001": "AVAILABLE", "ACTUAL-HANDOVER": "SOLD"}
    assert (
        post(
            env,
            f"/orders/{order['id']}/returns",
            {
                "product_id": env["phone"],
                "location_id": env["main"],
                "quantity": 1,
                "serials": ["ACTUAL-HANDOVER"],
                "restock": True,
                "reason": "Inspected returned phone",
            },
        ).status_code
        == 200
    )
    with env["sessions"]() as db:
        assert db.get(OrderLine, (order["id"], env["phone"])).serials == ["ACTUAL-HANDOVER"]
    detail = env["client"].get(f"/api/v1/customer/orders/{order['id']}").json()
    assert detail["lines"][0]["serials"] == ["ACTUAL-HANDOVER"]
    found = env["client"].get("/api/v1/stock/serial-search", params={"serial": "ACTUAL-HANDOVER"}).json()
    assert found["status"] == "AVAILABLE" and found["sales"][0]["order_id"] == order["id"]
    assert not any(reconcile(env["sessions"]).values())


@pytest.mark.skipif(
    os.environ.get("HONOR_EMBEDDED_TEST") == "1", reason="Requires native concurrent PostgreSQL"
)
def test_two_paid_orders_cannot_hand_over_the_same_available_device(env):
    first, _ = paid_order(env)
    assert (
        post(
            env,
            "/receipts",
            {
                "product_id": env["phone"],
                "location_id": env["main"],
                "quantity": 2,
                "serials": ["SECOND-DEVICE", "SHARED-SCAN"],
                "reason": "Checked delivery",
            },
        ).status_code
        == 200
    )
    second, _ = paid_order(env)
    barrier = Barrier(2)

    def handover(order):
        with TestClient(env["app"]) as staff:
            staff.post("/api/v1/auth/login", json={"email": "admin@example.test", "password": PASSWORD})
            staff.headers.update({"X-Company-Id": env["company"], "Idempotency-Key": str(uuid4())})
            barrier.wait(timeout=10)
            return staff.post(
                f"/api/v1/orders/{order['id']}/fulfil",
                json={"devices": [{"product_id": env["phone"], "serials": ["SHARED-SCAN"]}]},
            ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(handover, [first, second]))
    assert sorted(results) == [200, 409]
    assert stock(env) == (2, 1)
    assert not any(reconcile(env["sessions"]).values())


def test_device_reserved_for_another_buyer_cannot_be_substituted(env):
    first, _ = paid_order(env)
    post(
        env,
        "/receipts",
        {
            "product_id": env["phone"],
            "location_id": env["main"],
            "quantity": 1,
            "serials": ["SECOND-DEVICE"],
            "reason": "Checked delivery",
        },
    )
    second, _ = paid_order(env)
    response = post(
        env,
        f"/orders/{first['id']}/fulfil",
        {"devices": [{"product_id": env["phone"], "serials": ["SECOND-DEVICE"]}]},
    )
    assert response.status_code == 409 and stock(env) == (2, 2)
    assert env["client"].get(f"/api/v1/customer/orders/{second['id']}").json()["status"] == "PAID"


def test_imei_search_requires_staff_role_and_permitted_location(env):
    with TestClient(env["app"]) as guest:
        assert guest.get("/api/v1/stock/serial-search?serial=TEST-IMEI-001").status_code == 401
        guest.post("/api/v1/auth/login", json={"email": "stranger@example.test", "password": PASSWORD})
        guest.headers.update({"X-Company-Id": env["other"]})
        assert guest.get("/api/v1/stock/serial-search?serial=TEST-IMEI-001").status_code == 404
    with env["sessions"]() as db:
        from honor.models import Membership

        db.get(Membership, (env["company"], env["staff"])).role = "SALES"
        db.commit()
    with TestClient(env["app"]) as sales:
        sales.post("/api/v1/auth/login", json={"email": "staff@example.test", "password": PASSWORD})
        sales.headers.update({"X-Company-Id": env["company"]})
        assert sales.get("/api/v1/stock/serial-search?serial=TEST-IMEI-001").status_code == 403


def test_paystack_channels_and_payment_check_are_server_authoritative(env, monkeypatch):
    response, token = checkout(env)
    order_id = response.json()["id"]
    settings = Settings(
        **{
            **env["settings"].model_dump(),
            "payment_provider": "paystack",
            "payment_secret": "test-only-provider-secret",
            "merchant_company_id": env["company"],
        }
    )
    initializations = []
    verification = {
        "status": "success",
        "amount": 200000,
        "currency": "NGN",
        "id": "bank-transaction",
        "channel": "bank_transfer",
    }

    def external(method, url, secret, **kwargs):
        if method == "POST":
            initializations.append(kwargs["json"])
            return {"data": {"authorization_url": "https://checkout.paystack.com/test"}}
        return {"data": {**verification, "reference": initializations[0]["reference"]}}

    monkeypatch.setattr(payments, "external", external)
    app = create_app(settings, env["sessions"])
    with TestClient(app) as customer:
        assert customer.post("/api/v1/auth/login", json={"email": "admin@example.test", "password": PASSWORD}).status_code == 200
        headers = {"X-Order-Key": token}
        pay = f"/api/v1/checkouts/{order_id}/payment"
        assert customer.post(pay, headers=headers).status_code == 200
        assert customer.post(pay, headers=headers).status_code == 200
        assert len(initializations) == 1 and initializations[0]["channels"] == ["card", "bank_transfer"]
        assert customer.get("/api/v1/storefront/test-shop").json()["payment_methods"] == [
            "card",
            "bank_transfer",
        ]
        verify = f"/api/v1/customer/orders/{order_id}/verify-payment"
        with TestClient(app) as signed_out:
            assert signed_out.post(verify).status_code == 401
        verification["amount"] = 1
        assert customer.post(verify, headers=headers).status_code == 409
        assert (
            customer.get(f"/api/v1/customer/orders/{order_id}/receipt.pdf", headers=headers).status_code == 409
        )
        verification["amount"] = 200000
        assert customer.post(verify, headers=headers).json()["payment_status"] == "PAID"
        assert customer.post(verify, headers=headers).status_code == 200
        with env["sessions"]() as db:
            attempt = db.scalar(select(PaymentAttempt).where(PaymentAttempt.order_id == order_id))
            assert attempt.channel == "bank_transfer" and attempt.paid_reference == "bank-transaction"
