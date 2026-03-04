"""add persona status column

Revision ID: 001
Revises:
Create Date: 2025-02-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """Add status column to personas table"""
    op.add_column('persona',
        sa.Column('status', sa.String(20), nullable=False, server_default='new')
    )
    op.create_index('ix_persona_status', 'persona', ['status'])


def downgrade():
    """Remove status column from personas table"""
    op.drop_index('ix_persona_status', 'persona')
    op.drop_column('persona', 'status')
