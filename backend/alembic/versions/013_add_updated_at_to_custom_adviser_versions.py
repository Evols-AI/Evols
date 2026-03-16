"""add updated_at to custom_adviser_versions

Revision ID: 013
Revises: 012
Create Date: 2026-03-13

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None


def upgrade():
    # Add updated_at column to custom_adviser_versions
    op.add_column('custom_adviser_versions',
                  sa.Column('updated_at', sa.DateTime(), nullable=False,
                           server_default=sa.func.now()))


def downgrade():
    op.drop_column('custom_adviser_versions', 'updated_at')
