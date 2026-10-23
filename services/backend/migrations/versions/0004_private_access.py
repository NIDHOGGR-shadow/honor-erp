"""Keep every current Honor object private to the backend."""

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    # Scope these revocations to Honor. Never change another app's public schema
    # or global default privileges on a shared Supabase database.
    op.execute("REVOKE ALL ON SCHEMA honor FROM PUBLIC")
    for objects in ("TABLES", "SEQUENCES", "FUNCTIONS"):
        op.execute(f"REVOKE ALL ON ALL {objects} IN SCHEMA honor FROM PUBLIC")
    op.execute("""DO $$
    DECLARE api_role text;
    BEGIN
      FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = api_role) THEN
          EXECUTE format('REVOKE ALL ON SCHEMA honor FROM %I', api_role);
          EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA honor FROM %I', api_role);
          EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA honor FROM %I', api_role);
          EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA honor FROM %I', api_role);
        END IF;
      END LOOP;
    END $$""")
    op.execute("ALTER FUNCTION honor.protect_history() SET search_path = pg_catalog")


def downgrade():
    raise RuntimeError("Use a reviewed forward migration; do not restore public database access")
