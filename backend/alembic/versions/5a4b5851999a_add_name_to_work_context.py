"""add_name_to_work_context

Revision ID: 5a4b5851999a
Revises: f7d6ed14b5e1
Create Date: 2026-03-23 14:14:31.726510

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5a4b5851999a'
down_revision = 'f7d6ed14b5e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add name column to work_context table
    op.add_column('work_context', sa.Column('name', sa.String(length=255), nullable=True))


def downgrade() -> None:
    # Remove name column from work_context table
    op.drop_column('work_context', 'name')
