"""add_last_login_at_to_users

Revision ID: add_last_login_at_simple
Revises: fix_projectstatus_enum
Create Date: 2026-03-31 17:52:05.574766

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_last_login_at_simple'
down_revision = 'fix_projectstatus_enum'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add last_login_at column to users table
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Remove last_login_at column from users table
    op.drop_column('users', 'last_login_at')