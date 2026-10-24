import argparse
from sqlalchemy import select, text
from .config import get_settings
from .db import database
from .inventory import audit
from .models import (
    Company,
    Identity,
    LoginSession,
    Membership,
    now,
    uid,
)


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
    parser.add_argument("action", choices=["provision-honor", "reconcile", "cleanup"])
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
