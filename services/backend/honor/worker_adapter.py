"""Use the existing synchronous domain operations without a thread pool.

The Worker entrypoint serializes each isolate's requests using an asyncio lock.
PostgreSQL transactions still coordinate concurrent writes across isolates.
"""

import inspect
import ssl
from functools import wraps

from fastapi.routing import APIRoute
from sqlalchemy.engine import make_url
from sqlalchemy.pool import NullPool

from .app import create_app
from .db import database, session


class InlineRoute(APIRoute):
    def __init__(self, path, endpoint, *args, **kwargs):
        if not inspect.iscoroutinefunction(endpoint):
            original = endpoint

            @wraps(original)
            async def inline(*args, **kwargs):
                return original(*args, **kwargs)

            endpoint = inline
        super().__init__(path, endpoint, *args, **kwargs)


def worker_connection(settings):
    """Use a small pure-Python driver without changing operators' connection URLs."""
    url = make_url(settings.database_url)
    if url.drivername not in {"postgresql", "postgresql+psycopg", "postgresql+pg8000"}:
        raise ValueError("Use PostgreSQL for the Worker")
    connect_args = {}
    if settings.environment != "development":
        if url.query.get("sslmode") not in {"require", "verify-ca", "verify-full"}:
            raise ValueError("Database TLS is required")
        if (url.username or "").split(".")[0] != "honor_api":
            raise ValueError("Use the restricted Honor runtime role")
        # pg8000 takes SSLContext, not libpq's sslmode query option. Verify both
        # the CA chain and hostname even when the supplied URL only says require.
        connect_args["ssl_context"] = ssl.create_default_context()
    elif url.query.get("sslmode") == "disable":
        connect_args["ssl_context"] = False
    url = url.difference_update_query(["sslmode"]).set(drivername="postgresql+pg8000")
    return url, connect_args


def worker_app(settings):
    url, connect_args = worker_connection(settings)
    engine, sessions = database(url, poolclass=NullPool, connect_args=connect_args)
    app = create_app(settings, sessions=sessions, route_class=InlineRoute)
    app.state.engine = engine

    async def inline_session():
        with sessions() as db:
            yield db

    app.dependency_overrides[session] = inline_session
    return app
