"""Add team knowledge graph tables

Revision ID: 022
Revises: 021
Create Date: 2026-04-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '022'
down_revision = '021'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE entryrole AS ENUM ('pm', 'engineer', 'designer', 'qa', 'other');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE sessiontype AS ENUM ('research', 'planning', 'code', 'analysis', 'review', 'other');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE entrytype AS ENUM ('insight', 'decision', 'artifact', 'research_finding', 'pattern', 'context');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE edgetype AS ENUM ('semantic', 'explicit', 'temporal');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE quotaeventtype AS ENUM ('session_end', 'rate_limit_hit', 'quota_expired');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS knowledge_entries (
            id SERIAL PRIMARY KEY,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now(),
            tenant_id INTEGER NOT NULL,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            role entryrole NOT NULL DEFAULT 'other',
            session_type sessiontype NOT NULL DEFAULT 'other',
            entry_type entrytype NOT NULL DEFAULT 'insight',
            title VARCHAR(500) NOT NULL,
            content TEXT NOT NULL,
            tags JSONB,
            product_area VARCHAR(255),
            source_session_id VARCHAR(64),
            embedding JSONB,
            token_count INTEGER,
            retrieval_count INTEGER NOT NULL DEFAULT 0,
            last_retrieved_at TIMESTAMP
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_knowledge_entries_tenant_id ON knowledge_entries(tenant_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_knowledge_entries_user_id ON knowledge_entries(user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_knowledge_entries_source_session_id ON knowledge_entries(source_session_id);")

    op.execute("""
        CREATE TABLE IF NOT EXISTS knowledge_edges (
            id SERIAL PRIMARY KEY,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now(),
            tenant_id INTEGER NOT NULL,
            source_entry_id INTEGER NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
            target_entry_id INTEGER NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
            edge_type edgetype NOT NULL DEFAULT 'semantic',
            weight FLOAT
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_knowledge_edges_tenant_id ON knowledge_edges(tenant_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_knowledge_edges_source ON knowledge_edges(source_entry_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_knowledge_edges_target ON knowledge_edges(target_entry_id);")

    op.execute("""
        CREATE TABLE IF NOT EXISTS quota_events (
            id SERIAL PRIMARY KEY,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now(),
            tenant_id INTEGER NOT NULL,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            session_id VARCHAR(64) NOT NULL,
            event_type quotaeventtype NOT NULL,
            tokens_used INTEGER NOT NULL DEFAULT 0,
            tokens_retrieved INTEGER NOT NULL DEFAULT 0,
            tokens_saved_estimate INTEGER NOT NULL DEFAULT 0,
            tool_name VARCHAR(50) DEFAULT 'claude-code',
            plan_type VARCHAR(20),
            session_date TIMESTAMP NOT NULL DEFAULT now(),
            cwd VARCHAR(500)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_quota_events_tenant_id ON quota_events(tenant_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_quota_events_user_id ON quota_events(user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_quota_events_session_id ON quota_events(session_id);")


def downgrade():
    op.execute("DROP TABLE IF EXISTS quota_events;")
    op.execute("DROP TABLE IF EXISTS knowledge_edges;")
    op.execute("DROP TABLE IF EXISTS knowledge_entries;")
    op.execute("DROP TYPE IF EXISTS quotaeventtype;")
    op.execute("DROP TYPE IF EXISTS edgetype;")
    op.execute("DROP TYPE IF EXISTS entrytype;")
    op.execute("DROP TYPE IF EXISTS sessiontype;")
    op.execute("DROP TYPE IF EXISTS entryrole;")
