"""Worker driver changes must preserve production transport and role boundaries."""

import ssl
from types import SimpleNamespace

import pytest

from honor.worker_adapter import worker_connection


def connection(url, environment="production"):
    return worker_connection(SimpleNamespace(database_url=url, environment=environment))


def test_existing_operator_url_uses_pg8000_with_verified_tls():
    url, args = connection(
        "postgresql+psycopg://honor_api.project@pooler.example.test:5432/postgres?sslmode=require"
    )
    assert url.drivername == "postgresql+pg8000"
    assert url.username == "honor_api.project"
    assert url.host == "pooler.example.test"
    assert "sslmode" not in url.query
    assert args["ssl_context"].verify_mode == ssl.CERT_REQUIRED
    assert args["ssl_context"].check_hostname is True


@pytest.mark.parametrize("url", [
    "postgresql://honor_api@pooler.example.test/postgres",
    "postgresql://honor_api@pooler.example.test/postgres?sslmode=disable",
    "postgresql://postgres@pooler.example.test/postgres?sslmode=require",
    "postgresql://honor_api_extra@pooler.example.test/postgres?sslmode=require",
    "sqlite:///database.sqlite",
])
def test_production_rejects_unsafe_connections(url):
    with pytest.raises(ValueError):
        connection(url)


def test_only_development_can_use_local_plaintext_postgres():
    url, args = connection(
        "postgresql+psycopg://postgres@localhost/honor_test?sslmode=disable", "development"
    )
    assert url.drivername == "postgresql+pg8000"
    assert args["ssl_context"] is False
