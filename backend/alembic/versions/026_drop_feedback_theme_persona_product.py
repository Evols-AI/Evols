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
    # Use raw SQL with IF EXISTS throughout — idempotent and never aborts the transaction.

    # ── context_sources ────────────────────────────────────────────────────
    op.execute("ALTER TABLE context_sources DROP CONSTRAINT IF EXISTS context_sources_product_id_fkey")
    op.execute("DROP INDEX IF EXISTS ix_context_sources_product_id")
    op.execute("ALTER TABLE context_sources DROP COLUMN IF EXISTS product_id")

    op.execute("ALTER TABLE context_sources DROP CONSTRAINT IF EXISTS context_sources_theme_id_fkey")
    op.execute("ALTER TABLE context_sources DROP COLUMN IF EXISTS theme_id")

    # ── extracted_entities ─────────────────────────────────────────────────
    op.execute("ALTER TABLE extracted_entities DROP CONSTRAINT IF EXISTS extracted_entities_product_id_fkey")
    op.execute("DROP INDEX IF EXISTS ix_extracted_entities_product_id")
    op.execute("ALTER TABLE extracted_entities DROP COLUMN IF EXISTS product_id")

    op.execute("ALTER TABLE extracted_entities DROP CONSTRAINT IF EXISTS extracted_entities_theme_id_fkey")
    op.execute("ALTER TABLE extracted_entities DROP COLUMN IF EXISTS theme_id")

    op.execute("ALTER TABLE extracted_entities DROP CONSTRAINT IF EXISTS extracted_entities_related_persona_id_fkey")
    op.execute("ALTER TABLE extracted_entities DROP COLUMN IF EXISTS related_persona_id")

    # ── initiative ─────────────────────────────────────────────────────────
    op.execute("ALTER TABLE initiative DROP CONSTRAINT IF EXISTS initiative_product_id_fkey")
    op.execute("DROP INDEX IF EXISTS ix_initiative_product_id")
    op.execute("ALTER TABLE initiative DROP COLUMN IF EXISTS product_id")

    # ── project ────────────────────────────────────────────────────────────
    op.execute("ALTER TABLE project DROP CONSTRAINT IF EXISTS project_product_id_fkey")
    op.execute("DROP INDEX IF EXISTS ix_project_product_id")
    op.execute("ALTER TABLE project DROP COLUMN IF EXISTS product_id")

    # ── knowledge_sources ──────────────────────────────────────────────────
    op.execute("ALTER TABLE knowledge_sources DROP CONSTRAINT IF EXISTS knowledge_sources_product_id_fkey")
    op.execute("DROP INDEX IF EXISTS ix_knowledge_sources_product_id")
    op.execute("ALTER TABLE knowledge_sources DROP COLUMN IF EXISTS product_id")

    # ── capabilities ───────────────────────────────────────────────────────
    op.execute("ALTER TABLE capabilities DROP CONSTRAINT IF EXISTS capabilities_product_id_fkey")
    op.execute("DROP INDEX IF EXISTS ix_capabilities_product_id")
    op.execute("ALTER TABLE capabilities DROP COLUMN IF EXISTS product_id")

    # ── pm_decisions ───────────────────────────────────────────────────────
    op.execute("ALTER TABLE pm_decisions DROP CONSTRAINT IF EXISTS pm_decisions_product_id_fkey")
    op.execute("DROP INDEX IF EXISTS ix_pm_decisions_product_id")
    op.execute("ALTER TABLE pm_decisions DROP COLUMN IF EXISTS product_id")

    # ── tasks ──────────────────────────────────────────────────────────────
    op.execute("ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_product_id_fkey")
    op.execute("DROP INDEX IF EXISTS ix_tasks_product_id")
    op.execute("ALTER TABLE tasks DROP COLUMN IF EXISTS product_id")

    # ── product_knowledge — deduplicate, then drop product_id ──────────────
    op.execute("""
        DELETE FROM product_knowledge pk1
        USING product_knowledge pk2
        WHERE pk1.tenant_id = pk2.tenant_id AND pk1.id > pk2.id
    """)
    op.execute("ALTER TABLE product_knowledge DROP CONSTRAINT IF EXISTS product_knowledge_product_id_fkey")
    op.execute("DROP INDEX IF EXISTS ix_product_knowledge_product_id")
    op.execute("ALTER TABLE product_knowledge DROP COLUMN IF EXISTS product_id")
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'uq_product_knowledge_tenant_id'
                  AND table_name = 'product_knowledge'
            ) THEN
                ALTER TABLE product_knowledge ADD CONSTRAINT uq_product_knowledge_tenant_id UNIQUE (tenant_id);
            END IF;
        END
        $$
    """)

    # ── knowledge_entries ──────────────────────────────────────────────────
    op.execute("ALTER TABLE knowledge_entries DROP CONSTRAINT IF EXISTS knowledge_entries_product_id_fkey")
    op.execute("DROP INDEX IF EXISTS ix_knowledge_entries_product_id")
    op.execute("ALTER TABLE knowledge_entries DROP COLUMN IF EXISTS product_id")

    # ── skill_memory ───────────────────────────────────────────────────────
    op.execute("ALTER TABLE skill_memory DROP CONSTRAINT IF EXISTS skill_memory_product_id_fkey")
    op.execute("DROP INDEX IF EXISTS ix_skill_memory_product_id")
    op.execute("ALTER TABLE skill_memory DROP COLUMN IF EXISTS product_id")

    # ── Drop legacy tables in dependency order ─────────────────────────────
    op.execute("DROP TABLE IF EXISTS theme_initiative")
    op.execute("DROP TABLE IF EXISTS feedback")
    op.execute("DROP TABLE IF EXISTS feedback_categories")
    op.execute("DROP TABLE IF EXISTS persona")
    op.execute("DROP TABLE IF EXISTS theme")
    op.execute("DROP TABLE IF EXISTS products")


def downgrade():
    # Not implemented — this migration is intentionally irreversible.
    # The removed tables were legacy Postgres-backed feedback/theme/persona pipelines
    # that have been superseded by the LightRAG knowledge graph.
    raise NotImplementedError("downgrade not supported for migration 026")
