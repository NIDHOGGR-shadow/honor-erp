-- Honor fresh database installation, generated from Alembic migrations.
-- Run only in the intended Honor project's Supabase SQL editor.
-- Creates empty tables. Does not create accounts, products, stock or passwords.
-- Existing Honor objects cause the whole transaction to stop.
-- For later upgrades use: uv run alembic upgrade head
-- Regenerate: uv run python -m honor.bootstrap

BEGIN;

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



CREATE SCHEMA IF NOT EXISTS honor;

CREATE TABLE honor.alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001

CREATE TABLE honor.companies (
    id VARCHAR(36) NOT NULL,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(80) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    timezone VARCHAR(80) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (slug)
);

CREATE TABLE honor.identities (
    id VARCHAR(36) NOT NULL,
    email VARCHAR(254) NOT NULL,
    name VARCHAR(120) NOT NULL,
    password_hash TEXT,
    PRIMARY KEY (id),
    UNIQUE (email)
);

CREATE TABLE honor.provider_events (
    id VARCHAR(64) NOT NULL,
    provider VARCHAR(20) NOT NULL,
    payload JSON NOT NULL,
    processed BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE honor.rate_windows (
    key VARCHAR(64) NOT NULL,
    hits INTEGER NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (key)
);

CREATE TABLE honor.audit_events (
    id VARCHAR(36) NOT NULL,
    company_id VARCHAR(36) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    action VARCHAR(80) NOT NULL,
    details JSON NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(company_id) REFERENCES honor.companies (id)
);

CREATE TABLE honor.commands (
    company_id VARCHAR(36) NOT NULL,
    key VARCHAR(128) NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    result JSON,
    PRIMARY KEY (company_id, key),
    FOREIGN KEY(company_id) REFERENCES honor.companies (id)
);

CREATE TABLE honor.invitations (
    id VARCHAR(36) NOT NULL,
    company_id VARCHAR(36) NOT NULL,
    email VARCHAR(254) NOT NULL,
    role VARCHAR(16) NOT NULL,
    locations JSON NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted BOOLEAN NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(company_id) REFERENCES honor.companies (id),
    UNIQUE (token_hash)
);

CREATE TABLE honor.locations (
    id VARCHAR(36) NOT NULL,
    company_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(300) NOT NULL,
    fulfil_online BOOLEAN NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (company_id, id),
    UNIQUE (company_id, name),
    FOREIGN KEY(company_id) REFERENCES honor.companies (id)
);

CREATE TABLE honor.login_sessions (
    id VARCHAR(36) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN NOT NULL,
    provider_tokens TEXT,
    mfa BOOLEAN NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (token_hash),
    FOREIGN KEY(user_id) REFERENCES honor.identities (id)
);

CREATE TABLE honor.memberships (
    company_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    role VARCHAR(16) NOT NULL,
    active BOOLEAN NOT NULL,
    PRIMARY KEY (company_id, user_id),
    CONSTRAINT valid_role CHECK (role IN ('ADMIN','MANAGER','STOCK','SALES')),
    FOREIGN KEY(company_id) REFERENCES honor.companies (id),
    FOREIGN KEY(user_id) REFERENCES honor.identities (id)
);

CREATE TABLE honor.outbox (
    id VARCHAR(36) NOT NULL,
    company_id VARCHAR(36) NOT NULL,
    kind VARCHAR(40) NOT NULL,
    payload JSON NOT NULL,
    status VARCHAR(12) NOT NULL,
    attempts INTEGER NOT NULL,
    available_at TIMESTAMP WITH TIME ZONE NOT NULL,
    lease_until TIMESTAMP WITH TIME ZONE,
    last_error VARCHAR(160),
    PRIMARY KEY (id),
    FOREIGN KEY(company_id) REFERENCES honor.companies (id)
);

CREATE TABLE honor.products (
    id VARCHAR(36) NOT NULL,
    company_id VARCHAR(36) NOT NULL,
    sku VARCHAR(80) NOT NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(80) NOT NULL,
    tracking VARCHAR(16) NOT NULL,
    price_minor INTEGER NOT NULL,
    cost_minor INTEGER NOT NULL,
    reorder_point INTEGER NOT NULL,
    published BOOLEAN NOT NULL,
    image_url TEXT NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (company_id, id),
    UNIQUE (company_id, sku),
    CONSTRAINT valid_prices CHECK (price_minor >= 0 AND cost_minor >= 0 AND reorder_point >= 0),
    CONSTRAINT valid_tracking CHECK (tracking IN ('QUANTITY','SERIAL')),
    FOREIGN KEY(company_id) REFERENCES honor.companies (id)
);

CREATE TABLE honor.company_session_blocks (
    company_id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (company_id, session_id),
    FOREIGN KEY(company_id) REFERENCES honor.companies (id),
    FOREIGN KEY(session_id) REFERENCES honor.login_sessions (id)
);

CREATE TABLE honor.location_grants (
    company_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    location_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (company_id, user_id, location_id),
    FOREIGN KEY(company_id, user_id) REFERENCES honor.memberships (company_id, user_id),
    FOREIGN KEY(company_id, location_id) REFERENCES honor.locations (company_id, id)
);

CREATE TABLE honor.orders (
    id VARCHAR(36) NOT NULL,
    company_id VARCHAR(36) NOT NULL,
    location_id VARCHAR(36) NOT NULL,
    customer_name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    access_hash VARCHAR(64) NOT NULL,
    total_minor INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    payment_status VARCHAR(24) NOT NULL,
    status VARCHAR(24) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (company_id, id),
    FOREIGN KEY(company_id, location_id) REFERENCES honor.locations (company_id, id),
    CONSTRAINT valid_order_total CHECK (total_minor >= 0),
    FOREIGN KEY(company_id) REFERENCES honor.companies (id)
);

CREATE TABLE honor.stock_balances (
    company_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    location_id VARCHAR(36) NOT NULL,
    on_hand INTEGER NOT NULL,
    reserved INTEGER NOT NULL,
    PRIMARY KEY (company_id, product_id, location_id),
    FOREIGN KEY(company_id, product_id) REFERENCES honor.products (company_id, id),
    FOREIGN KEY(company_id, location_id) REFERENCES honor.locations (company_id, id),
    CONSTRAINT valid_balance CHECK (on_hand >= 0 AND reserved >= 0 AND reserved <= on_hand)
);

CREATE TABLE honor.stock_movements (
    id VARCHAR(36) NOT NULL,
    company_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    location_id VARCHAR(36) NOT NULL,
    delta INTEGER NOT NULL,
    kind VARCHAR(24) NOT NULL,
    reference VARCHAR(128) NOT NULL,
    actor_id VARCHAR(36) NOT NULL,
    reason VARCHAR(300) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(company_id, product_id) REFERENCES honor.products (company_id, id),
    FOREIGN KEY(company_id, location_id) REFERENCES honor.locations (company_id, id),
    CONSTRAINT nonzero_movement CHECK (delta <> 0)
);

CREATE TABLE honor.transfers (
    id VARCHAR(36) NOT NULL,
    company_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    source_id VARCHAR(36) NOT NULL,
    destination_id VARCHAR(36) NOT NULL,
    quantity INTEGER NOT NULL,
    serial_ids JSON NOT NULL,
    status VARCHAR(20) NOT NULL,
    reason VARCHAR(300) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(company_id, product_id) REFERENCES honor.products (company_id, id),
    FOREIGN KEY(company_id, source_id) REFERENCES honor.locations (company_id, id),
    FOREIGN KEY(company_id, destination_id) REFERENCES honor.locations (company_id, id),
    CONSTRAINT valid_transfer CHECK (quantity > 0 AND source_id <> destination_id)
);

CREATE TABLE honor.order_lines (
    order_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    company_id VARCHAR(36) NOT NULL,
    name VARCHAR(160) NOT NULL,
    quantity INTEGER NOT NULL,
    price_minor INTEGER NOT NULL,
    returned_quantity INTEGER NOT NULL,
    PRIMARY KEY (order_id, product_id),
    FOREIGN KEY(company_id, order_id) REFERENCES honor.orders (company_id, id),
    FOREIGN KEY(company_id, product_id) REFERENCES honor.products (company_id, id),
    CONSTRAINT valid_order_line CHECK (quantity > 0 AND price_minor >= 0 AND returned_quantity >= 0 AND returned_quantity <= quantity)
);

CREATE TABLE honor.payment_attempts (
    id VARCHAR(36) NOT NULL,
    order_id VARCHAR(36) NOT NULL,
    provider VARCHAR(20) NOT NULL,
    reference VARCHAR(160) NOT NULL,
    checkout_url TEXT,
    paid_reference VARCHAR(160),
    provider_id VARCHAR(160),
    PRIMARY KEY (id),
    UNIQUE (order_id),
    FOREIGN KEY(order_id) REFERENCES honor.orders (id),
    UNIQUE (reference),
    UNIQUE (paid_reference)
);

CREATE TABLE honor.serial_units (
    id VARCHAR(36) NOT NULL,
    company_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    location_id VARCHAR(36) NOT NULL,
    serial VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    order_id VARCHAR(36),
    PRIMARY KEY (id),
    FOREIGN KEY(company_id, product_id) REFERENCES honor.products (company_id, id),
    FOREIGN KEY(company_id, location_id) REFERENCES honor.locations (company_id, id),
    UNIQUE (company_id, serial),
    FOREIGN KEY(company_id, order_id) REFERENCES honor.orders (company_id, id),
    CONSTRAINT valid_serial_status CHECK (status IN ('AVAILABLE','RESERVED','SOLD','QUARANTINE','IN_TRANSIT'))
);

CREATE INDEX ix_honor_audit_events_company_id ON honor.audit_events (company_id);

CREATE INDEX ix_honor_invitations_company_id ON honor.invitations (company_id);

CREATE INDEX ix_honor_locations_company_id ON honor.locations (company_id);

CREATE INDEX ix_honor_login_sessions_user_id ON honor.login_sessions (user_id);

CREATE INDEX ix_honor_products_company_id ON honor.products (company_id);

CREATE INDEX ix_honor_orders_company_id ON honor.orders (company_id);

CREATE INDEX movement_lookup ON honor.stock_movements (company_id, created_at);

CREATE INDEX ix_honor_stock_movements_company_id ON honor.stock_movements (company_id);

CREATE INDEX ix_honor_transfers_company_id ON honor.transfers (company_id);

CREATE INDEX ix_honor_serial_units_order_id ON honor.serial_units (order_id);

CREATE INDEX ix_honor_serial_units_company_id ON honor.serial_units (company_id);

CREATE FUNCTION honor.protect_history() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Posted history is append-only'; END; $$;

CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON honor.stock_movements FOR EACH ROW EXECUTE FUNCTION honor.protect_history();

CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON honor.audit_events FOR EACH ROW EXECUTE FUNCTION honor.protect_history();

REVOKE ALL ON SCHEMA honor FROM PUBLIC;

REVOKE ALL ON ALL TABLES IN SCHEMA honor FROM PUBLIC;

DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON SCHEMA honor FROM anon;
        REVOKE ALL ON ALL TABLES IN SCHEMA honor FROM anon;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON SCHEMA honor FROM authenticated;
        REVOKE ALL ON ALL TABLES IN SCHEMA honor FROM authenticated;
    END IF;
    END $$;

INSERT INTO honor.alembic_version (version_num) VALUES ('0001') RETURNING honor.alembic_version.version_num;

-- Running upgrade 0001 -> 0002

ALTER TABLE honor.orders ADD COLUMN customer_id VARCHAR(36) REFERENCES honor.identities(id);

CREATE INDEX ix_honor_orders_customer_id ON honor.orders (customer_id);

UPDATE honor.alembic_version SET version_num='0002' WHERE honor.alembic_version.version_num = '0001';

-- Running upgrade 0002 -> 0003

ALTER TABLE honor.orders ADD COLUMN paid_at TIMESTAMPTZ, ADD COLUMN fulfilled_at TIMESTAMPTZ, ADD COLUMN seller_name VARCHAR(120) NOT NULL DEFAULT '';

ALTER TABLE honor.order_lines ADD COLUMN sku VARCHAR(80) NOT NULL DEFAULT '', ADD COLUMN tracking VARCHAR(16) NOT NULL DEFAULT 'QUANTITY', ADD COLUMN serials JSON NOT NULL DEFAULT '[]';

ALTER TABLE honor.payment_attempts ADD COLUMN channel VARCHAR(32);

UPDATE honor.orders o SET seller_name = c.name FROM honor.companies c WHERE c.id = o.company_id;

UPDATE honor.order_lines l SET sku = p.sku, tracking = p.tracking FROM honor.products p WHERE p.id = l.product_id AND p.company_id = l.company_id;

UPDATE honor.order_lines l SET serials = s.serials
        FROM (SELECT company_id, order_id, product_id, json_agg(serial ORDER BY serial) AS serials
              FROM honor.serial_units WHERE order_id IS NOT NULL AND status IN ('SOLD', 'QUARANTINE')
              GROUP BY company_id, order_id, product_id) s
        WHERE l.company_id = s.company_id AND l.order_id = s.order_id AND l.product_id = s.product_id;

UPDATE honor.alembic_version SET version_num='0003' WHERE honor.alembic_version.version_num = '0002';

-- Running upgrade 0003 -> 0004

REVOKE ALL ON SCHEMA honor FROM PUBLIC;

REVOKE ALL ON ALL TABLES IN SCHEMA honor FROM PUBLIC;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA honor FROM PUBLIC;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA honor FROM PUBLIC;

DO $$
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
    END $$;

ALTER FUNCTION honor.protect_history() SET search_path = pg_catalog;

UPDATE honor.alembic_version SET version_num='0004' WHERE honor.alembic_version.version_num = '0003';

-- Running upgrade 0004 -> 0005

ALTER TABLE honor.identities ADD COLUMN must_change_password BOOLEAN DEFAULT false NOT NULL;

UPDATE honor.alembic_version SET version_num='0005' WHERE honor.alembic_version.version_num = '0004';

COMMIT;
