"""merge heads before adding user_id to context_sources

Revision ID: merge_heads_before_user_id_context
Revises: add_last_login_at_simple, f7d6ed14b5e1
Create Date: 2026-05-03

"""
from alembic import op

revision = 'merge_pre_user_id_ctx'
down_revision = ('add_last_login_at_simple', 'f7d6ed14b5e1', '028')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
