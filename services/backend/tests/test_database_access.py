import importlib.util
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from honor.database_access import audit, grant_runtime


def sqlstate(error):
    # Psycopg exposes an attribute; pg8000 preserves PostgreSQL's error fields.
    original = error.value.orig
    if hasattr(original, "sqlstate"):
        return original.sqlstate
    return original.args[0]["C"]


@pytest.fixture
def runtime_role(database_factory):
    engine, _ = database_factory
    role = "honor_test_runtime_" + uuid4().hex
    with engine.begin() as db:
        db.execute(text(f'CREATE ROLE "{role}" LOGIN'))
    try:
        yield role
    finally:
        with engine.begin() as db:
            db.execute(text(f'DROP OWNED BY "{role}"'))
            db.execute(text(f'DROP ROLE "{role}"'))


def test_runtime_can_post_stock_but_cannot_erase_history(env, database_factory, runtime_role):
    engine, _ = database_factory
    with engine.begin() as db:
        grant_runtime(db, runtime_role)
        assert audit(db, runtime_role) == []
    # Real PostgreSQL permission enforcement, using the restricted role itself.
    # Roll back these test writes after proving valid operations can run.
    with engine.connect() as db:
        transaction = db.begin()
        try:
            db.execute(text(f'SET LOCAL ROLE "{runtime_role}"'))
            result = db.execute(
                text("""UPDATE honor.stock_balances SET on_hand=on_hand+1
                WHERE company_id=:company AND product_id=:charger AND location_id=:main"""),
                env,
            )
            assert result.rowcount == 1
            db.execute(
                text("""INSERT INTO honor.stock_movements
                (id,company_id,product_id,location_id,delta,kind,reference,actor_id,reason,created_at)
                VALUES (:id,:company,:charger,:main,1,'RECEIPT','permission-test',:admin,'Checked stock',now())
                """),
                {**env, "id": str(uuid4())},
            )
            db.execute(
                text("""INSERT INTO honor.audit_events
                (id,company_id,actor_id,action,details,created_at)
                VALUES (:id,:company,:admin,'permission.test','{}',now())"""),
                {**env, "id": str(uuid4())},
            )
        finally:
            transaction.rollback()
    for statement in (
        "UPDATE honor.stock_movements SET reason='changed'",
        "DELETE FROM honor.audit_events",
        "TRUNCATE honor.stock_movements",
        "UPDATE honor.alembic_version SET version_num='0001'",
        "ALTER TABLE honor.stock_movements DISABLE TRIGGER immutable_history",
        "CREATE TABLE honor.permission_escape (id integer)",
    ):
        with pytest.raises(DBAPIError) as error:
            with engine.begin() as db:
                db.execute(text(f'SET LOCAL ROLE "{runtime_role}"'))
                db.execute(text(statement))
        assert sqlstate(error) == "42501"


def test_grants_remove_old_column_permissions(env, database_factory, runtime_role):
    engine, _ = database_factory
    with engine.begin() as db:
        db.execute(text(f'GRANT UPDATE(reason) ON honor.stock_movements TO "{runtime_role}"'))
        grant_runtime(db, runtime_role)
        assert audit(db, runtime_role) == []
        assert not db.scalar(
            text("""SELECT has_any_column_privilege(
            :role,'honor.stock_movements','UPDATE')"""),
            {"role": runtime_role},
        )


def test_owner_and_inherited_roles_are_rejected(database_factory, runtime_role):
    engine, _ = database_factory
    with engine.begin() as db:
        owner = db.scalar(text("SELECT current_user"))
        with pytest.raises(ValueError):
            grant_runtime(db, owner)
        parent = "honor_test_parent_" + uuid4().hex
        db.execute(text(f'CREATE ROLE "{parent}"'))
        db.execute(text(f'GRANT "{parent}" TO "{runtime_role}"'))
        try:
            with pytest.raises(ValueError, match="inherit"):
                grant_runtime(db, runtime_role)
            assert not db.scalar(
                text("SELECT has_schema_privilege(:role,'honor','USAGE')"), {"role": runtime_role}
            )
        finally:
            db.execute(text(f'REVOKE "{parent}" FROM "{runtime_role}"'))
            db.execute(text(f'DROP ROLE "{parent}"'))


def test_audit_detects_column_grant_options(database_factory, runtime_role):
    engine, _ = database_factory
    with engine.begin() as db:
        grant_runtime(db, runtime_role)
        db.execute(text(f'GRANT SELECT(email) ON honor.identities TO "{runtime_role}" WITH GRANT OPTION'))
        assert "Runtime identities: SELECT must not have grant option" in audit(db, runtime_role)


def test_audit_requires_full_table_permissions(database_factory, runtime_role):
    engine, _ = database_factory
    with engine.begin() as db:
        grant_runtime(db, runtime_role)
        db.execute(text(f'REVOKE SELECT ON honor.identities FROM "{runtime_role}"'))
        db.execute(text(f'GRANT SELECT(email) ON honor.identities TO "{runtime_role}"'))
        assert "Runtime identities: unexpected SELECT permission" in audit(db, runtime_role)


def test_unsafe_public_grant_causes_transaction_rollback(database_factory, runtime_role):
    engine, _ = database_factory
    with engine.begin() as db:
        db.execute(text("GRANT TRUNCATE ON honor.audit_events TO PUBLIC"))
    try:
        with pytest.raises(ValueError, match="TRUNCATE"):
            with engine.begin() as db:
                grant_runtime(db, runtime_role)
        with engine.begin() as db:
            assert not db.scalar(
                text("SELECT has_schema_privilege(:role,'honor','USAGE')"), {"role": runtime_role}
            )
    finally:
        with engine.begin() as db:
            db.execute(text("REVOKE TRUNCATE ON honor.audit_events FROM PUBLIC"))


def test_private_migration_revokes_data_api_access(database_factory):
    engine, _ = database_factory
    migration_path = Path(__file__).parents[1] / "migrations/versions/0004_private_access.py"
    spec = importlib.util.spec_from_file_location("private_access_migration", migration_path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    created = []
    try:
        with engine.begin() as db:
            for role in ("anon", "authenticated", "service_role"):
                if not db.scalar(
                    text("SELECT EXISTS (SELECT FROM pg_roles WHERE rolname=:role)"), {"role": role}
                ):
                    db.execute(text(f'CREATE ROLE "{role}"'))
                    created.append(role)
                db.execute(text(f'GRANT USAGE ON SCHEMA honor TO "{role}"'))
                db.execute(text(f'GRANT ALL ON ALL TABLES IN SCHEMA honor TO "{role}"'))
                db.execute(text(f'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA honor TO "{role}"'))
            with Operations.context(MigrationContext.configure(db)):
                migration.upgrade()
            for role in ("anon", "authenticated", "service_role"):
                assert not db.scalar(
                    text("SELECT has_schema_privilege(:role,'honor','USAGE')"), {"role": role}
                )
                assert not db.scalar(
                    text("SELECT has_table_privilege(:role,'honor.identities','SELECT')"), {"role": role}
                )
                assert not db.scalar(
                    text("SELECT has_function_privilege(:role,'honor.protect_history()','EXECUTE')"),
                    {"role": role},
                )
        for role in ("anon", "authenticated", "service_role"):
            with pytest.raises(DBAPIError) as error:
                with engine.begin() as db:
                    db.execute(text(f'SET LOCAL ROLE "{role}"'))
                    db.execute(text("SELECT * FROM honor.identities"))
            assert sqlstate(error) == "42501"
    finally:
        with engine.begin() as db:
            for role in created:
                db.execute(text(f'DROP OWNED BY "{role}"'))
                db.execute(text(f'DROP ROLE "{role}"'))
