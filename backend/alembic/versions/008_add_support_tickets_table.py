"""add support tickets table

Revision ID: 008
Revises: 007
Create Date: 2026-03-08

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'support_tickets',
        sa.Column('id', sa.String(36), primary_key=True, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('topic', sa.String(100), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='open'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Add index on status and created_at for faster queries
    op.create_index('ix_support_tickets_status', 'support_tickets', ['status'])
    op.create_index('ix_support_tickets_created_at', 'support_tickets', ['created_at'])


def downgrade():
    op.drop_index('ix_support_tickets_created_at', 'support_tickets')
    op.drop_index('ix_support_tickets_status', 'support_tickets')
    op.drop_table('support_tickets')
