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
    # knowledge_entries — columns were manually applied 2026-05-04; IF NOT EXISTS makes this safe to re-run
    op.execute("ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS content_hash VARCHAR(16)")
    op.execute("ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS files_read JSON")
    op.execute("ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS files_modified JSON")
    op.execute("ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS discovery_tokens INTEGER")
    op.execute("ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS model VARCHAR(100)")

    # quota_events
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'eventcategory') THEN CREATE TYPE eventcategory AS ENUM ('creation', 'retrieval', 'mixed'); END IF; END $$")
    op.execute("ALTER TABLE quota_events ADD COLUMN IF NOT EXISTS event_category eventcategory NOT NULL DEFAULT 'creation'")
    op.execute("ALTER TABLE quota_events ADD COLUMN IF NOT EXISTS tokens_invested INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE quota_events ADD COLUMN IF NOT EXISTS actual_savings INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE quota_events ADD COLUMN IF NOT EXISTS model VARCHAR(100)")
    op.execute("ALTER TABLE quota_events ADD COLUMN IF NOT EXISTS cost_usd FLOAT")


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
