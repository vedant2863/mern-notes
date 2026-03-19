"""create products and sales tables

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "products",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("price", sa.Float, nullable=False),
        sa.Column("stock_quantity", sa.Integer, nullable=False, server_default="0"),
        sa.Column("barcode", sa.String, unique=True, nullable=True),
        sa.Column("category", sa.String, nullable=True),
    )

    op.create_table(
        "sales",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("items", sa.JSON, nullable=False),
        sa.Column("total", sa.Float, nullable=False),
        sa.Column("payment_method", sa.String, nullable=False, server_default="cash"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("sales")
    op.drop_table("products")
