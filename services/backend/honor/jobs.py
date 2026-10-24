import html
import time
from datetime import timedelta

from sqlalchemy import or_, select

from .config import get_settings
from .db import database
from .inventory import expire
from .models import Order, Outbox, now
from .payments import process_event
from .logging import logger
from .transport import request as http_request

log = logger("honor.jobs")


def send_email(settings, recipient, subject, content):
    if not settings.resend_api_key or not settings.email_from:
        raise RuntimeError("EMAIL_NOT_CONFIGURED")
    response = http_request(
        "POST",
        "https://api.resend.com/emails",
        headers={"Authorization": "Bearer " + settings.resend_api_key},
        json={"from": settings.email_from, "to": [recipient], "subject": subject, "html": content},
        timeout=20,
    )
    response.raise_for_status()


def run_once(sessions, settings):
    with sessions() as db:
        job = db.scalar(
            select(Outbox)
            .where(
                Outbox.available_at <= now(),
                or_(Outbox.status == "PENDING", (Outbox.status == "RUNNING") & (Outbox.lease_until < now())),
            )
            .order_by(Outbox.available_at, Outbox.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if not job:
            return False
        job.status, job.lease_until = "RUNNING", now() + timedelta(minutes=5)
        job.attempts += 1
        db.commit()
        job_id, kind, payload = job.id, job.kind, job.payload
    try:
        with sessions() as db:
            if kind == "PAYMENT_EVENT":
                process_event(db, settings, payload["event_id"])
            elif kind == "INVITATION_EMAIL":
                send_email(
                    settings,
                    payload["email"],
                    "Your invitation to Honor",
                    '<p>Your company invited you to Honor.</p><p><a href="'
                    + html.escape(payload["url"], quote=True)
                    + '">Set up your access</a></p>',
                )
            elif kind == "ORDER_EMAIL":
                order = db.get(Order, payload["order_id"])
                send_email(
                    settings,
                    order.email,
                    "Honor order " + order.id[:8],
                    "<p>Your order status is "
                    + html.escape(order.status)
                    + ". Contact the store with reference "
                    + order.id[:8]
                    + ".</p>",
                )
            else:
                raise RuntimeError("UNKNOWN_JOB")
        with sessions() as db:
            saved = db.get(Outbox, job_id)
            saved.status, saved.last_error = "DONE", None
            db.commit()
    except Exception as exc:
        with sessions() as db:
            saved = db.get(Outbox, job_id)
            saved.status = "FAILED" if saved.attempts >= 8 else "PENDING"
            saved.available_at = now() + timedelta(seconds=min(3600, 2**saved.attempts * 10))
            # Do not retain exception strings: provider errors may contain tokens or personal data.
            saved.last_error = type(exc).__name__
            db.commit()
        log.warning("job_failed", extra={"job_id": job_id, "error_type": type(exc).__name__})
    return True


def main():
    settings = get_settings()
    _, sessions = database(settings.database_url)
    last_cleanup = 0.0
    while True:
        if time.monotonic() - last_cleanup >= 60:
            with sessions() as db:
                expire(db)
                db.commit()
            last_cleanup = time.monotonic()
        if not run_once(sessions, settings):
            time.sleep(2)


def cleanup():
    settings = get_settings()
    _, sessions = database(settings.database_url)
    with sessions() as db:
        expire(db)
        db.commit()


if __name__ == "__main__":
    main()
