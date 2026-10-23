import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from honor.app import create_app
from honor.config import Settings
from honor.db import database
from honor.inventory import movement
from honor.models import (
    Balance,
    Base,
    Company,
    Identity,
    Location,
    LocationGrant,
    Membership,
    Product,
    SerialUnit,
)
from honor.security import hasher

PASSWORD = "A testing password with spaces!"


@pytest.fixture(scope="session")
def database_factory():
    url = os.environ.get("HONOR_TEST_DATABASE_URL")
    if not url or os.environ.get("HONOR_ALLOW_TEST_DATABASE_RESET") != "1":
        pytest.skip("Set an isolated HONOR_TEST_DATABASE_URL and HONOR_ALLOW_TEST_DATABASE_RESET=1")
    if "honor_test" not in url and os.environ.get("HONOR_EMBEDDED_TEST") != "1":
        raise RuntimeError("Refusing to reset a database without honor_test in its name")
    os.environ["HONOR_DATABASE_URL"] = url
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(config, "head")
    engine, factory = database(url)
    yield engine, factory
    engine.dispose()


@pytest.fixture()
def env(database_factory):
    engine, sessions = database_factory
    with engine.begin() as db:
        tables = ",".join("honor." + t.name for t in Base.metadata.sorted_tables)
        db.execute(text("TRUNCATE " + tables + " CASCADE"))
    settings = Settings(
        environment="development",
        auth_provider="development",
        payment_provider="sandbox",
        database_url=os.environ["HONOR_TEST_DATABASE_URL"],
        session_secret="test-only-secret-" + str(uuid4()),
        cookie_secure=False,
    )
    ids = {
        k: str(uuid4())
        for k in (
            "company",
            "other",
            "admin",
            "staff",
            "stranger",
            "main",
            "warehouse",
            "other_location",
            "charger",
            "phone",
            "other_product",
        )
    }
    with sessions() as db:
        db.add_all(
            [
                Company(
                    id=ids["company"], name="Test shop", slug="test-shop", currency="NGN", timezone="UTC"
                ),
                Company(
                    id=ids["other"], name="Other company", slug="other-shop", currency="USD", timezone="UTC"
                ),
                Identity(
                    id=ids["admin"],
                    email="admin@example.test",
                    name="Admin",
                    password_hash=hasher.hash(PASSWORD),
                ),
                Identity(
                    id=ids["staff"],
                    email="staff@example.test",
                    name="Staff",
                    password_hash=hasher.hash(PASSWORD),
                ),
                Identity(
                    id=ids["stranger"],
                    email="stranger@example.test",
                    name="Stranger",
                    password_hash=hasher.hash(PASSWORD),
                ),
            ]
        )
        db.flush()
        db.add_all(
            [
                Membership(company_id=ids["company"], user_id=ids["admin"], role="ADMIN"),
                Membership(company_id=ids["company"], user_id=ids["staff"], role="STOCK"),
                Membership(company_id=ids["other"], user_id=ids["stranger"], role="ADMIN"),
                Location(
                    id=ids["main"],
                    company_id=ids["company"],
                    name="Main",
                    fulfil_online=True,
                    address="Test collection address",
                ),
                Location(id=ids["warehouse"], company_id=ids["company"], name="Warehouse"),
                Location(id=ids["other_location"], company_id=ids["other"], name="Other location"),
            ]
        )
        db.flush()
        db.add(LocationGrant(company_id=ids["company"], user_id=ids["staff"], location_id=ids["main"]))
        db.add_all(
            [
                Product(
                    id=ids["charger"],
                    company_id=ids["company"],
                    sku="CHARGE",
                    name="Charger",
                    price_minor=10000,
                    cost_minor=6000,
                    published=True,
                    tracking="QUANTITY",
                ),
                Product(
                    id=ids["phone"],
                    company_id=ids["company"],
                    sku="PHONE",
                    name="Phone",
                    price_minor=200000,
                    cost_minor=150000,
                    published=True,
                    tracking="SERIAL",
                ),
                Product(
                    id=ids["other_product"],
                    company_id=ids["other"],
                    sku="SECRET",
                    name="Private item",
                    price_minor=500,
                    published=False,
                ),
            ]
        )
        db.flush()
        for product, quantity in [("charger", 10), ("phone", 1)]:
            db.add(
                Balance(
                    company_id=ids["company"],
                    product_id=ids[product],
                    location_id=ids["main"],
                    on_hand=quantity,
                )
            )
            movement(
                db, ids["company"], ids["admin"], ids[product], ids["main"], quantity, "OPENING", "test-seed"
            )
        db.add(
            SerialUnit(
                company_id=ids["company"],
                product_id=ids["phone"],
                location_id=ids["main"],
                serial="TEST-IMEI-001",
            )
        )
        db.commit()
    app = create_app(settings, sessions)
    with TestClient(app) as client:
        result = client.post("/api/v1/auth/login", json={"email": "admin@example.test", "password": PASSWORD})
        assert result.status_code == 200, result.text
        client.headers.update({"X-Company-Id": ids["company"]})
        yield {"app": app, "client": client, "sessions": sessions, "settings": settings, **ids}


def checkout(env, product="phone", quantity=1):
    key = str(uuid4()) + str(uuid4())
    result = env["client"].post(
        "/api/v1/storefront/test-shop/checkouts",
        headers={"Idempotency-Key": str(uuid4())},
        json={
            "customer_name": "Test buyer",
            "email": "buyer@example.test",
            "client_token": key,
            "lines": [{"product_id": env[product], "quantity": quantity}],
        },
    )
    return result, key


def paid_order(env, product="phone", quantity=1):
    result, key = checkout(env, product, quantity)
    assert result.status_code == 201, result.text
    order = result.json()
    headers = {"X-Order-Key": key}
    assert env["client"].post(f"/api/v1/checkouts/{order['id']}/payment", headers=headers).status_code == 200
    response = env["client"].post(f"/api/v1/checkouts/{order['id']}/simulate", headers=headers)
    assert response.status_code == 200, response.text
    return order, key
