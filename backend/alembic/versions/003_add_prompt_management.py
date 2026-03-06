"""add prompt management

Revision ID: 003_add_prompt_management
Revises: 002
Create Date: 2026-03-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003_add_prompt_management'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create prompt table
    op.create_table('prompt',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('key', sa.String(length=255), nullable=False),
        sa.Column('version', sa.String(length=50), nullable=False),
        sa.Column('system_prompt', sa.Text(), nullable=True),
        sa.Column('user_template', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('tags', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('variables', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('is_default', sa.Boolean(), nullable=False, default=False),
        sa.Column('usage_count', sa.Integer(), nullable=False, default=0),
        sa.Column('avg_response_time', sa.Integer(), nullable=True),
        sa.Column('success_rate', sa.Integer(), nullable=True),
        sa.Column('variant_name', sa.String(length=100), nullable=True),
        sa.Column('experiment_id', sa.String(length=100), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('extra_data', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.UniqueConstraint('tenant_id', 'key', 'version', name='uq_prompt_tenant_key_version')
    )

    # Create indexes
    op.create_index('ix_prompt_tenant_id', 'prompt', ['tenant_id'])
    op.create_index('ix_prompt_key', 'prompt', ['key'])
    op.create_index('ix_prompt_category', 'prompt', ['category'])
    op.create_index('ix_prompt_is_active', 'prompt', ['is_active'])
    op.create_index('ix_prompt_experiment_id', 'prompt', ['experiment_id'])

    # Create prompt_execution table
    op.create_table('prompt_execution',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('prompt_id', sa.Integer(), nullable=False),
        sa.Column('prompt_key', sa.String(length=255), nullable=False),
        sa.Column('prompt_version', sa.String(length=50), nullable=False),
        sa.Column('input_variables', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('rendered_prompt', sa.Text(), nullable=True),
        sa.Column('response_content', sa.Text(), nullable=True),
        sa.Column('response_tokens', sa.Integer(), nullable=True),
        sa.Column('response_time_ms', sa.Integer(), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=False, default=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('model_name', sa.String(length=100), nullable=True),
        sa.Column('provider', sa.String(length=50), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('extra_data', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['prompt_id'], ['prompt.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], )
    )

    # Create indexes
    op.create_index('ix_prompt_execution_tenant_id', 'prompt_execution', ['tenant_id'])
    op.create_index('ix_prompt_execution_prompt_id', 'prompt_execution', ['prompt_id'])
    op.create_index('ix_prompt_execution_prompt_key', 'prompt_execution', ['prompt_key'])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index('ix_prompt_execution_prompt_key', table_name='prompt_execution')
    op.drop_index('ix_prompt_execution_prompt_id', table_name='prompt_execution')
    op.drop_index('ix_prompt_execution_tenant_id', table_name='prompt_execution')
    op.drop_table('prompt_execution')

    op.drop_index('ix_prompt_experiment_id', table_name='prompt')
    op.drop_index('ix_prompt_is_active', table_name='prompt')
    op.drop_index('ix_prompt_category', table_name='prompt')
    op.drop_index('ix_prompt_key', table_name='prompt')
    op.drop_index('ix_prompt_tenant_id', table_name='prompt')
    op.drop_table('prompt')
