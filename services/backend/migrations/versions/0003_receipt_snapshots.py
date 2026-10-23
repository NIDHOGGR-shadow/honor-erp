"""Preserve sale identifiers after a returned device re-enters stock."""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE honor.orders ADD COLUMN paid_at TIMESTAMPTZ, ADD COLUMN fulfilled_at TIMESTAMPTZ, ADD COLUMN seller_name VARCHAR(120) NOT NULL DEFAULT ''"
    )
    op.execute(
        "ALTER TABLE honor.order_lines ADD COLUMN sku VARCHAR(80) NOT NULL DEFAULT '', ADD COLUMN tracking VARCHAR(16) NOT NULL DEFAULT 'QUANTITY', ADD COLUMN serials JSON NOT NULL DEFAULT '[]'"
    )
    op.execute("ALTER TABLE honor.payment_attempts ADD COLUMN channel VARCHAR(32)")
    op.execute(
        "UPDATE honor.orders o SET seller_name = c.name FROM honor.companies c WHERE c.id = o.company_id"
    )
    op.execute(
        "UPDATE honor.order_lines l SET sku = p.sku, tracking = p.tracking FROM honor.products p WHERE p.id = l.product_id AND p.company_id = l.company_id"
    )
    # Recover only identifiers still linked to a completed sale. Never guess historical devices.
    op.execute("""UPDATE honor.order_lines l SET serials = s.serials
        FROM (SELECT company_id, order_id, product_id, json_agg(serial ORDER BY serial) AS serials
              FROM honor.serial_units WHERE order_id IS NOT NULL AND status IN ('SOLD', 'QUARANTINE')
              GROUP BY company_id, order_id, product_id) s
        WHERE l.company_id = s.company_id AND l.order_id = s.order_id AND l.product_id = s.product_id""")


def downgrade():
    raise RuntimeError("Use a reviewed forward migration to preserve sale and receipt history")
