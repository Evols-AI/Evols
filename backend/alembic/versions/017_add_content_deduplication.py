"""Add content deduplication support

Revision ID: 017
Revises: 016
Create Date: 2025-03-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '017'
down_revision = '016'
branch_labels = None
depends_on = None


def upgrade():
    # Add content_hash to context_sources for duplicate detection
    op.add_column('context_sources', sa.Column('content_hash', sa.String(64), nullable=True))
    op.create_index('ix_context_sources_content_hash', 'context_sources', ['tenant_id', 'content_hash'])

    # Add fields for source grouping (same event/meeting)
    op.add_column('context_sources', sa.Column('source_group_id', sa.Integer(), nullable=True))
    op.add_column('context_sources', sa.Column('duplicate_of_id', sa.Integer(), nullable=True))
    op.add_column('context_sources', sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='true'))

    # Create source_groups table
    op.create_table(
        'source_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('event_date', sa.Date(), nullable=True),
        sa.Column('primary_source_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['primary_source_id'], ['context_sources.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_source_groups_tenant_id', 'source_groups', ['tenant_id'])

    # Add foreign keys for source grouping
    op.create_foreign_key('fk_context_sources_source_group', 'context_sources', 'source_groups',
                         ['source_group_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_context_sources_duplicate_of', 'context_sources', 'context_sources',
                         ['duplicate_of_id'], ['id'], ondelete='SET NULL')

    # Create entity_duplicates table for tracking duplicate entities
    op.create_table(
        'entity_duplicates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('primary_entity_id', sa.Integer(), nullable=False),
        sa.Column('duplicate_entity_id', sa.Integer(), nullable=False),
        sa.Column('similarity_score', sa.Float(), nullable=True),
        sa.Column('merged_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['primary_entity_id'], ['extracted_entities.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['duplicate_entity_id'], ['extracted_entities.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('primary_entity_id', 'duplicate_entity_id', name='uq_entity_duplicate_pair')
    )
    op.create_index('ix_entity_duplicates_tenant_id', 'entity_duplicates', ['tenant_id'])
    op.create_index('ix_entity_duplicates_primary_entity_id', 'entity_duplicates', ['primary_entity_id'])
    op.create_index('ix_entity_duplicates_duplicate_entity_id', 'entity_duplicates', ['duplicate_entity_id'])


def downgrade():
    # Drop tables
    op.drop_table('entity_duplicates')
    op.drop_table('source_groups')

    # Drop foreign keys
    op.drop_constraint('fk_context_sources_duplicate_of', 'context_sources', type_='foreignkey')
    op.drop_constraint('fk_context_sources_source_group', 'context_sources', type_='foreignkey')

    # Drop columns from context_sources
    op.drop_column('context_sources', 'is_primary')
    op.drop_column('context_sources', 'duplicate_of_id')
    op.drop_column('context_sources', 'source_group_id')
    op.drop_index('ix_context_sources_content_hash', 'context_sources')
    op.drop_column('context_sources', 'content_hash')
