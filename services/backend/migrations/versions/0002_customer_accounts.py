"""Associate authenticated checkouts with their verified account, never by email lookup."""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE honor.orders ADD COLUMN customer_id VARCHAR(36) REFERENCES honor.identities(id)")
    op.execute("CREATE INDEX ix_honor_orders_customer_id ON honor.orders (customer_id)")


def downgrade():
    raise RuntimeError("Use a reviewed forward migration to preserve customer order ownership")
