"""Explainable catalogue ranking from paid orders; no customer data leaves this module."""
from datetime import datetime, timedelta
from math import ceil

from sqlalchemy import case, distinct, func, select
from sqlalchemy.orm import Session

from .models import Order, OrderLine, now


def catalogue_recommendations(db: Session, company_id: str, products: list[dict], at: datetime | None = None):
    at = at or now()
    recent_start, prior_start = at - timedelta(days=7), at - timedelta(days=14)
    available = {p["id"]: p for p in products if p["available"] > 0}
    result = {"popular_product_ids": [], "trending_product_ids": [], "budget_product_ids": [], "window_days": 7}
    if not available:
        return result
    net_units = OrderLine.quantity - OrderLine.returned_quantity
    recent = Order.paid_at >= recent_start
    rows = db.execute(
        select(
            OrderLine.product_id,
            func.sum(case((recent, net_units), else_=0)).label("recent_units"),
            func.sum(case((Order.paid_at < recent_start, net_units), else_=0)).label("prior_units"),
            func.count(distinct(case((recent, Order.id), else_=None))).label("recent_orders"),
        )
        .join(Order, (Order.id == OrderLine.order_id) & (Order.company_id == OrderLine.company_id))
        .where(
            Order.company_id == company_id, OrderLine.company_id == company_id,
            OrderLine.product_id.in_(available), Order.payment_status == "PAID",
            Order.status.in_(["PAID", "FULFILLED"]), Order.paid_at >= prior_start,
            Order.paid_at <= at, net_units > 0,
        )
        .group_by(OrderLine.product_id)
    ).all()
    eligible = [row for row in rows if row.recent_units >= 3 and row.recent_orders >= 3]
    eligible.sort(key=lambda row: (-row.recent_units, -row.recent_orders, row.product_id))
    result["popular_product_ids"] = [row.product_id for row in eligible][:12]
    growing = [row for row in eligible if row.recent_units > row.prior_units
               and row.recent_units * 4 >= row.prior_units * 5]
    growing.sort(key=lambda row: (-(row.recent_units - row.prior_units), -row.recent_units, row.product_id))
    result["trending_product_ids"] = [row.product_id for row in growing][:12]
    # Compare prices within a category, and keep one available variant per model/market.
    categories: dict[str, dict[tuple, dict]] = {}
    for product in available.values():
        category = categories.setdefault(product["category"], {})
        model = (product.get("model_name") or product["id"], product.get("market") or "")
        previous = category.get(model)
        if previous is None or (product["price_minor"], product["id"]) < (previous["price_minor"], previous["id"]):
            category[model] = product
    for category in sorted(categories):
        ranked = sorted(categories[category].values(), key=lambda p: (p["price_minor"], p["id"]))
        result["budget_product_ids"].extend(p["id"] for p in ranked[:max(1, ceil(len(ranked) / 4))])
    return result
