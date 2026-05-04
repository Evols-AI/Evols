"""add user_id to context_sources for personal contribution tracking

Revision ID: add_user_id_to_context_sources
Revises: f7d6ed14b5e1
Create Date: 2026-05-03

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_user_id_to_context_sources'
down_revision = 'merge_pre_user_id_ctx'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'context_sources',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
    )
    op.execute('CREATE INDEX IF NOT EXISTS ix_context_sources_user_id ON context_sources (user_id)')


def downgrade() -> None:
    op.drop_index('ix_context_sources_user_id', table_name='context_sources')
    op.drop_column('context_sources', 'user_id')
