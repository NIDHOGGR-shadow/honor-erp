"""Honor API entrypoint: no frontend assets, owner credentials or sample data."""

import asyncio
import time

from workers import Response, WorkerEntrypoint, asgi

_lock = asyncio.Lock()
_app = None


def load_app(env):
    global _app
    if _app is not None:
        return _app
    # Keep the deployment snapshot small. Imports are cached after the first
    # request; constructing the app never opens a database connection.
    from sqlalchemy.exc import SQLAlchemyError
    from honor.config import Settings
    from honor.worker_adapter import worker_app

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
    try:
        _app = worker_app(settings)
    except SQLAlchemyError:
        raise ValueError("Database configuration is invalid") from None
    return _app


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        async with _lock:
            try:
                app = load_app(self.env)
            except (ValueError, TypeError, AttributeError):
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
            except (ValueError, TypeError, AttributeError):
                raise RuntimeError("Honor API configuration is incomplete.") from None
            from honor.inventory import expire
            from honor.jobs import run_once

            sessions, settings = app.state.sessions, app.state.settings
            with sessions() as db:
                expire(db)
                db.commit()
            deadline = time.monotonic() + 10
            for _ in range(3):
                if time.monotonic() >= deadline or not run_once(sessions, settings):
                    break
