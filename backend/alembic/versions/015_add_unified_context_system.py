"""add unified context system

Revision ID: 015
Revises: 014
Create Date: 2026-03-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum types (skip if they already exist)
    bind = op.get_bind()

    # Check and create context_source_type_enum
    result = bind.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contextsourcetype')"
    ))
    if not result.scalar():
        context_source_type_enum = postgresql.ENUM(
            'csv_survey', 'usage_data', 'nps_csat', 'analytics_export',
            'meeting_transcript', 'email', 'slack_conversation', 'document_pdf',
            'document_word', 'document_notion', 'web_page',
            'support_ticket', 'intercom', 'zendesk', 'productboard',
            'competitor_research', 'market_research',
            'slack_integration', 'google_meet', 'confluence', 'gmail_api',
            'github_repo', 'api_docs', 'mcp_server',
            'manual_upload', 'api',
            name='contextsourcetype'
        )
        context_source_type_enum.create(bind)

    # Check and create context_processing_status_enum
    result = bind.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contextprocessingstatus')"
    ))
    if not result.scalar():
        context_processing_status_enum = postgresql.ENUM(
            'pending', 'processing', 'completed', 'failed', 'partially_completed',
            name='contextprocessingstatus'
        )
        context_processing_status_enum.create(bind)

    # Check and create entity_type_enum
    result = bind.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entitytype')"
    ))
    if not result.scalar():
        entity_type_enum = postgresql.ENUM(
            'persona', 'pain_point', 'use_case', 'feature_request', 'product_capability',
            'stakeholder', 'competitor', 'technical_requirement', 'business_goal',
            'metric', 'quote',
            name='entitytype'
        )
        entity_type_enum.create(bind)

    # Check if context_sources table exists
    result = bind.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'context_sources')"
    ))

    if not result.scalar():
        # Create context_sources table
        op.create_table(
            'context_sources',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.Column('tenant_id', sa.Integer(), nullable=False),
            sa.Column('product_id', sa.Integer(), nullable=True),
            sa.Column('source_type', sa.Enum(name='contextsourcetype'), nullable=False),
            sa.Column('name', sa.String(length=500), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('source_id', sa.String(length=255), nullable=True),
            sa.Column('source_url', sa.String(length=1000), nullable=True),
            sa.Column('title', sa.String(length=500), nullable=True),
            sa.Column('content', sa.Text(), nullable=True),
            sa.Column('raw_content', sa.Text(), nullable=True),
            sa.Column('file_path', sa.String(length=500), nullable=True),
            sa.Column('mcp_endpoint', sa.String(length=500), nullable=True),
            sa.Column('github_repo', sa.String(length=255), nullable=True),
            sa.Column('api_config', sa.JSON(), nullable=True),
            sa.Column('account_id', sa.Integer(), nullable=True),
            sa.Column('customer_name', sa.String(length=255), nullable=True),
            sa.Column('customer_email', sa.String(length=255), nullable=True),
            sa.Column('customer_segment', sa.String(length=100), nullable=True),
            sa.Column('source_date', sa.Date(), nullable=True),
            sa.Column('last_synced_at', sa.DateTime(), nullable=True),
            sa.Column('status', sa.Enum(name='contextprocessingstatus'), nullable=False),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('entities_extracted_count', sa.Integer(), nullable=True, default=0),
            sa.Column('embedding', Vector(1536), nullable=True),
            sa.Column('sentiment_score', sa.Float(), nullable=True),
            sa.Column('urgency_score', sa.Float(), nullable=True),
            sa.Column('impact_score', sa.Float(), nullable=True),
            sa.Column('theme_id', sa.Integer(), nullable=True),
            sa.Column('theme_confidence', sa.Float(), nullable=True),
            sa.Column('tags', postgresql.ARRAY(sa.String()), nullable=True),
            sa.Column('extra_data', sa.JSON(), nullable=True),
            sa.ForeignKeyConstraint(['account_id'], ['account.id'], ),
            sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
            sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
            sa.ForeignKeyConstraint(['theme_id'], ['theme.id'], ),
            sa.PrimaryKeyConstraint('id')
        )

        # Create indexes
        op.create_index(op.f('idx_context_sources_tenant'), 'context_sources', ['tenant_id'], unique=False)
        op.create_index(op.f('idx_context_sources_product'), 'context_sources', ['product_id'], unique=False)
        op.create_index(op.f('idx_context_sources_type'), 'context_sources', ['source_type'], unique=False)
        op.create_index(op.f('idx_context_sources_account'), 'context_sources', ['account_id'], unique=False)
        op.create_index(op.f('idx_context_sources_segment'), 'context_sources', ['customer_segment'], unique=False)
        op.create_index(op.f('idx_context_sources_date'), 'context_sources', ['source_date'], unique=False)
        op.create_index(op.f('idx_context_sources_status'), 'context_sources', ['status'], unique=False)
        op.create_index(op.f('idx_context_sources_theme'), 'context_sources', ['theme_id'], unique=False)

    # Check if extracted_entities table exists
    result = bind.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'extracted_entities')"
    ))

    if not result.scalar():
        # Create extracted_entities table
        op.create_table(
            'extracted_entities',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.Column('tenant_id', sa.Integer(), nullable=False),
            sa.Column('product_id', sa.Integer(), nullable=True),
            sa.Column('source_id', sa.Integer(), nullable=False),
            sa.Column('entity_type', sa.Enum(name='entitytype'), nullable=False),
            sa.Column('name', sa.String(length=500), nullable=False),
            sa.Column('description', sa.Text(), nullable=False),
            sa.Column('context_snippet', sa.Text(), nullable=True),
            sa.Column('confidence_score', sa.Float(), nullable=True),
            sa.Column('category', sa.String(length=100), nullable=True),
            sa.Column('subcategory', sa.String(length=100), nullable=True),
            sa.Column('related_persona_id', sa.Integer(), nullable=True),
            sa.Column('related_capability_id', sa.Integer(), nullable=True),
            sa.Column('attributes', sa.JSON(), nullable=True),
            sa.Column('source_url', sa.String(length=1000), nullable=True),
            sa.Column('source_section', sa.String(length=500), nullable=True),
            sa.Column('embedding', Vector(1536), nullable=True),
            sa.Column('extra_data', sa.JSON(), nullable=True),
            sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
            sa.ForeignKeyConstraint(['related_capability_id'], ['capabilities.id'], ),
            sa.ForeignKeyConstraint(['related_persona_id'], ['persona.id'], ),
            sa.ForeignKeyConstraint(['source_id'], ['context_sources.id'], ),
            sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
            sa.PrimaryKeyConstraint('id')
        )

        # Create indexes
        op.create_index(op.f('idx_extracted_entities_tenant'), 'extracted_entities', ['tenant_id'], unique=False)
        op.create_index(op.f('idx_extracted_entities_product'), 'extracted_entities', ['product_id'], unique=False)
        op.create_index(op.f('idx_extracted_entities_source'), 'extracted_entities', ['source_id'], unique=False)
        op.create_index(op.f('idx_extracted_entities_type'), 'extracted_entities', ['entity_type'], unique=False)
        op.create_index(op.f('idx_extracted_entities_name'), 'extracted_entities', ['name'], unique=False)
        op.create_index(op.f('idx_extracted_entities_category'), 'extracted_entities', ['category'], unique=False)
        op.create_index(op.f('idx_extracted_entities_persona'), 'extracted_entities', ['related_persona_id'], unique=False)
        op.create_index(op.f('idx_extracted_entities_capability'), 'extracted_entities', ['related_capability_id'], unique=False)


def downgrade() -> None:
    # Drop tables
    op.drop_index(op.f('idx_extracted_entities_capability'), table_name='extracted_entities')
    op.drop_index(op.f('idx_extracted_entities_persona'), table_name='extracted_entities')
    op.drop_index(op.f('idx_extracted_entities_category'), table_name='extracted_entities')
    op.drop_index(op.f('idx_extracted_entities_name'), table_name='extracted_entities')
    op.drop_index(op.f('idx_extracted_entities_type'), table_name='extracted_entities')
    op.drop_index(op.f('idx_extracted_entities_source'), table_name='extracted_entities')
    op.drop_index(op.f('idx_extracted_entities_product'), table_name='extracted_entities')
    op.drop_index(op.f('idx_extracted_entities_tenant'), table_name='extracted_entities')
    op.drop_table('extracted_entities')

    op.drop_index(op.f('idx_context_sources_theme'), table_name='context_sources')
    op.drop_index(op.f('idx_context_sources_status'), table_name='context_sources')
    op.drop_index(op.f('idx_context_sources_date'), table_name='context_sources')
    op.drop_index(op.f('idx_context_sources_segment'), table_name='context_sources')
    op.drop_index(op.f('idx_context_sources_account'), table_name='context_sources')
    op.drop_index(op.f('idx_context_sources_type'), table_name='context_sources')
    op.drop_index(op.f('idx_context_sources_product'), table_name='context_sources')
    op.drop_index(op.f('idx_context_sources_tenant'), table_name='context_sources')
    op.drop_table('context_sources')

    # Drop enum types
    op.execute('DROP TYPE IF EXISTS entitytype')
    op.execute('DROP TYPE IF EXISTS contextprocessingstatus')
    op.execute('DROP TYPE IF EXISTS contextsourcetype')
