"""add_missing_model_columns

Columns that existed in SQLAlchemy models but were never applied to the DB
because the app uses create_all (which skips existing tables). These were
manually patched on 2026-05-04 and this migration records the change so
future fresh installs apply them correctly.

Revision ID: 029
Revises: add_user_id_to_context_sources
Create Date: 2026-05-04
"""
from alembic import op
import sqlalchemy as sa

revision = '029'
down_revision = 'add_user_id_to_context_sources'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # knowledge_entries
    op.add_column('knowledge_entries', sa.Column('content_hash', sa.String(16), nullable=True))
    op.add_column('knowledge_entries', sa.Column('files_read', sa.JSON(), nullable=True))
    op.add_column('knowledge_entries', sa.Column('files_modified', sa.JSON(), nullable=True))
    op.add_column('knowledge_entries', sa.Column('discovery_tokens', sa.Integer(), nullable=True))
    op.add_column('knowledge_entries', sa.Column('model', sa.String(100), nullable=True))

    # quota_events
    op.add_column('quota_events', sa.Column('event_category', sa.Enum('creation', 'retrieval', 'mixed', name='eventcategory'), nullable=False, server_default='creation'))
    op.add_column('quota_events', sa.Column('tokens_invested', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('quota_events', sa.Column('actual_savings', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('quota_events', sa.Column('model', sa.String(100), nullable=True))
    op.add_column('quota_events', sa.Column('cost_usd', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('quota_events', 'cost_usd')
    op.drop_column('quota_events', 'model')
    op.drop_column('quota_events', 'actual_savings')
    op.drop_column('quota_events', 'tokens_invested')
    op.drop_column('quota_events', 'event_category')
    op.drop_column('knowledge_entries', 'model')
    op.drop_column('knowledge_entries', 'discovery_tokens')
    op.drop_column('knowledge_entries', 'files_modified')
    op.drop_column('knowledge_entries', 'files_read')
    op.drop_column('knowledge_entries', 'content_hash')
