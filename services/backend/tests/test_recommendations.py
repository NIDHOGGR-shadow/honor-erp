from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from honor.models import Base, Company, Location, Order, OrderLine, Product
from honor.recommendations import catalogue_recommendations

AT = datetime(2026, 11, 6, 12, tzinfo=timezone.utc)


@pytest.fixture
def ranking_db():
    engine = create_engine("sqlite://", execution_options={"schema_translate_map": {"honor": None}})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add_all([Company(id="shop", name="Shop", slug="shop", currency="NGN", timezone="UTC"),
                    Company(id="other", name="Other", slug="other", currency="NGN", timezone="UTC")])
        db.flush()
        db.add(Location(id="store", company_id="shop", name="Store", address="Test location", fulfil_online=True))
        db.flush()
        yield db
    engine.dispose()


def product(db, identifier, price=10000, category="Phones", available=5, model=""):
    db.add(Product(id=identifier, company_id="shop", sku=identifier, name=identifier,
                   price_minor=price, category=category, model_name=model, published=True))
    db.flush()
    return {"id": identifier, "name": identifier, "price_minor": price, "category": category,
            "available": available, "model_name": model, "market": "Nigeria"}


def paid_order(db, identifier, product_id, days=1, quantity=1, returned=0, **overrides):
    order = dict(id=identifier, company_id="shop", location_id="store", customer_name="Test",
                 email="test@example.test", access_hash="not-a-live-key", total_minor=10000,
                 currency="NGN", payment_status="PAID", status="FULFILLED", paid_at=AT - timedelta(days=days),
                 expires_at=AT + timedelta(days=1))
    order.update(overrides)
    db.add(Order(**order))
    db.flush()
    db.add(OrderLine(order_id=identifier, product_id=product_id, company_id=order["company_id"],
                     name=product_id, quantity=quantity, returned_quantity=returned, price_minor=10000))
    db.flush()


def test_popular_is_recent_paid_sales_and_trending_requires_growth(ranking_db):
    db = ranking_db
    products = [product(db, "rising"), product(db, "steady"), product(db, "one-order")]
    for name in ["rising", "steady"]:
        for i in range(3):
            paid_order(db, name + str(i), name)
    for i in range(4):
        paid_order(db, "old" + str(i), "steady", days=9)
    paid_order(db, "wholesale", "one-order", quantity=100)
    result = catalogue_recommendations(db, "shop", products, AT)
    assert set(result["popular_product_ids"]) == {"rising", "steady"}
    assert result["trending_product_ids"] == ["rising"]
    assert "recent_units" not in str(result) and "example.test" not in str(result)


def test_unpaid_refunded_returned_other_tenant_and_out_of_stock_do_not_create_badges(ranking_db):
    db = ranking_db
    products = [product(db, "phone"), product(db, "sold-out", available=0)]
    for i in range(3):
        paid_order(db, "unpaid" + str(i), "phone", payment_status="UNPAID", status="RESERVED")
        paid_order(db, "refund" + str(i), "phone", payment_status="REFUNDED")
        paid_order(db, "returned" + str(i), "phone", returned=1)
        paid_order(db, "other" + str(i), "phone", company_id="other")
        paid_order(db, "future" + str(i), "phone", days=-1)
        paid_order(db, "stock" + str(i), "sold-out")
    result = catalogue_recommendations(db, "shop", products, AT)
    assert result["popular_product_ids"] == [] and result["trending_product_ids"] == []
    assert "sold-out" not in result["budget_product_ids"]


def test_budget_is_category_relative_deduplicated_and_works_without_sales(ranking_db):
    db = ranking_db
    products = [product(db, "phone-expensive", 90000, model="same"),
                product(db, "phone-cheap", 30000, model="same"),
                product(db, "other-phone", 50000), product(db, "cable", 1000, "Accessories")]
    result = catalogue_recommendations(db, "shop", products, AT)
    assert result["budget_product_ids"] == ["cable", "phone-cheap"]
    assert result["popular_product_ids"] == [] and result["trending_product_ids"] == []


def test_empty_catalogue_has_no_recommendations(ranking_db):
    assert catalogue_recommendations(ranking_db, "shop", [], AT) == {
        "popular_product_ids": [], "trending_product_ids": [], "budget_product_ids": [], "window_days": 7,
    }
