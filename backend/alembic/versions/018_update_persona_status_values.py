"""Update persona status values from advisor/dismissed to active/inactive

Revision ID: 018
Revises: 017
Create Date: 2026-03-15

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '018'
down_revision = '017'
branch_labels = None
depends_on = None


def upgrade():
    # Update existing persona status values
    # advisor -> active
    # dismissed -> inactive
    # new -> new (unchanged)

    op.execute("""
        UPDATE persona
        SET status = 'active'
        WHERE status = 'advisor'
    """)

    op.execute("""
        UPDATE persona
        SET status = 'inactive'
        WHERE status = 'dismissed'
    """)

    # Update the column comment to reflect new values
    op.alter_column(
        'persona',
        'status',
        comment='Persona lifecycle status: new, active, inactive'
    )


def downgrade():
    # Revert status values back to old names
    # active -> advisor
    # inactive -> dismissed
    # new -> new (unchanged)

    op.execute("""
        UPDATE persona
        SET status = 'advisor'
        WHERE status = 'active'
    """)

    op.execute("""
        UPDATE persona
        SET status = 'dismissed'
        WHERE status = 'inactive'
    """)

    # Revert the column comment
    op.alter_column(
        'persona',
        'status',
        comment='Persona lifecycle status: new, advisor, dismissed'
    )
