"""Operator commands for Honor's private, server-accessed PostgreSQL schema.

No passwords are accepted or printed. Create the dedicated login through the
database operator first; use the owner connection only for migrations/grants.
"""

import argparse
import json
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

HISTORY = {"stock_movements", "audit_events"}
OPERATIONS = ("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN")


def role_problems(db, role):
    row = (
        db.execute(
            text("""SELECT oid, rolcanlogin, rolsuper, rolcreatedb,
        rolcreaterole, rolreplication, rolbypassrls
        FROM pg_roles WHERE rolname = :role"""),
            {"role": role},
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        return ["Runtime role does not exist"]
    problems = []
    if not row["rolcanlogin"]:
        problems.append("Runtime role must be a dedicated login")
    if any(row[k] for k in ("rolsuper", "rolcreatedb", "rolcreaterole", "rolreplication", "rolbypassrls")):
        problems.append("Runtime role has administrative privileges")
    if db.scalar(text("SELECT EXISTS (SELECT FROM pg_auth_members WHERE member = :oid)"), row):
        problems.append("Runtime role must not inherit other roles")
    owns_objects = db.scalar(
        text("""SELECT
        EXISTS (SELECT FROM pg_namespace WHERE nspname='honor' AND nspowner=:oid)
        OR EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                   WHERE n.nspname='honor' AND c.relowner=:oid)
        OR EXISTS (SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                   WHERE n.nspname='honor' AND p.proowner=:oid)
        OR EXISTS (SELECT FROM pg_database WHERE datname=current_database() AND datdba=:oid)
        """),
        row,
    )
    if owns_objects:
        problems.append("Runtime role owns the database or Honor objects")
    return problems


def tables(db):
    return (
        db.execute(
            text("""SELECT c.relname AS name FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='honor' AND c.relkind IN ('r','p') ORDER BY c.relname""")
        )
        .scalars()
        .all()
    )


def audit(db, role):
    """Inspect effective privileges, including grants inherited from PUBLIC."""
    problems = role_problems(db, role)
    if not db.scalar(text("SELECT EXISTS (SELECT FROM pg_roles WHERE rolname=:role)"), {"role": role}):
        return problems
    if not db.scalar(text("SELECT EXISTS (SELECT FROM pg_namespace WHERE nspname='honor')")):
        return problems + ["Honor schema is missing; run migrations against the intended project"]
    for permission, expected in (("USAGE", True), ("CREATE", False)):
        actual = db.scalar(
            text("SELECT has_schema_privilege(:role,'honor',:permission)"),
            {"role": role, "permission": permission},
        )
        if actual != expected:
            problems.append(f"Runtime schema {permission} must be {expected}")
    for name in tables(db):
        expected = set() if name == "alembic_version" else {"SELECT", "INSERT"}
        if name not in HISTORY and name != "alembic_version":
            expected.update(("UPDATE", "DELETE"))
        for permission in OPERATIONS:
            args = {"role": role, "table": f"honor.{name}", "permission": permission}
            actual = db.scalar(text("SELECT has_table_privilege(:role,:table,:permission)"), args)
            if permission not in expected and permission in ("SELECT", "INSERT", "UPDATE", "REFERENCES"):
                actual |= db.scalar(text("SELECT has_any_column_privilege(:role,:table,:permission)"), args)
            if actual != (permission in expected):
                problems.append(f"Runtime {name}: unexpected {permission} permission")
            grant_option = db.scalar(
                text("SELECT has_table_privilege(:role,:table,:permission)"),
                {**args, "permission": permission + " WITH GRANT OPTION"},
            )
            if permission in ("SELECT", "INSERT", "UPDATE", "REFERENCES"):
                grant_option |= db.scalar(
                    text("SELECT has_any_column_privilege(:role,:table,:permission)"),
                    {**args, "permission": permission + " WITH GRANT OPTION"},
                )
            if grant_option:
                problems.append(f"Runtime {name}: {permission} must not have grant option")
    for api_role in ("anon", "authenticated", "service_role"):
        if db.scalar(text("SELECT EXISTS (SELECT FROM pg_roles WHERE rolname=:role)"), {"role": api_role}):
            if db.scalar(
                text(
                    "SELECT has_schema_privilege(:role,'honor','USAGE') "
                    "OR has_schema_privilege(:role,'honor','CREATE')"
                ),
                {"role": api_role},
            ):
                problems.append(f"Data API role {api_role} must not access the Honor schema")
    return problems


def grant_runtime(db, role):
    """Apply current-table grants inside the caller's transaction; fail closed."""
    problems = role_problems(db, role)
    if problems:
        raise ValueError("; ".join(problems))
    quote = db.dialect.identifier_preparer.quote_identifier
    target = quote(role)
    db.execute(text(f"REVOKE ALL ON SCHEMA honor FROM {target}"))
    for objects in ("TABLES", "SEQUENCES", "FUNCTIONS"):
        db.execute(text(f"REVOKE ALL ON ALL {objects} IN SCHEMA honor FROM {target}"))
    db.execute(text(f"GRANT USAGE ON SCHEMA honor TO {target}"))
    for name in tables(db):
        table = f"honor.{quote(name)}"
        columns = (
            db.execute(
                text("""SELECT a.attname FROM pg_attribute a
            WHERE a.attrelid=to_regclass(:table) AND a.attnum>0 AND NOT a.attisdropped"""),
                {"table": f"honor.{name}"},
            )
            .scalars()
            .all()
        )
        # Table-level REVOKE alone does not remove older column-level grants.
        column_list = ",".join(quote(column) for column in columns)
        db.execute(text(f"REVOKE ALL PRIVILEGES ({column_list}) ON TABLE {table} FROM {target}"))
        if name == "alembic_version":
            continue
        permissions = "SELECT, INSERT" if name in HISTORY else "SELECT, INSERT, UPDATE, DELETE"
        db.execute(text(f"GRANT {permissions} ON TABLE {table} TO {target}"))
    problems = audit(db, role)
    if problems:
        raise ValueError("; ".join(problems))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("audit", "grant-runtime"))
    parser.add_argument("--role", help="Existing dedicated PostgreSQL login; required for grant-runtime")
    args = parser.parse_args()
    if args.action == "grant-runtime" and not args.role:
        parser.error("grant-runtime requires --role")
    load_dotenv()
    engine = create_engine(os.environ["HONOR_DATABASE_URL"], pool_pre_ping=True)
    try:
        with engine.begin() as db:
            role = args.role or db.scalar(text("SELECT current_user"))
            if args.action == "grant-runtime":
                grant_runtime(db, role)
            problems = audit(db, role)
            print(json.dumps({"role": role, "passed": not problems, "findings": problems}, indent=2))
        raise SystemExit(1 if problems else 0)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
