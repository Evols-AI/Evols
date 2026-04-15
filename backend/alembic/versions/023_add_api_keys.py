"""Add API keys table for long-lived plugin authentication

Revision ID: 023
Revises: 022
Create Date: 2026-04-14

"""
from alembic import op
import sqlalchemy as sa

revision = '023'
down_revision = '022'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS api_keys (
            id SERIAL PRIMARY KEY,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now(),
            tenant_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            key_prefix VARCHAR(8) NOT NULL,
            key_hash VARCHAR(255) NOT NULL,
            last_used_at TIMESTAMP,
            expires_at TIMESTAMP,
            is_active BOOLEAN NOT NULL DEFAULT TRUE
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_api_keys_tenant_id ON api_keys(tenant_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_api_keys_user_id ON api_keys(user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_api_keys_key_prefix ON api_keys(key_prefix);")


def downgrade():
    op.execute("DROP TABLE IF EXISTS api_keys;")
