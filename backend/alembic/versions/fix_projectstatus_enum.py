"""fix projectstatus enum values

Revision ID: fix_projectstatus_enum
Revises: 31cb144bffb6
Create Date: 2026-03-26 04:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fix_projectstatus_enum'
down_revision = '31cb144bffb6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new enum values to existing projectstatus enum
    # PostgreSQL allows adding values to enums without recreating them
    op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'green'")
    op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'yellow'")
    op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'red'")
    op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'paused'")

    # Note: 'completed' already exists from old enum, 'cancelled' remains for project table


def downgrade() -> None:
    # Can't remove enum values in PostgreSQL without recreating the enum
    # This is a no-op downgrade
    pass
