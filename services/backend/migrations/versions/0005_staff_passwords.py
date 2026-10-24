"""Require administrator-issued passwords to be replaced before accessing data."""

from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "identities",
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.false()),
        schema="honor",
    )


def downgrade():
    raise RuntimeError("Use a reviewed forward migration; do not remove first-login protection")
