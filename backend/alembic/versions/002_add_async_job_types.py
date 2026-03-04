"""add async job types

Revision ID: 002
Revises: 001
Create Date: 2025-03-01

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade():
    # Add new job types to the enum
    op.execute("""
        ALTER TYPE jobtype ADD VALUE IF NOT EXISTS 'THEME_REFRESH';
        ALTER TYPE jobtype ADD VALUE IF NOT EXISTS 'PROJECT_GENERATION';
    """)


def downgrade():
    # Cannot easily remove enum values in PostgreSQL
    # Would require recreating the enum and updating all references
    pass
