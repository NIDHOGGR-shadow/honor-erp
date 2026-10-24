"""Export the existing Alembic migrations as a fresh-install SQL script.

This command never connects to a database. Later upgrades use Alembic normally.
"""

import argparse
import io
import os
from pathlib import Path

from alembic import command
from alembic.config import Config

OUTPUT = Path(__file__).resolve().parents[3] / "deploy/honor-bootstrap.sql"
HEADER = """-- Honor fresh database installation, generated from Alembic migrations.
-- Run only in the intended Honor project's Supabase SQL editor.
-- Creates empty tables. Does not create accounts, products, stock or passwords.
-- Existing Honor objects cause the whole transaction to stop.
-- For later upgrades use: uv run alembic upgrade head
-- Regenerate: uv run python -m honor.bootstrap

"""
GUARD = """
DO $honor_install$
BEGIN
    IF EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='honor')
       OR EXISTS (SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                  WHERE n.nspname='honor')
       OR EXISTS (SELECT FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
                  WHERE n.nspname='honor') THEN
        RAISE EXCEPTION 'Honor objects already exist. Use Alembic upgrades instead of the fresh-install script.';
    END IF;
END $honor_install$;

"""


def render_sql():
    output = io.StringIO()
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"), output_buffer=output)
    # The migration environment reads this URL. Offline mode needs a dialect,
    # never a real host or a credential. Restore the caller's environment.
    previous = os.environ.get("HONOR_DATABASE_URL")
    os.environ["HONOR_DATABASE_URL"] = "postgresql+psycopg://"
    try:
        command.upgrade(config, "head", sql=True)
    finally:
        if previous is None:
            os.environ.pop("HONOR_DATABASE_URL", None)
        else:
            os.environ["HONOR_DATABASE_URL"] = previous
    sql = output.getvalue()
    if not sql.startswith("BEGIN;") or not sql.rstrip().endswith("COMMIT;"):
        raise RuntimeError("Expected one transactional PostgreSQL migration script")
    exported = HEADER + sql.replace("BEGIN;", "BEGIN;\n" + GUARD, 1)
    return "\n".join(line.rstrip() for line in exported.splitlines()).rstrip() + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument(
        "--check", action="store_true", help="Check the committed export without rewriting it"
    )
    args = parser.parse_args()
    sql = render_sql()
    if args.check:
        if not args.output.exists() or args.output.read_text() != sql:
            raise SystemExit("Database export is missing or stale; run python -m honor.bootstrap")
        print("Database SQL export matches the current migrations")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(sql)
        print("Wrote fresh-install SQL:", args.output)


if __name__ == "__main__":
    main()
