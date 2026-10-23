"""Create the initial inventory and commerce schema. Static DDL snapshot."""

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

DDL = [
    "\nCREATE TABLE honor.companies (\n\tid VARCHAR(36) NOT NULL, \n\tname VARCHAR(120) NOT NULL, \n\tslug VARCHAR(80) NOT NULL, \n\tcurrency VARCHAR(3) NOT NULL, \n\ttimezone VARCHAR(80) NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (slug)\n)\n\n",
    "\nCREATE TABLE honor.identities (\n\tid VARCHAR(36) NOT NULL, \n\temail VARCHAR(254) NOT NULL, \n\tname VARCHAR(120) NOT NULL, \n\tpassword_hash TEXT, \n\tPRIMARY KEY (id), \n\tUNIQUE (email)\n)\n\n",
    "\nCREATE TABLE honor.provider_events (\n\tid VARCHAR(64) NOT NULL, \n\tprovider VARCHAR(20) NOT NULL, \n\tpayload JSON NOT NULL, \n\tprocessed BOOLEAN NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (id)\n)\n\n",
    "\nCREATE TABLE honor.rate_windows (\n\tkey VARCHAR(64) NOT NULL, \n\thits INTEGER NOT NULL, \n\texpires_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (key)\n)\n\n",
    "\nCREATE TABLE honor.audit_events (\n\tid VARCHAR(36) NOT NULL, \n\tcompany_id VARCHAR(36) NOT NULL, \n\tactor_id VARCHAR(64) NOT NULL, \n\taction VARCHAR(80) NOT NULL, \n\tdetails JSON NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(company_id) REFERENCES honor.companies (id)\n)\n\n",
    "\nCREATE TABLE honor.commands (\n\tcompany_id VARCHAR(36) NOT NULL, \n\tkey VARCHAR(128) NOT NULL, \n\tfingerprint VARCHAR(64) NOT NULL, \n\tresult JSON, \n\tPRIMARY KEY (company_id, key), \n\tFOREIGN KEY(company_id) REFERENCES honor.companies (id)\n)\n\n",
    "\nCREATE TABLE honor.invitations (\n\tid VARCHAR(36) NOT NULL, \n\tcompany_id VARCHAR(36) NOT NULL, \n\temail VARCHAR(254) NOT NULL, \n\trole VARCHAR(16) NOT NULL, \n\tlocations JSON NOT NULL, \n\ttoken_hash VARCHAR(64) NOT NULL, \n\texpires_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\taccepted BOOLEAN NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(company_id) REFERENCES honor.companies (id), \n\tUNIQUE (token_hash)\n)\n\n",
    "\nCREATE TABLE honor.locations (\n\tid VARCHAR(36) NOT NULL, \n\tcompany_id VARCHAR(36) NOT NULL, \n\tname VARCHAR(100) NOT NULL, \n\taddress VARCHAR(300) NOT NULL, \n\tfulfil_online BOOLEAN NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (company_id, id), \n\tUNIQUE (company_id, name), \n\tFOREIGN KEY(company_id) REFERENCES honor.companies (id)\n)\n\n",
    "\nCREATE TABLE honor.login_sessions (\n\tid VARCHAR(36) NOT NULL, \n\ttoken_hash VARCHAR(64) NOT NULL, \n\tuser_id VARCHAR(36) NOT NULL, \n\texpires_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tverified_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\trevoked BOOLEAN NOT NULL, \n\tprovider_tokens TEXT, \n\tmfa BOOLEAN NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (token_hash), \n\tFOREIGN KEY(user_id) REFERENCES honor.identities (id)\n)\n\n",
    "\nCREATE TABLE honor.memberships (\n\tcompany_id VARCHAR(36) NOT NULL, \n\tuser_id VARCHAR(36) NOT NULL, \n\trole VARCHAR(16) NOT NULL, \n\tactive BOOLEAN NOT NULL, \n\tPRIMARY KEY (company_id, user_id), \n\tCONSTRAINT valid_role CHECK (role IN ('ADMIN','MANAGER','STOCK','SALES')), \n\tFOREIGN KEY(company_id) REFERENCES honor.companies (id), \n\tFOREIGN KEY(user_id) REFERENCES honor.identities (id)\n)\n\n",
    "\nCREATE TABLE honor.outbox (\n\tid VARCHAR(36) NOT NULL, \n\tcompany_id VARCHAR(36) NOT NULL, \n\tkind VARCHAR(40) NOT NULL, \n\tpayload JSON NOT NULL, \n\tstatus VARCHAR(12) NOT NULL, \n\tattempts INTEGER NOT NULL, \n\tavailable_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tlease_until TIMESTAMP WITH TIME ZONE, \n\tlast_error VARCHAR(160), \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(company_id) REFERENCES honor.companies (id)\n)\n\n",
    "\nCREATE TABLE honor.products (\n\tid VARCHAR(36) NOT NULL, \n\tcompany_id VARCHAR(36) NOT NULL, \n\tsku VARCHAR(80) NOT NULL, \n\tname VARCHAR(160) NOT NULL, \n\tdescription TEXT NOT NULL, \n\tcategory VARCHAR(80) NOT NULL, \n\ttracking VARCHAR(16) NOT NULL, \n\tprice_minor INTEGER NOT NULL, \n\tcost_minor INTEGER NOT NULL, \n\treorder_point INTEGER NOT NULL, \n\tpublished BOOLEAN NOT NULL, \n\timage_url TEXT NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (company_id, id), \n\tUNIQUE (company_id, sku), \n\tCONSTRAINT valid_prices CHECK (price_minor >= 0 AND cost_minor >= 0 AND reorder_point >= 0), \n\tCONSTRAINT valid_tracking CHECK (tracking IN ('QUANTITY','SERIAL')), \n\tFOREIGN KEY(company_id) REFERENCES honor.companies (id)\n)\n\n",
    "\nCREATE TABLE honor.company_session_blocks (\n\tcompany_id VARCHAR(36) NOT NULL, \n\tsession_id VARCHAR(36) NOT NULL, \n\tPRIMARY KEY (company_id, session_id), \n\tFOREIGN KEY(company_id) REFERENCES honor.companies (id), \n\tFOREIGN KEY(session_id) REFERENCES honor.login_sessions (id)\n)\n\n",
    "\nCREATE TABLE honor.location_grants (\n\tcompany_id VARCHAR(36) NOT NULL, \n\tuser_id VARCHAR(36) NOT NULL, \n\tlocation_id VARCHAR(36) NOT NULL, \n\tPRIMARY KEY (company_id, user_id, location_id), \n\tFOREIGN KEY(company_id, user_id) REFERENCES honor.memberships (company_id, user_id), \n\tFOREIGN KEY(company_id, location_id) REFERENCES honor.locations (company_id, id)\n)\n\n",
    "\nCREATE TABLE honor.orders (\n\tid VARCHAR(36) NOT NULL, \n\tcompany_id VARCHAR(36) NOT NULL, \n\tlocation_id VARCHAR(36) NOT NULL, \n\tcustomer_name VARCHAR(120) NOT NULL, \n\temail VARCHAR(254) NOT NULL, \n\taccess_hash VARCHAR(64) NOT NULL, \n\ttotal_minor INTEGER NOT NULL, \n\tcurrency VARCHAR(3) NOT NULL, \n\tpayment_status VARCHAR(24) NOT NULL, \n\tstatus VARCHAR(24) NOT NULL, \n\texpires_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (company_id, id), \n\tFOREIGN KEY(company_id, location_id) REFERENCES honor.locations (company_id, id), \n\tCONSTRAINT valid_order_total CHECK (total_minor >= 0), \n\tFOREIGN KEY(company_id) REFERENCES honor.companies (id)\n)\n\n",
    "\nCREATE TABLE honor.stock_balances (\n\tcompany_id VARCHAR(36) NOT NULL, \n\tproduct_id VARCHAR(36) NOT NULL, \n\tlocation_id VARCHAR(36) NOT NULL, \n\ton_hand INTEGER NOT NULL, \n\treserved INTEGER NOT NULL, \n\tPRIMARY KEY (company_id, product_id, location_id), \n\tFOREIGN KEY(company_id, product_id) REFERENCES honor.products (company_id, id), \n\tFOREIGN KEY(company_id, location_id) REFERENCES honor.locations (company_id, id), \n\tCONSTRAINT valid_balance CHECK (on_hand >= 0 AND reserved >= 0 AND reserved <= on_hand)\n)\n\n",
    "\nCREATE TABLE honor.stock_movements (\n\tid VARCHAR(36) NOT NULL, \n\tcompany_id VARCHAR(36) NOT NULL, \n\tproduct_id VARCHAR(36) NOT NULL, \n\tlocation_id VARCHAR(36) NOT NULL, \n\tdelta INTEGER NOT NULL, \n\tkind VARCHAR(24) NOT NULL, \n\treference VARCHAR(128) NOT NULL, \n\tactor_id VARCHAR(36) NOT NULL, \n\treason VARCHAR(300) NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(company_id, product_id) REFERENCES honor.products (company_id, id), \n\tFOREIGN KEY(company_id, location_id) REFERENCES honor.locations (company_id, id), \n\tCONSTRAINT nonzero_movement CHECK (delta <> 0)\n)\n\n",
    "\nCREATE TABLE honor.transfers (\n\tid VARCHAR(36) NOT NULL, \n\tcompany_id VARCHAR(36) NOT NULL, \n\tproduct_id VARCHAR(36) NOT NULL, \n\tsource_id VARCHAR(36) NOT NULL, \n\tdestination_id VARCHAR(36) NOT NULL, \n\tquantity INTEGER NOT NULL, \n\tserial_ids JSON NOT NULL, \n\tstatus VARCHAR(20) NOT NULL, \n\treason VARCHAR(300) NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(company_id, product_id) REFERENCES honor.products (company_id, id), \n\tFOREIGN KEY(company_id, source_id) REFERENCES honor.locations (company_id, id), \n\tFOREIGN KEY(company_id, destination_id) REFERENCES honor.locations (company_id, id), \n\tCONSTRAINT valid_transfer CHECK (quantity > 0 AND source_id <> destination_id)\n)\n\n",
    "\nCREATE TABLE honor.order_lines (\n\torder_id VARCHAR(36) NOT NULL, \n\tproduct_id VARCHAR(36) NOT NULL, \n\tcompany_id VARCHAR(36) NOT NULL, \n\tname VARCHAR(160) NOT NULL, \n\tquantity INTEGER NOT NULL, \n\tprice_minor INTEGER NOT NULL, \n\treturned_quantity INTEGER NOT NULL, \n\tPRIMARY KEY (order_id, product_id), \n\tFOREIGN KEY(company_id, order_id) REFERENCES honor.orders (company_id, id), \n\tFOREIGN KEY(company_id, product_id) REFERENCES honor.products (company_id, id), \n\tCONSTRAINT valid_order_line CHECK (quantity > 0 AND price_minor >= 0 AND returned_quantity >= 0 AND returned_quantity <= quantity)\n)\n\n",
    "\nCREATE TABLE honor.payment_attempts (\n\tid VARCHAR(36) NOT NULL, \n\torder_id VARCHAR(36) NOT NULL, \n\tprovider VARCHAR(20) NOT NULL, \n\treference VARCHAR(160) NOT NULL, \n\tcheckout_url TEXT, \n\tpaid_reference VARCHAR(160), \n\tprovider_id VARCHAR(160), \n\tPRIMARY KEY (id), \n\tUNIQUE (order_id), \n\tFOREIGN KEY(order_id) REFERENCES honor.orders (id), \n\tUNIQUE (reference), \n\tUNIQUE (paid_reference)\n)\n\n",
    "\nCREATE TABLE honor.serial_units (\n\tid VARCHAR(36) NOT NULL, \n\tcompany_id VARCHAR(36) NOT NULL, \n\tproduct_id VARCHAR(36) NOT NULL, \n\tlocation_id VARCHAR(36) NOT NULL, \n\tserial VARCHAR(100) NOT NULL, \n\tstatus VARCHAR(20) NOT NULL, \n\torder_id VARCHAR(36), \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(company_id, product_id) REFERENCES honor.products (company_id, id), \n\tFOREIGN KEY(company_id, location_id) REFERENCES honor.locations (company_id, id), \n\tUNIQUE (company_id, serial), \n\tFOREIGN KEY(company_id, order_id) REFERENCES honor.orders (company_id, id), \n\tCONSTRAINT valid_serial_status CHECK (status IN ('AVAILABLE','RESERVED','SOLD','QUARANTINE','IN_TRANSIT'))\n)\n\n",
    "CREATE INDEX ix_honor_audit_events_company_id ON honor.audit_events (company_id)",
    "CREATE INDEX ix_honor_invitations_company_id ON honor.invitations (company_id)",
    "CREATE INDEX ix_honor_locations_company_id ON honor.locations (company_id)",
    "CREATE INDEX ix_honor_login_sessions_user_id ON honor.login_sessions (user_id)",
    "CREATE INDEX ix_honor_products_company_id ON honor.products (company_id)",
    "CREATE INDEX ix_honor_orders_company_id ON honor.orders (company_id)",
    "CREATE INDEX movement_lookup ON honor.stock_movements (company_id, created_at)",
    "CREATE INDEX ix_honor_stock_movements_company_id ON honor.stock_movements (company_id)",
    "CREATE INDEX ix_honor_transfers_company_id ON honor.transfers (company_id)",
    "CREATE INDEX ix_honor_serial_units_order_id ON honor.serial_units (order_id)",
    "CREATE INDEX ix_honor_serial_units_company_id ON honor.serial_units (company_id)",
]


def upgrade():
    for statement in DDL:
        op.execute(statement)
    op.execute("""CREATE FUNCTION honor.protect_history() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Posted history is append-only'; END; $$""")
    for table in ("stock_movements", "audit_events"):
        op.execute(
            f"CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON honor.{table} FOR EACH ROW EXECUTE FUNCTION honor.protect_history()"
        )
    op.execute("REVOKE ALL ON SCHEMA honor FROM PUBLIC")
    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA honor FROM PUBLIC")
    op.execute("""DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON SCHEMA honor FROM anon;
        REVOKE ALL ON ALL TABLES IN SCHEMA honor FROM anon;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON SCHEMA honor FROM authenticated;
        REVOKE ALL ON ALL TABLES IN SCHEMA honor FROM authenticated;
    END IF;
    END $$""")


def downgrade():
    raise RuntimeError(
        "Restore a reviewed backup or create an explicit forward migration; do not drop the stock ledger"
    )
