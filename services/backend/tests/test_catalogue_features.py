from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import select

from conftest import PASSWORD, checkout
from honor.models import Audit, Balance, Order, Product
from honor.schemas import ProductInput


def test_variant_metadata_round_trips_without_exposing_costs(env):
    response = env["client"].post("/api/v1/products", json={
        "sku": "VARIANT-BLACK", "name": "Phone black 256 GB", "model_name": "Phone family",
        "colour": "Black", "memory": "8 / 256 GB", "market": "Nigeria", "category": "Phones",
        "source_url": "https://www.honor.com/ng/", "price_minor": 123456,
        "cost_minor": 99999, "published": True,
    })
    assert response.status_code == 201, response.text
    catalogue = env["client"].get("/api/v1/storefront/test-shop").json()
    product = next(p for p in catalogue["products"] if p["id"] == response.json()["id"])
    assert product["colour"] == "Black" and product["memory"] == "8 / 256 GB"
    assert product["model_name"] == "Phone family" and product["market"] == "Nigeria"
    assert "cost_minor" not in product and product["available"] == 0


@pytest.mark.parametrize("field", ["image_url", "source_url"])
@pytest.mark.parametrize("url", ["http://example.test/image", "https://", "javascript:alert(1)",
                                "https://user:pass@example.test/"])
def test_product_links_require_valid_https_without_embedded_credentials(field, url):
    with pytest.raises(ValidationError):
        ProductInput(sku="SKU", name="Product", price_minor=100, **{field: url})


def test_price_update_is_audited_and_preserves_existing_order_price(env):
    response, _ = checkout(env)
    assert response.status_code == 201, response.text
    order_id, old_total = response.json()["id"], response.json()["total_minor"]
    response = env["client"].patch(f'/api/v1/products/{env["phone"]}/price', json={
        "price_minor": old_total + 1000, "expected_price_minor": old_total,
        "reason": "Supplier price changed",
    })
    assert response.status_code == 200, response.text
    with env["sessions"]() as db:
        assert db.get(Order, order_id).total_minor == old_total
        change = db.scalar(select(Audit).where(Audit.action == "product.price_changed"))
        assert change.details["old_price_minor"] == old_total
        assert change.details["new_price_minor"] == old_total + 1000
        assert change.actor_id == env["admin"]
    stale = env["client"].patch(f'/api/v1/products/{env["phone"]}/price', json={
        "price_minor": 1, "expected_price_minor": old_total, "reason": "An outdated edit",
    })
    assert stale.status_code == 409


def test_stock_staff_cannot_change_a_selling_price(env):
    env["client"].post("/api/v1/auth/login", json={"email": "staff@example.test", "password": PASSWORD})
    response = env["client"].patch(f'/api/v1/products/{env["phone"]}/price', json={
        "price_minor": 1, "expected_price_minor": 1, "reason": "Unapproved price change",
    })
    assert response.status_code == 403


def test_checkout_rejects_changed_prices_before_reserving_stock(env):
    response = env["client"].post("/api/v1/storefront/test-shop/checkouts", json={
        "customer_name": "Customer", "email": "admin@example.test", "client_token": str(uuid4()),
        "lines": [{"product_id": env["phone"], "quantity": 1}], "expected_total_minor": 1,
    }, headers={"Idempotency-Key": str(uuid4())})
    assert response.status_code == 409
    with env["sessions"]() as db:
        assert db.get(Balance, (env["company"], env["phone"], env["main"])).reserved == 0
        assert db.scalar(select(Order.id)) is None


def test_collection_availability_excludes_private_warehouse_stock(env):
    with env["sessions"]() as db:
        db.add(Balance(company_id=env["company"], product_id=env["phone"],
                       location_id=env["warehouse"], on_hand=999, reserved=0))
        db.commit()
    catalogue = env["client"].get("/api/v1/storefront/test-shop").json()
    product = next(p for p in catalogue["products"] if p["id"] == env["phone"])
    assert product["available"] == 1
    assert product["location_availability"] == [{"location_id": env["main"], "available": 1}]
    assert env["warehouse"] not in str(catalogue)


def test_full_product_edit_rejects_a_stale_price(env):
    product = next(p for p in env["client"].get("/api/v1/products").json() if p["id"] == env["phone"])
    old_price = product["price_minor"]
    with env["sessions"]() as db:
        db.get(Product, env["phone"]).price_minor = old_price + 100
        db.commit()
    body = {key: value for key, value in product.items() if key != "id"}
    response = env["client"].put(f'/api/v1/products/{env["phone"]}', json={
        **body, "expected_price_minor": old_price,
    })
    assert response.status_code == 409


def test_admin_content_changes_reach_the_customer_catalogue_and_are_audited(env):
    content = {"heading": "Shop by category", "introduction": "Available products",
               "collection_heading": "Our collection locations"}
    response = env["client"].put("/api/v1/company/storefront-content", json=content)
    assert response.status_code == 200, response.text
    assert env["client"].get("/api/v1/storefront/test-shop").json()["company"]["storefront_content"] == content
    assert env["client"].get("/api/v1/me").json()["companies"][0]["storefront_content"] == content
    with env["sessions"]() as db:
        assert db.scalar(select(Audit.id).where(Audit.action == "storefront.content_updated"))
    env["client"].post("/api/v1/auth/login", json={"email": "staff@example.test", "password": PASSWORD})
    assert env["client"].put("/api/v1/company/storefront-content", json=content).status_code == 403

