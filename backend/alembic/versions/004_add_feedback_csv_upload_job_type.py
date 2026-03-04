"""add feedback_csv_upload job type

Revision ID: 004
Revises: 003
Create Date: 2025-03-03

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    # Add FEEDBACK_CSV_UPLOAD job type to the enum (uppercase to match database convention)
    op.execute("""
        ALTER TYPE jobtype ADD VALUE IF NOT EXISTS 'FEEDBACK_CSV_UPLOAD';
    """)


def downgrade():
    # Cannot easily remove enum values in PostgreSQL
    # Would require recreating the enum and updating all references
    pass
