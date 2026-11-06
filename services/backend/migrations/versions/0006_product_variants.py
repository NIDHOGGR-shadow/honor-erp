"""Product variants and editable storefront content."""

from alembic import op
import sqlalchemy as sa

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "companies", sa.Column("storefront_content", sa.JSON(), nullable=False, server_default="{}"),
        schema="honor",
    )
    for name, column_type in (
        ("model_name", sa.String(160)),
        ("colour", sa.String(80)),
        ("memory", sa.String(80)),
        ("market", sa.String(80)),
        ("source_url", sa.Text()),
    ):
        op.add_column(
            "products", sa.Column(name, column_type, nullable=False, server_default=""), schema="honor"
        )


def downgrade():
    raise RuntimeError("Use a reviewed forward migration; preserve existing product variant information")
