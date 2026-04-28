"""Drop feedback, theme, persona, product tables and related FK columns

Revision ID: 026
Revises: 025
Create Date: 2026-04-26

These tables are no longer used:
- feedback / feedback_categories: replaced by LightRAG knowledge graph ingestion via context_sources
- theme / theme_initiative: AI theme clustering on top of feedback, no longer relevant
- persona: managed personas replaced by graph-extracted entities in LightRAG
- products: product scoping replaced by tenant-level scoping

FK columns removed from surviving tables:
- context_sources.product_id, context_sources.theme_id
- extracted_entities.product_id, extracted_entities.theme_id, extracted_entities.related_persona_id
- initiative.product_id, initiative (theme_initiative association table)
- project.product_id
"""

from alembic import op
import sqlalchemy as sa

revision = '026'
down_revision = '025'
branch_labels = None
depends_on = None


def upgrade():
    # ── Drop FK constraints before dropping columns / tables ──────────────

    # context_sources → products
    op.drop_constraint('context_sources_product_id_fkey', 'context_sources', type_='foreignkey')
    op.drop_index('ix_context_sources_product_id', table_name='context_sources')
    op.drop_column('context_sources', 'product_id')

    # context_sources → theme
    op.drop_constraint('context_sources_theme_id_fkey', 'context_sources', type_='foreignkey')
    op.drop_column('context_sources', 'theme_id')

    # extracted_entities → products
    op.drop_constraint('extracted_entities_product_id_fkey', 'extracted_entities', type_='foreignkey')
    op.drop_index('ix_extracted_entities_product_id', table_name='extracted_entities')
    op.drop_column('extracted_entities', 'product_id')

    # extracted_entities → theme
    op.drop_constraint('extracted_entities_theme_id_fkey', 'extracted_entities', type_='foreignkey')
    op.drop_column('extracted_entities', 'theme_id')

    # extracted_entities → persona
    op.drop_constraint('extracted_entities_related_persona_id_fkey', 'extracted_entities', type_='foreignkey')
    op.drop_column('extracted_entities', 'related_persona_id')

    # initiative → products
    op.drop_constraint('initiative_product_id_fkey', 'initiative', type_='foreignkey')
    op.drop_index('ix_initiative_product_id', table_name='initiative')
    op.drop_column('initiative', 'product_id')

    # project → products
    op.drop_constraint('project_product_id_fkey', 'project', type_='foreignkey')
    op.drop_index('ix_project_product_id', table_name='project')
    op.drop_column('project', 'product_id')

    # knowledge_sources → products
    with op.batch_alter_table('knowledge_sources') as batch_op:
        try:
            batch_op.drop_constraint('knowledge_sources_product_id_fkey', type_='foreignkey')
        except Exception:
            pass
        try:
            batch_op.drop_index('ix_knowledge_sources_product_id')
        except Exception:
            pass
        try:
            batch_op.drop_column('product_id')
        except Exception:
            pass

    # capabilities → products
    with op.batch_alter_table('capabilities') as batch_op:
        try:
            batch_op.drop_constraint('capabilities_product_id_fkey', type_='foreignkey')
        except Exception:
            pass
        try:
            batch_op.drop_index('ix_capabilities_product_id')
        except Exception:
            pass
        try:
            batch_op.drop_column('product_id')
        except Exception:
            pass

    # pm_decisions → products
    with op.batch_alter_table('pm_decisions') as batch_op:
        try:
            batch_op.drop_constraint('pm_decisions_product_id_fkey', type_='foreignkey')
        except Exception:
            pass
        try:
            batch_op.drop_index('ix_pm_decisions_product_id')
        except Exception:
            pass
        try:
            batch_op.drop_column('product_id')
        except Exception:
            pass

    # tasks → products
    with op.batch_alter_table('tasks') as batch_op:
        try:
            batch_op.drop_constraint('tasks_product_id_fkey', type_='foreignkey')
        except Exception:
            pass
        try:
            batch_op.drop_index('ix_tasks_product_id')
        except Exception:
            pass
        try:
            batch_op.drop_column('product_id')
        except Exception:
            pass

    # product_knowledge → products (migrate to tenant-scoped)
    # Keep one row per tenant: deduplicate by taking the first row per tenant_id,
    # then drop product_id column and add unique constraint on tenant_id.
    op.execute("""
        DELETE FROM product_knowledge pk1
        USING product_knowledge pk2
        WHERE pk1.tenant_id = pk2.tenant_id AND pk1.id > pk2.id
    """)
    with op.batch_alter_table('product_knowledge') as batch_op:
        try:
            batch_op.drop_constraint('product_knowledge_product_id_fkey', type_='foreignkey')
        except Exception:
            pass
        try:
            batch_op.drop_index('ix_product_knowledge_product_id')
        except Exception:
            pass
        try:
            batch_op.drop_column('product_id')
        except Exception:
            pass
        try:
            batch_op.create_unique_constraint('uq_product_knowledge_tenant_id', ['tenant_id'])
        except Exception:
            pass

    # knowledge_entries → products
    with op.batch_alter_table('knowledge_entries') as batch_op:
        try:
            batch_op.drop_constraint('knowledge_entries_product_id_fkey', type_='foreignkey')
        except Exception:
            pass
        try:
            batch_op.drop_index('ix_knowledge_entries_product_id')
        except Exception:
            pass
        try:
            batch_op.drop_column('product_id')
        except Exception:
            pass

    # skill_memory → products
    with op.batch_alter_table('skill_memory') as batch_op:
        try:
            batch_op.drop_constraint('skill_memory_product_id_fkey', type_='foreignkey')
        except Exception:
            pass
        try:
            batch_op.drop_index('ix_skill_memory_product_id')
        except Exception:
            pass
        try:
            batch_op.drop_column('product_id')
        except Exception:
            pass

    # ── Drop association / child tables in dependency order ───────────────

    # theme_initiative association table (references both theme and initiative)
    op.drop_table('theme_initiative')

    # feedback references theme and product
    op.drop_table('feedback')
    op.drop_table('feedback_categories')

    # persona references product
    op.drop_table('persona')

    # theme references product
    op.drop_table('theme')

    # products — drop last (everything referencing it is already gone)
    op.drop_table('products')


def downgrade():
    # Not implemented — this migration is intentionally irreversible.
    # The removed tables were legacy Postgres-backed feedback/theme/persona pipelines
    # that have been superseded by the LightRAG knowledge graph.
    raise NotImplementedError("downgrade not supported for migration 026")
