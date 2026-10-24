"""Account notifications contain identifiers and event names, never credentials."""

from sqlalchemy import select, update
from .models import Identity, LoginSession, Membership, Outbox
from .inventory import audit


def notify_account_change(db, user, event, **details):
    for membership in db.scalars(select(Membership).where(Membership.user_id == user.id)):
        audit(db, membership.company_id, user.id, "account." + event, user_id=user.id, **details)
        admins = db.scalars(
            select(Identity)
            .join(Membership, Membership.user_id == Identity.id)
            .where(
                Membership.company_id == membership.company_id,
                Membership.role == "ADMIN",
                Membership.active.is_(True),
            )
        )
        for admin in admins:
            db.add(
                Outbox(
                    company_id=membership.company_id,
                    kind="ACCOUNT_SECURITY_EMAIL",
                    payload={
                        "email": admin.email,
                        "user_id": user.id,
                        "event": event,
                        **details,
                    },
                )
            )


def sync_verified_email(db, user, profile):
    # Called only after /user verification against the Auth server.
    email = profile["email"].lower()
    if email != user.email:
        previous = user.email
        user.email = email
        db.execute(update(LoginSession).where(LoginSession.user_id == user.id).values(revoked=True))
        notify_account_change(db, user, "email_changed", previous_email=previous, new_email=email)
