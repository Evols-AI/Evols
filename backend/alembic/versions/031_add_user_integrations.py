"""Add user_integrations table for per-user OAuth data source connections

Revision ID: 031
Revises: 030
Create Date: 2026-05-05

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '031'
down_revision = '030'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE integrationsystem AS ENUM (
                'slack', 'outlook', 'teams', 'notion',
                'salesforce', 'zendesk', 'github'
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE integrationstatus AS ENUM (
                'pending_auth', 'connected', 'error', 'disconnected'
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS user_integrations (
            id                  SERIAL PRIMARY KEY,
            created_at          TIMESTAMP NOT NULL DEFAULT now(),
            updated_at          TIMESTAMP NOT NULL DEFAULT now(),

            -- ownership
            user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

            -- which service
            source_system       integrationsystem NOT NULL,

            -- OAuth tokens (AES-256-GCM encrypted blobs via EncryptionService)
            access_token_enc    BYTEA,
            refresh_token_enc   BYTEA,
            token_expiry        TIMESTAMP,

            -- source-system-specific config (channel IDs, repo names, etc.)
            config              JSONB DEFAULT '{}',

            -- incremental sync state (dlt pipeline state or Graph API deltaToken)
            incremental_state   JSONB DEFAULT '{}',

            -- sync bookkeeping
            status              integrationstatus NOT NULL DEFAULT 'pending_auth',
            last_synced_at      TIMESTAMP,
            last_error          TEXT,
            sync_enabled        BOOLEAN NOT NULL DEFAULT true,

            UNIQUE (user_id, source_system)
        );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_user_integrations_user_id   ON user_integrations(user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_integrations_tenant_id ON user_integrations(tenant_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_integrations_status    ON user_integrations(status);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_integrations_system    ON user_integrations(source_system);")


def downgrade():
    op.execute("DROP TABLE IF EXISTS user_integrations;")
    op.execute("DROP TYPE IF EXISTS integrationstatus;")
    op.execute("DROP TYPE IF EXISTS integrationsystem;")
