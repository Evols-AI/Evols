"""Add granular capture fields to knowledge_entries and quota_events

Revision ID: 028
Revises: 027
Create Date: 2026-04-30

knowledge_entries:
  - content_hash: SHA256-derived 16-char dedup key — UNIQUE per tenant
  - files_read: JSON array of file paths read during the session
  - files_modified: JSON array of file paths written/edited during the session
  - discovery_tokens: raw tool output token cost before compression (honest savings basis)
  - model: Claude model ID that produced this entry

quota_events:
  - model: Claude model ID for the session
  - cost_usd: actual API cost computed from real per-model pricing
"""
from alembic import op
import sqlalchemy as sa


revision = '028'
down_revision = '027'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # knowledge_entries — granular capture + dedup
    op.add_column('knowledge_entries', sa.Column('content_hash', sa.String(16), nullable=True))
    op.add_column('knowledge_entries', sa.Column('files_read', sa.JSON(), nullable=True))
    op.add_column('knowledge_entries', sa.Column('files_modified', sa.JSON(), nullable=True))
    op.add_column('knowledge_entries', sa.Column('discovery_tokens', sa.Integer(), nullable=True))
    op.add_column('knowledge_entries', sa.Column('model', sa.String(100), nullable=True))

    # Unique index: one entry per content hash per tenant — prevents duplicate syncs
    op.create_index(
        'ix_knowledge_entries_tenant_content_hash',
        'knowledge_entries',
        ['tenant_id', 'content_hash'],
        unique=True,
        postgresql_where=sa.text('content_hash IS NOT NULL'),
    )

    # quota_events — per-model cost tracking
    op.add_column('quota_events', sa.Column('model', sa.String(100), nullable=True))
    op.add_column('quota_events', sa.Column('cost_usd', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('quota_events', 'cost_usd')
    op.drop_column('quota_events', 'model')
    op.drop_index('ix_knowledge_entries_tenant_content_hash', table_name='knowledge_entries')
    op.drop_column('knowledge_entries', 'model')
    op.drop_column('knowledge_entries', 'discovery_tokens')
    op.drop_column('knowledge_entries', 'files_modified')
    op.drop_column('knowledge_entries', 'files_read')
    op.drop_column('knowledge_entries', 'content_hash')
