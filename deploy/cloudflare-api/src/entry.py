"""Honor API entrypoint: no frontend assets, owner credentials or sample data."""

import asyncio
import time

from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError
from workers import Response, WorkerEntrypoint, asgi

from honor.config import Settings
from honor.inventory import expire
from honor.jobs import run_once
from honor.worker_adapter import worker_app

_lock = asyncio.Lock()
_app = None


def load_app(env):
    global _app
    if _app is not None:
        return _app
    values = {}
    for field in Settings.model_fields:
        try:
            value = getattr(env, "HONOR_" + field.upper())
        except AttributeError:
            continue
        if value is not None:
            values[field] = value
    # A deployment cannot opt into development identities or simulated payments.
    values["environment"] = "production"
    settings = Settings(_env_file=None, **values)
    url = make_url(settings.database_url)
    if url.query.get("sslmode") not in {"require", "verify-ca", "verify-full"}:
        raise ValueError("Database TLS is required")
    if (url.username or "").split(".")[0] != "honor_api":
        raise ValueError("Use the restricted Honor runtime role")
    if url.drivername not in {"postgresql", "postgresql+psycopg"}:
        raise ValueError("Use PostgreSQL with Psycopg")
    settings = settings.model_copy(update={"database_url": url.set(drivername="postgresql+psycopg").render_as_string(hide_password=False)})
    _app = worker_app(settings)
    return _app


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        async with _lock:
            try:
                app = load_app(self.env)
            except (ValueError, TypeError, AttributeError, SQLAlchemyError):
                # Configuration and provider errors must not disclose secret values.
                return Response.from_json(
                    {"detail": "Honor API configuration is incomplete."},
                    status=503,
                    headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
                )
            return await asgi.fetch(app, request, self.env)

    async def scheduled(self, controller, env, ctx):
        async with _lock:
            try:
                app = load_app(self.env)
            except (ValueError, TypeError, AttributeError, SQLAlchemyError):
                raise RuntimeError("Honor API configuration is incomplete.") from None
            sessions, settings = app.state.sessions, app.state.settings
            with sessions() as db:
                expire(db)
                db.commit()
            deadline = time.monotonic() + 10
            for _ in range(3):
                if time.monotonic() >= deadline or not run_once(sessions, settings):
                    break
