"""Exercise the same API without FastAPI's native thread-pool path."""

import base64
import hashlib
import json
from pathlib import Path

import httpx
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from honor import transport
from honor.worker_adapter import worker_app
from conftest import PASSWORD


def test_worker_routes_and_dependencies_do_not_require_threads(env, monkeypatch):
    import fastapi.routing
    import fastapi.dependencies.utils

    async def forbidden(*args, **kwargs):
        raise AssertionError("Worker attempted to start a thread")

    monkeypatch.setattr(fastapi.routing, "run_in_threadpool", forbidden)
    monkeypatch.setattr(fastapi.dependencies.utils, "run_in_threadpool", forbidden)
    monkeypatch.setattr(fastapi.dependencies.utils, "contextmanager_in_threadpool", forbidden)
    app = worker_app(env["app"].state.settings)
    try:
        with TestClient(app) as client:
            assert client.get("/api/health").status_code == 200
            assert client.get("/api/v1/me").status_code == 401
            response = client.post(
                "/api/v1/auth/login", json={"email": "admin@example.test", "password": PASSWORD}
            )
            assert response.status_code == 200
            response = client.get("/api/v1/me")
            assert response.status_code == 200
            assert client.get(
                "/api/v1/products", headers={"X-Company-Id": env["other"]}
            ).status_code == 403
    finally:
        app.state.engine.dispose()


def test_native_http_transport_preserves_request_arguments(monkeypatch):
    calls = []

    def send(*args, **kwargs):
        calls.append((args, kwargs))
        return httpx.Response(200, json={"ok": True})

    monkeypatch.setattr(httpx, "request", send)
    response = transport.request("POST", "https://provider.test", json={"test": True}, timeout=15)
    assert response.json() == {"ok": True}
    assert calls == [(("POST", "https://provider.test"), {"json": {"test": True}, "timeout": 15})]


def test_fernet_reference_token_remains_readable():
    fixture = json.loads((Path(__file__).parent / "fixtures" / "fernet.json").read_text())
    key = base64.urlsafe_b64encode(hashlib.sha256(fixture["test_secret"].encode()).digest())
    assert Fernet(key).decrypt(fixture["token"].encode()).decode() == fixture["plaintext"]
