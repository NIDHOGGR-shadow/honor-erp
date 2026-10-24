-- Operator-only, first-time setup after Honor's database migration.
-- Creates a restricted machine login, not an application administrator.
-- The password is generated inside PostgreSQL and saved encrypted in Vault.
-- Do not return or log the password. Never use this script to rotate an existing login.

DO $honor_runtime$
DECLARE runtime_password text;
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='honor_api')
       OR EXISTS (SELECT FROM vault.secrets WHERE name='honor_runtime_database_password') THEN
        RAISE EXCEPTION 'Honor runtime login or named secret already exists; review it instead of overwriting.';
    END IF;

    runtime_password := encode(extensions.gen_random_bytes(32), 'hex');
    BEGIN
        EXECUTE format(
            'CREATE ROLE honor_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
            runtime_password
        );
    EXCEPTION WHEN OTHERS THEN
        -- Avoid including a dynamic CREATE ROLE command or its password in an error.
        RAISE EXCEPTION 'Could not create the runtime login; no setup changes were saved.';
    END;

    PERFORM vault.create_secret(
        runtime_password,
        'honor_runtime_database_password',
        'Generated password for Honor backend PostgreSQL login honor_api; operator-only access.'
    );
END $honor_runtime$;

ALTER ROLE honor_api SET search_path TO pg_catalog, honor;
GRANT USAGE ON SCHEMA honor TO honor_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA honor TO honor_api;
REVOKE ALL ON honor.alembic_version FROM honor_api;
REVOKE UPDATE, DELETE, TRUNCATE ON honor.stock_movements, honor.audit_events FROM honor_api;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA honor FROM honor_api;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA honor FROM honor_api;
REVOKE CREATE ON SCHEMA honor FROM honor_api;
REVOKE ALL ON SCHEMA vault FROM honor_api;
REVOKE ALL ON vault.secrets, vault.decrypted_secrets FROM honor_api;
