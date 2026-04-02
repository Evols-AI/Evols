"""add_updated_at_to_skill_memory

Revision ID: 13b853cefe13
Revises: 021
Create Date: 2026-03-19 23:07:25.084998

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '13b853cefe13'
down_revision = '021'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add updated_at column to skill_memory table
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = [col['name'] for col in insp.get_columns('skill_memory')]
    if 'updated_at' not in columns:
        op.add_column('skill_memory',
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()'))
        )


def downgrade() -> None:
    # Remove updated_at column
    op.drop_column('skill_memory', 'updated_at')
