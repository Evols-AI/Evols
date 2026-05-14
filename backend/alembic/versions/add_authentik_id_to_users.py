"""add authentik_id to users

Revision ID: add_authentik_id_to_users
Revises: 032
Create Date: 2026-05-11

"""
from alembic import op
from sqlalchemy import text

revision = 'add_authentik_id_to_users'
down_revision = '032'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS authentik_id VARCHAR(255)"))
    op.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_authentik_id ON users (authentik_id)"))


def downgrade():
    op.execute(text("DROP INDEX IF EXISTS ix_users_authentik_id"))
    op.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS authentik_id"))
