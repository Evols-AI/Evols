"""Add product attribution to knowledge entries

Revision ID: 025
Revises: 024_merge_heads
Create Date: 2026-04-14
"""

from alembic import op
import sqlalchemy as sa

revision = '025'
down_revision = '024'
branch_labels = None
depends_on = None


def upgrade():
    # Add product_id FK, source, and parent_entry_id to knowledge_entries
    op.add_column('knowledge_entries',
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id', ondelete='SET NULL'), nullable=True)
    )
    op.add_column('knowledge_entries',
        sa.Column('source', sa.String(50), nullable=False, server_default='claude-code')
    )
    op.add_column('knowledge_entries',
        sa.Column('parent_entry_id', sa.Integer(), sa.ForeignKey('knowledge_entries.id', ondelete='SET NULL'), nullable=True)
    )

    op.create_index('ix_knowledge_entries_product_id', 'knowledge_entries', ['product_id'])
    op.create_index('ix_knowledge_entries_source', 'knowledge_entries', ['source'])


def downgrade():
    op.drop_index('ix_knowledge_entries_source', 'knowledge_entries')
    op.drop_index('ix_knowledge_entries_product_id', 'knowledge_entries')
    op.drop_column('knowledge_entries', 'parent_entry_id')
    op.drop_column('knowledge_entries', 'source')
    op.drop_column('knowledge_entries', 'product_id')
