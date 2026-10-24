"""Use the existing synchronous domain operations without a thread pool.

The Worker entrypoint serializes each isolate's requests using an asyncio lock.
PostgreSQL transactions still coordinate concurrent writes across isolates.
"""

import inspect
from functools import wraps

from fastapi.routing import APIRoute
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


def worker_app(settings):
    engine, sessions = database(settings.database_url, poolclass=NullPool)
    app = create_app(settings, sessions=sessions, route_class=InlineRoute)
    app.state.engine = engine

    async def inline_session():
        with sessions() as db:
            yield db

    app.dependency_overrides[session] = inline_session
    return app
