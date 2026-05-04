"""Add event_category, tokens_invested, actual_savings to quota_events

Revision ID: 027
Revises: 026
Create Date: 2026-04-30

Separates knowledge creation (investment) from knowledge retrieval (realized savings).
tokens_saved_estimate on existing rows was calculated at creation time — those are
investment events, so they're backfilled as 'retrieval' (conservative: only count
savings when knowledge was actually retrieved in the same session).

New columns:
- event_category: 'creation' | 'retrieval' | 'mixed'
- tokens_invested: tokens spent creating new knowledge (creation events)
- actual_savings: realized savings from loading pre-compiled context (retrieval events only)
"""
from alembic import op
import sqlalchemy as sa


revision = '027'
down_revision = '026'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'eventcategory') THEN
                CREATE TYPE eventcategory AS ENUM ('creation', 'retrieval', 'mixed');
            END IF;
        END
        $$
    """)

    # Add columns only if they don't already exist
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name='quota_events' AND column_name='event_category') THEN
                ALTER TABLE quota_events ADD COLUMN event_category eventcategory;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name='quota_events' AND column_name='tokens_invested') THEN
                ALTER TABLE quota_events ADD COLUMN tokens_invested INTEGER DEFAULT 0;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name='quota_events' AND column_name='actual_savings') THEN
                ALTER TABLE quota_events ADD COLUMN actual_savings INTEGER DEFAULT 0;
            END IF;
        END
        $$
    """)

    # Backfill: rows with tokens_retrieved > 0 are retrieval events; others are creation
    op.execute("""
        UPDATE quota_events
        SET event_category = CASE
            WHEN tokens_retrieved > 0 THEN 'retrieval'::eventcategory
            ELSE 'creation'::eventcategory
        END,
        tokens_invested = CASE
            WHEN tokens_retrieved = 0 THEN tokens_used
            ELSE 0
        END,
        actual_savings = CASE
            WHEN tokens_retrieved > 0 THEN tokens_saved_estimate
            ELSE 0
        END
    """)

    op.alter_column('quota_events', 'event_category', nullable=False)


def downgrade() -> None:
    op.drop_column('quota_events', 'actual_savings')
    op.drop_column('quota_events', 'tokens_invested')
    op.drop_column('quota_events', 'event_category')
    op.execute("DROP TYPE eventcategory")
