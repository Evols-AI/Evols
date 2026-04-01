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
    # Create user_skill_customizations table
    op.create_table('user_skill_customizations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('skill_name', sa.String(length=255), nullable=False),
        sa.Column('custom_instructions', sa.Text(), nullable=True),
        sa.Column('custom_context', sa.Text(), nullable=True),
        sa.Column('output_format_preferences', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_skill_customizations_skill_name'), 'user_skill_customizations', ['skill_name'], unique=False)
    op.create_index(op.f('ix_user_skill_customizations_user_id'), 'user_skill_customizations', ['user_id'], unique=False)
    op.create_index('ix_user_skill_customizations_user_skill_active', 'user_skill_customizations', ['user_id', 'skill_name', 'is_active'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_user_skill_customizations_user_skill_active', table_name='user_skill_customizations')
    op.drop_index(op.f('ix_user_skill_customizations_user_id'), table_name='user_skill_customizations')
    op.drop_index(op.f('ix_user_skill_customizations_skill_name'), table_name='user_skill_customizations')
    op.drop_table('user_skill_customizations')
