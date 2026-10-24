import argparse
import getpass
import os
from sqlalchemy import select, text
from .config import get_settings
from .db import database
from .inventory import audit, movement
from .models import (
    Balance,
    Company,
    Identity,
    Location,
    LoginSession,
    Membership,
    Product,
    SerialUnit,
    now,
    uid,
)
from .security import hasher


def seed(settings, sessions, email, password, currency="NGN"):
    if settings.environment != "development" or settings.auth_provider != "development":
        raise RuntimeError("Fictional fixtures are only allowed with development identity")
    if len(password) < 12:
        raise ValueError("Use at least 12 characters")
    with sessions() as db:
        if db.scalar(select(Company.id).where(Company.slug == "honor-demo")):
            raise RuntimeError("The demo already exists; refusing to overwrite records")
        user = Identity(
            id=uid(), email=email.lower(), name="Demo administrator", password_hash=hasher.hash(password)
        )
        company = Company(
            id=uid(), name="Honor Demo", slug="honor-demo", currency=currency, timezone="Africa/Lagos"
        )
        db.add_all([user, company])
        db.flush()
        db.add(Membership(company_id=company.id, user_id=user.id, role="ADMIN"))
        location = Location(
            id=uid(),
            company_id=company.id,
            name="Main store",
            fulfil_online=True,
            address="Fictional collection location · demonstration only",
        )
        second = Location(id=uid(), company_id=company.id, name="Warehouse")
        db.add_all([location, second])
        examples = [
            ("HN-PHONE-01", "Phone · 128 GB / midnight", "Phones", "SERIAL", 24500000, 20500000, 3, 2),
            ("HN-PHONE-02", "Phone · 256 GB / silver", "Phones", "SERIAL", 38500000, 32500000, 1, 2),
            ("HN-CHARGE-01", "USB-C fast charger · 20 W", "Accessories", "QUANTITY", 850000, 500000, 24, 8),
            ("HN-CABLE-01", "Braided USB-C cable · 1 m", "Accessories", "QUANTITY", 350000, 180000, 6, 10),
            ("HN-AUDIO-01", "Wireless earbuds · white", "Audio", "QUANTITY", 1950000, 1350000, 12, 4),
            ("HN-CASE-01", "Protective phone case · clear", "Accessories", "QUANTITY", 450000, 200000, 18, 5),
        ]
        db.flush()
        for sku, name, category, tracking, price, cost, quantity, point in examples:
            product = Product(
                id=uid(),
                company_id=company.id,
                sku=sku,
                name=name,
                category=category,
                tracking=tracking,
                price_minor=price,
                cost_minor=cost,
                reorder_point=point,
                published=True,
                description="Fictional demonstration item. Collection from the main store.",
            )
            db.add(product)
            db.flush()
            db.add(
                Balance(
                    company_id=company.id, product_id=product.id, location_id=location.id, on_hand=quantity
                )
            )
            for n in range(quantity if tracking == "SERIAL" else 0):
                db.add(
                    SerialUnit(
                        company_id=company.id,
                        product_id=product.id,
                        location_id=location.id,
                        serial=f"DEMO-{sku}-{n + 1:03}",
                    )
                )
            movement(
                db,
                company.id,
                user.id,
                product.id,
                location.id,
                quantity,
                "OPENING",
                "demo-seed",
                "Reviewed fictional opening stock",
            )
        audit(db, company.id, user.id, "development.seeded")
        db.commit()
        return company.id


def reconcile(sessions):
    # Include keys present only in the ledger so missing projections are also detected.
    with sessions() as db:
        mismatches = db.execute(
            text("""SELECT COALESCE(b.company_id, m.company_id), COALESCE(b.product_id,m.product_id),
            COALESCE(b.location_id,m.location_id), COALESCE(b.on_hand,0), COALESCE(m.qty,0)
            FROM honor.stock_balances b FULL JOIN
            (SELECT company_id, product_id, location_id, SUM(delta) qty FROM honor.stock_movements GROUP BY 1,2,3) m
            USING(company_id,product_id,location_id)
            WHERE COALESCE(b.on_hand,0) <> COALESCE(m.qty,0)""")
        ).all()
        reserved = db.execute(
            text("""SELECT b.company_id,b.product_id,b.location_id FROM honor.stock_balances b
            LEFT JOIN (SELECT o.company_id,l.product_id,o.location_id,SUM(l.quantity) qty
             FROM honor.orders o JOIN honor.order_lines l ON l.order_id=o.id
             WHERE o.status IN ('RESERVED','PAID') GROUP BY 1,2,3) r USING(company_id,product_id,location_id)
             WHERE b.reserved <> COALESCE(r.qty,0)""")
        ).all()
        serials = db.execute(
            text("""SELECT b.company_id,b.product_id,b.location_id FROM honor.stock_balances b
            JOIN honor.products p ON p.id=b.product_id AND p.tracking='SERIAL'
            LEFT JOIN (SELECT company_id,product_id,location_id,COUNT(*) qty,
             COUNT(*) FILTER (WHERE status='RESERVED') reserved FROM honor.serial_units
             WHERE status IN ('AVAILABLE','RESERVED') GROUP BY 1,2,3) s
             ON s.company_id=b.company_id AND s.product_id=b.product_id AND s.location_id=b.location_id
             WHERE b.on_hand <> COALESCE(s.qty,0) OR b.reserved <> COALESCE(s.reserved,0)""")
        ).all()
        return {
            "stock_differences": len(mismatches),
            "reservation_differences": len(reserved),
            "serial_differences": len(serials),
        }


def provision_honor(sessions, email, currency="NGN"):
    """Operator-only first business setup. Requires an already verified Honor login."""
    with sessions() as db:
        db.execute(text("SELECT pg_advisory_xact_lock(481025)"))
        if db.scalar(select(Company.id).limit(1)):
            raise RuntimeError("Honor already has a business; public store creation is disabled")
        user = db.scalar(select(Identity).where(Identity.email == email.strip().lower()))
        if not user or not db.scalar(
            select(LoginSession.id)
            .where(
                LoginSession.user_id == user.id,
                LoginSession.revoked.is_(False),
                LoginSession.expires_at > now(),
            )
            .limit(1)
        ):
            raise RuntimeError(
                "The first administrator must verify email and sign in to Honor before provisioning"
            )
        company = Company(id=uid(), name="Honor", slug="honor", currency=currency, timezone="Africa/Lagos")
        db.add(company)
        db.flush()
        db.add(Membership(company_id=company.id, user_id=user.id, role="ADMIN"))
        audit(db, company.id, user.id, "company.provisioned")
        db.commit()
        return company.id


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["seed-demo", "provision-honor", "reconcile", "cleanup"])
    parser.add_argument("--email")
    parser.add_argument("--currency", default="NGN")
    args = parser.parse_args()
    settings = get_settings()
    _, sessions = database(settings.database_url)
    if args.action == "provision-honor":
        if not args.email:
            parser.error("provision-honor requires --email for the verified first administrator")
        from .schemas import CompanyInput

        validated = CompanyInput(name="Honor", slug="honor", currency=args.currency)
        company_id = provision_honor(sessions, args.email, validated.currency)
        print("Honor business provisioned:", company_id, "No products or stock added.")
    elif args.action == "seed-demo":
        email = args.email or input("Demo administrator email: ")
        password = os.environ.get("HONOR_DEMO_PASSWORD") or getpass.getpass(
            "Choose a demo password (12+ characters): "
        )
        company_id = seed(settings, sessions, email, password, args.currency)
        print("Fictional company ready:", company_id, "Shop: /shop/honor-demo")
    elif args.action == "cleanup":
        from .inventory import expire
        from .models import RateWindow, now
        from sqlalchemy import delete

        with sessions() as db:
            expire(db)
            db.execute(delete(RateWindow).where(RateWindow.expires_at < now()))
            db.commit()
        print("Expired reservations and rate windows cleaned")
    else:
        result = reconcile(sessions)
        print(result)
        if any(result.values()):
            raise SystemExit(1)


if __name__ == "__main__":
    main()
