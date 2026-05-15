"""add user skill customizations table only

Revision ID: 41251bd9a31e
Revises: add_last_login_at_simple
Create Date: 2026-03-31 20:55:24.822710

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '41251bd9a31e'
down_revision = 'add_last_login_at_simple'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_skill_customizations (
            id SERIAL NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id),
            tenant_id INTEGER NOT NULL REFERENCES tenants(id),
            skill_name VARCHAR(255) NOT NULL,
            custom_instructions TEXT,
            custom_context TEXT,
            output_format_preferences TEXT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now(),
            PRIMARY KEY (id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_skill_customizations_skill_name ON user_skill_customizations (skill_name)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_skill_customizations_user_id ON user_skill_customizations (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_skill_customizations_user_skill_active ON user_skill_customizations (user_id, skill_name, is_active)")


def downgrade() -> None:
    op.drop_index('ix_user_skill_customizations_user_skill_active', table_name='user_skill_customizations')
    op.drop_index(op.f('ix_user_skill_customizations_user_id'), table_name='user_skill_customizations')
    op.drop_index(op.f('ix_user_skill_customizations_skill_name'), table_name='user_skill_customizations')
    op.drop_table('user_skill_customizations')
