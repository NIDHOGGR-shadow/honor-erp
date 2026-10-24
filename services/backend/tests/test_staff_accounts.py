import json
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import func, select, text

from conftest import PASSWORD
from honor.accounts import sync_verified_email
from honor.models import Audit, Identity, Invitation, LoginSession, Membership, Outbox, Product, now

TEMPORARY = "Temporary staff password 123!"
PRIVATE = "A different staff private password 456!"


def create_staff(env):
    response = env["client"].post(
        "/api/v1/team",
        json={
            "email": "assigned@example.test",
            "name": "Assigned staff",
            "role": "STOCK",
            "location_ids": [env["main"]],
            "temporary_password": TEMPORARY,
        },
    )
    assert response.status_code == 201, response.text
    assert TEMPORARY not in response.text
    return response.json()["id"]


def test_customer_registration_cannot_create_business_or_assign_staff_access(env):
    with TestClient(env["app"]) as customer:
        customer.post(
            "/api/v1/auth/register",
            json={"email": "customer@example.test", "name": "Customer", "password": PRIVATE},
        )
        customer.post("/api/v1/auth/login", json={"email": "customer@example.test", "password": PRIVATE})
        assert (
            customer.post(
                "/api/v1/companies", json={"name": "Unauthorized", "slug": "unauthorized", "currency": "NGN"}
            ).status_code
            == 403
        )
        assert customer.get("/api/v1/me").json()["companies"] == []
        customer.headers.update({"X-Company-Id": env["company"]})
        assert (
            customer.post(
                "/api/v1/team",
                json={
                    "email": "another@example.test",
                    "name": "Another",
                    "role": "ADMIN",
                    "temporary_password": PRIVATE,
                },
            ).status_code
            == 403
        )


def test_temporary_password_blocks_data_until_changed_and_rotates_sessions(env):
    user_id = create_staff(env)
    with TestClient(env["app"]) as staff:
        staff.headers.update({"X-Company-Id": env["company"]})
        assert (
            staff.post(
                "/api/v1/auth/login", json={"email": "assigned@example.test", "password": TEMPORARY}
            ).status_code
            == 200
        )
        old_cookie = staff.cookies.get("honor_session")
        assert staff.get("/api/v1/me").json()["must_change_password"] is True
        assert staff.get("/api/v1/products").status_code == 403
        assert (
            staff.post(
                "/api/v1/auth/password", json={"current_password": TEMPORARY, "new_password": TEMPORARY}
            ).status_code
            == 422
        )
        result = staff.post(
            "/api/v1/auth/password", json={"current_password": TEMPORARY, "new_password": PRIVATE}
        )
        assert result.status_code == 200, result.text
        assert staff.cookies.get("honor_session") != old_cookie
        assert staff.get("/api/v1/products").status_code == 200
        assert staff.get("/api/v1/me").json()["id"] == user_id
        with TestClient(env["app"]) as stolen:
            stolen.cookies.set("honor_session", old_cookie)
            assert stolen.get("/api/v1/me").status_code == 401
    with env["sessions"]() as db:
        assert db.get(Identity, user_id).must_change_password is False
        serialized = json.dumps([x.payload for x in db.scalars(select(Outbox))])
        assert "password_changed" in serialized and user_id in serialized
        assert PRIVATE not in serialized and TEMPORARY not in serialized
        assert PRIVATE not in json.dumps([x.details for x in db.scalars(select(Audit))])


def test_staff_cannot_provision_others_and_admin_does_not_reset_existing_accounts(env):
    user_id = create_staff(env)
    assert (
        env["client"]
        .post(
            "/api/v1/team",
            json={
                "email": "assigned@example.test",
                "name": "Replacement",
                "role": "ADMIN",
                "temporary_password": PRIVATE,
            },
        )
        .status_code
        == 409
    )
    with TestClient(env["app"]) as staff:
        staff.post("/api/v1/auth/login", json={"email": "staff@example.test", "password": PASSWORD})
        staff.headers.update({"X-Company-Id": env["company"]})
        assert (
            staff.post(
                "/api/v1/team",
                json={
                    "email": "injected@example.test",
                    "name": "Injected",
                    "role": "ADMIN",
                    "temporary_password": PRIVATE,
                },
            ).status_code
            == 403
        )
    team = env["client"].get("/api/v1/team").text
    assert user_id in team
    assert TEMPORARY not in team and "password_hash" not in team


def test_invitation_activation_is_email_bound_and_role_is_not_client_assigned(env):
    result = env["client"].post(
        "/api/v1/invitations",
        json={"email": "invited@example.test", "role": "SALES", "location_ids": [env["main"]]},
    )
    token = result.json()["development_link"].split("invite=")[1]
    with TestClient(env["app"]) as staff:
        body = {"name": "Invited", "email": "wrong@example.test", "password": PRIVATE, "token": token}
        assert staff.post("/api/v1/auth/activate-invitation", json=body).status_code == 400
        body["email"] = "invited@example.test"
        assert (
            staff.post("/api/v1/auth/activate-invitation", json={**body, "role": "ADMIN"}).status_code == 422
        )
        assert staff.post("/api/v1/auth/activate-invitation", json=body).status_code == 200
        staff.post("/api/v1/auth/login", json={"email": body["email"], "password": PRIVATE})
        assert staff.get("/api/v1/me").json()["companies"] == []
        assert staff.post("/api/v1/invitations/accept", json={"token": token}).status_code == 200
        assert staff.get("/api/v1/me").json()["companies"][0]["role"] == "SALES"
        assert staff.post("/api/v1/auth/activate-invitation", json=body).status_code == 400


def test_expired_invitation_cannot_activate_an_identity(env):
    result = env["client"].post(
        "/api/v1/invitations",
        json={"email": "expired@example.test", "role": "SALES", "location_ids": [env["main"]]},
    )
    token = result.json()["development_link"].split("invite=")[1]
    with env["sessions"]() as db:
        for invite in db.scalars(select(Invitation)):
            invite.expires_at = now() - timedelta(seconds=1)
        db.commit()
    response = env["client"].post(
        "/api/v1/auth/activate-invitation",
        json={"email": "expired@example.test", "name": "Expired", "password": PRIVATE, "token": token},
    )
    assert response.status_code == 400
    with env["sessions"]() as db:
        assert db.scalar(select(Identity).where(Identity.email == "expired@example.test")) is None


def test_verified_email_changes_keep_staff_id_permissions_and_notify_without_secrets(env):
    with env["sessions"]() as db:
        staff = db.get(Identity, env["staff"])
        sync_verified_email(db, staff, {"email": "updated@example.test"})
        db.commit()
        assert db.get(Identity, env["staff"]).email == "updated@example.test"
        assert db.get(Membership, (env["company"], env["staff"])).role == "STOCK"
        notices = [
            x.payload for x in db.scalars(select(Outbox).where(Outbox.kind == "ACCOUNT_SECURITY_EMAIL"))
        ]
        assert notices and notices[0]["email"] == "admin@example.test"
        assert notices[0]["user_id"] == env["staff"]
        assert notices[0]["new_email"] == "updated@example.test"
        assert "password" not in json.dumps(notices)
        assert all(
            s.revoked for s in db.scalars(select(LoginSession).where(LoginSession.user_id == env["staff"]))
        )


def test_staff_suspension_blocks_already_signed_in_sessions(env):
    with TestClient(env["app"]) as staff:
        staff.headers.update({"X-Company-Id": env["company"]})
        staff.post("/api/v1/auth/login", json={"email": "staff@example.test", "password": PASSWORD})
        assert staff.get("/api/v1/products").status_code == 200
        result = env["client"].patch(
            f"/api/v1/team/{env['staff']}",
            json={"role": "STOCK", "active": False, "location_ids": [env["main"]]},
        )
        assert result.status_code == 200
        assert staff.get("/api/v1/products").status_code == 403
        assert staff.get("/api/v1/stock/balances").status_code == 403


def test_managed_email_change_is_pending_until_verified_and_requires_current_password(env, monkeypatch):
    from honor import app as app_module

    assert (
        env["client"]
        .post(
            "/api/v1/auth/email",
            json={"email": "newadmin@example.test", "current_password": "Wrong password"},
        )
        .status_code
        == 401
    )
    calls = []
    monkeypatch.setattr(app_module, "identify", lambda *args: (None, None))
    monkeypatch.setattr(
        app_module, "provider_tokens", lambda *args: {"access_token": "non-secret-test-token"}
    )
    monkeypatch.setattr(
        app_module, "provider_call", lambda *args, **kwargs: calls.append((args, kwargs)) or {}
    )
    env["settings"].auth_provider = "supabase"
    result = env["client"].post(
        "/api/v1/auth/email", json={"email": "newadmin@example.test", "current_password": PASSWORD}
    )
    assert result.status_code == 200, result.text
    assert calls[0][1]["payload"] == {"email": "newadmin@example.test"}
    with env["sessions"]() as db:
        assert db.get(Identity, env["admin"]).email == "admin@example.test"
        notices = [x.payload for x in db.scalars(select(Outbox))]
        assert notices[0]["event"] == "email_change_requested"
        assert PASSWORD not in json.dumps(notices)


def test_admin_creation_uses_server_credentials_without_auto_confirming_email(monkeypatch):
    from types import SimpleNamespace
    from honor import security

    calls = []

    class Result:
        status_code = 201

        def json(self):
            return {"id": "test-id", "email": "assigned@example.test"}

    monkeypatch.setattr(
        security, "http_request", lambda *args, **kwargs: calls.append((args, kwargs)) or Result()
    )
    settings = SimpleNamespace(
        supabase_url="https://project.example.test", supabase_secret_key="sb_secret_test_fixture"
    )
    profile = security.admin_create_identity(
        settings, email="assigned@example.test", name="Assigned", password=TEMPORARY
    )
    assert profile["id"] == "test-id"
    assert calls[0][1]["json"]["email_confirm"] is False
    assert calls[0][1]["headers"] == {"apikey": "sb_secret_test_fixture"}
    assert calls[0][0][1].endswith("/auth/v1/admin/users")


def test_first_business_provisioning_is_operator_only_empty_and_single_use(env):
    from honor.cli import provision_honor
    import pytest

    with env["sessions"]() as db:
        db.execute(text("TRUNCATE honor.companies CASCADE"))
        db.commit()
    company_id = provision_honor(env["sessions"], "admin@example.test")
    with env["sessions"]() as db:
        assert db.get(Membership, (company_id, env["admin"])).role == "ADMIN"
        assert db.scalar(select(func.count()).select_from(Product)) == 0
    with pytest.raises(RuntimeError, match="already has a business"):
        provision_honor(env["sessions"], "admin@example.test")
