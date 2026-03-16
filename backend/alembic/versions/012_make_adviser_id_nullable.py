"""make adviser_id nullable in conversations

Revision ID: 012
Revises: 011
Create Date: 2026-03-13

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '012'
down_revision = '011'
branch_labels = None
depends_on = None


def upgrade():
    # Make adviser_id nullable in conversations table
    # This field is deprecated - adviser info is now tracked per message
    op.alter_column('conversations', 'adviser_id',
                    existing_type=sa.Integer(),
                    nullable=True)

    # Make adviser_type nullable as well (also deprecated)
    op.alter_column('conversations', 'adviser_type',
                    existing_type=sa.String(20),
                    nullable=True)

    # Make phase nullable (also deprecated)
    op.alter_column('conversations', 'phase',
                    existing_type=sa.String(50),
                    nullable=True)


def downgrade():
    # Note: Cannot easily revert to NOT NULL since existing data may have NULLs
    # If needed, would require setting default values first
    pass
