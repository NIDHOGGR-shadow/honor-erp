import os
import re
from uuid import uuid4

import pytest
from psycopg.errors import RaiseException

from honor.bootstrap import OUTPUT, render_sql


def test_export_matches_migrations_and_never_connects(monkeypatch):
    # An unusable real URL must be ignored by this offline-only command.
    url = "postgresql+psycopg://unreachable.invalid/honor"
    monkeypatch.setenv("HONOR_DATABASE_URL", url)
    assert render_sql() == OUTPUT.read_text()
    assert os.environ["HONOR_DATABASE_URL"] == url


def test_sql_installs_empty_tables_and_refuses_existing_schema(database_factory):
    engine, _ = database_factory
    if engine.dialect.driver != "psycopg":
        pytest.skip("The operator-only multi-statement bootstrap uses Psycopg's raw cursor API")
    schema = "honor_bootstrap_" + uuid4().hex
    # Exercise the complete exported SQL in an isolated namespace within the
    # explicitly disposable test database, preserving other workflow fixtures.
    sql = re.sub(r"\bhonor\b", schema, render_sql())
    raw = engine.raw_connection()
    driver = raw.driver_connection
    previous_autocommit = driver.autocommit
    created_roles = []
    try:
        driver.autocommit = True
        with driver.cursor() as cursor:
            # Supabase already has these roles. Exercise the conditional REVOKE
            # statements, including PostgreSQL format('%I', role) in raw SQL.
            for role in ("anon", "authenticated", "service_role"):
                cursor.execute("SELECT EXISTS (SELECT FROM pg_roles WHERE rolname=%s)", (role,))
                if not cursor.fetchone()[0]:
                    cursor.execute(f'CREATE ROLE "{role}"')
                    created_roles.append(role)
            cursor.execute(sql, prepare=False)
            while cursor.nextset():
                pass
            cursor.execute(f'SELECT version_num FROM "{schema}".alembic_version')
            assert cursor.fetchone()[0] == "0004"
            for role in ("anon", "authenticated", "service_role"):
                cursor.execute("SELECT has_schema_privilege(%s,%s,'USAGE')", (role, schema))
                assert cursor.fetchone()[0] is False
            for table in ("identities", "companies", "products", "stock_movements"):
                cursor.execute(f'SELECT COUNT(*) FROM "{schema}"."{table}"')
                assert cursor.fetchone()[0] == 0
            cursor.execute(
                f'INSERT INTO "{schema}".companies (id,name,slug,currency,timezone) '
                "VALUES ('test-only','Preserve this company','test-only','NGN','UTC')"
            )
            with pytest.raises(RaiseException, match="Honor objects already exist"):
                cursor.execute(sql, prepare=False)
                while cursor.nextset():
                    pass
            driver.rollback()
            cursor.execute(f'SELECT COUNT(*) FROM "{schema}".companies')
            assert cursor.fetchone()[0] == 1
    finally:
        raw.rollback()
        with raw.cursor() as cursor:
            cursor.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
            for role in created_roles:
                cursor.execute(f'DROP ROLE "{role}"')
        raw.commit()
        driver.autocommit = previous_autocommit
        raw.close()
