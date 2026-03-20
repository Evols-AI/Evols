"""Add unified-pm-os tables and enhance skills table

Revision ID: 021
Revises: 020
Create Date: 2026-03-19

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '021'
down_revision = '020'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create product_knowledge table
    op.create_table(
        'product_knowledge',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.text('NOW()')),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),

        # Knowledge documents (markdown)
        sa.Column('strategy_doc', sa.Text(), nullable=True),
        sa.Column('customer_segments_doc', sa.Text(), nullable=True),
        sa.Column('competitive_landscape_doc', sa.Text(), nullable=True),
        sa.Column('value_proposition_doc', sa.Text(), nullable=True),
        sa.Column('metrics_and_targets_doc', sa.Text(), nullable=True),

        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_index('ix_product_knowledge_product_id', 'product_knowledge', ['product_id'])
    op.create_index('ix_product_knowledge_tenant_id', 'product_knowledge', ['tenant_id'])


    # 2. Create skill_memory table
    op.create_table(
        'skill_memory',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text('NOW()')),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),

        sa.Column('skill_name', sa.String(255), nullable=False),
        sa.Column('skill_category', sa.String(50), nullable=True),

        sa.Column('input_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('output_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),

        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_index('ix_skill_memory_product_id', 'skill_memory', ['product_id'])
    op.create_index('ix_skill_memory_tenant_id', 'skill_memory', ['tenant_id'])
    op.create_index('ix_skill_memory_category', 'skill_memory', ['skill_category'])
    op.create_index('ix_skill_memory_created_at', 'skill_memory', ['created_at'])


    # 3. Enhance skills table for unified-pm-os
    op.add_column('skills', sa.Column('category', sa.String(50), nullable=True))
    op.add_column('skills', sa.Column('source', sa.String(20), nullable=True, server_default='database'))
    op.add_column('skills', sa.Column('file_path', sa.String(500), nullable=True))

    # Backfill existing skills
    op.execute("UPDATE skills SET source = 'database', category = 'unknown' WHERE source IS NULL")

    op.create_index('ix_skills_category', 'skills', ['category'])
    op.create_index('ix_skills_source', 'skills', ['source'])


def downgrade():
    # Remove indexes
    op.drop_index('ix_skills_source', 'skills')
    op.drop_index('ix_skills_category', 'skills')

    # Remove skills table columns
    op.drop_column('skills', 'file_path')
    op.drop_column('skills', 'source')
    op.drop_column('skills', 'category')

    # Remove skill_memory table
    op.drop_index('ix_skill_memory_created_at', 'skill_memory')
    op.drop_index('ix_skill_memory_category', 'skill_memory')
    op.drop_index('ix_skill_memory_tenant_id', 'skill_memory')
    op.drop_index('ix_skill_memory_product_id', 'skill_memory')
    op.drop_table('skill_memory')

    # Remove product_knowledge table
    op.drop_index('ix_product_knowledge_tenant_id', 'product_knowledge')
    op.drop_index('ix_product_knowledge_product_id', 'product_knowledge')
    op.drop_table('product_knowledge')
