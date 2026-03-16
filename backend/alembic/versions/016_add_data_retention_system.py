"""Add data retention system

Revision ID: 016
Revises: 015
Create Date: 2025-03-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '016'
down_revision = '015'
branch_labels = None
depends_on = None


def upgrade():
    # Add retention fields to context_sources
    op.add_column('context_sources', sa.Column('retention_policy', sa.String(50), nullable=True, server_default='30_days'))
    op.add_column('context_sources', sa.Column('content_deleted_at', sa.DateTime(), nullable=True))
    op.add_column('context_sources', sa.Column('deletion_scheduled_for', sa.DateTime(), nullable=True))
    op.add_column('context_sources', sa.Column('content_summary', sa.Text(), nullable=True))
    op.add_column('context_sources', sa.Column('encrypted_content', sa.LargeBinary(), nullable=True))
    op.add_column('context_sources', sa.Column('encryption_key_id', sa.String(100), nullable=True))
    op.add_column('context_sources', sa.Column('is_encrypted', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('context_sources', sa.Column('last_accessed_at', sa.DateTime(), nullable=True))
    op.add_column('context_sources', sa.Column('access_count', sa.Integer(), nullable=False, server_default='0'))

    # Create indexes
    op.create_index('ix_context_sources_retention_policy', 'context_sources', ['retention_policy'])
    op.create_index('ix_context_sources_deletion_scheduled_for', 'context_sources', ['deletion_scheduled_for'])

    # Create content_access_logs table
    op.create_table(
        'content_access_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('context_source_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('access_reason', sa.String(255), nullable=True),
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('accessed_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['context_source_id'], ['context_sources.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_content_access_logs_tenant_id', 'content_access_logs', ['tenant_id'])
    op.create_index('ix_content_access_logs_context_source_id', 'content_access_logs', ['context_source_id'])
    op.create_index('ix_content_access_logs_user_id', 'content_access_logs', ['user_id'])
    op.create_index('ix_content_access_logs_accessed_at', 'content_access_logs', ['accessed_at'])

    # Create initiative_evidence table
    op.create_table(
        'initiative_evidence',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('initiative_id', sa.Integer(), nullable=False),
        sa.Column('total_mentions', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_arr_impacted', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('customer_segments', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('representative_quotes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('sources', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('confidence_avg', sa.Float(), nullable=True),
        sa.Column('sentiment_avg', sa.Float(), nullable=True),
        sa.Column('last_updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['initiative_id'], ['initiatives.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_initiative_evidence_tenant_id', 'initiative_evidence', ['tenant_id'])
    op.create_index('ix_initiative_evidence_initiative_id', 'initiative_evidence', ['initiative_id'])

    # Create entity_initiative_links table (many-to-many)
    op.create_table(
        'entity_initiative_links',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=False),
        sa.Column('initiative_id', sa.Integer(), nullable=False),
        sa.Column('relevance_score', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['entity_id'], ['extracted_entities.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['initiative_id'], ['initiatives.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('entity_id', 'initiative_id', name='uq_entity_initiative')
    )
    op.create_index('ix_entity_initiative_links_tenant_id', 'entity_initiative_links', ['tenant_id'])
    op.create_index('ix_entity_initiative_links_entity_id', 'entity_initiative_links', ['entity_id'])
    op.create_index('ix_entity_initiative_links_initiative_id', 'entity_initiative_links', ['initiative_id'])


def downgrade():
    # Drop tables
    op.drop_table('entity_initiative_links')
    op.drop_table('initiative_evidence')
    op.drop_table('content_access_logs')

    # Drop columns from context_sources
    op.drop_column('context_sources', 'access_count')
    op.drop_column('context_sources', 'last_accessed_at')
    op.drop_column('context_sources', 'is_encrypted')
    op.drop_column('context_sources', 'encryption_key_id')
    op.drop_column('context_sources', 'encrypted_content')
    op.drop_column('context_sources', 'content_summary')
    op.drop_column('context_sources', 'deletion_scheduled_for')
    op.drop_column('context_sources', 'content_deleted_at')
    op.drop_column('context_sources', 'retention_policy')
