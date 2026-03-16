"""remove old conversation tables

Revision ID: 011
Revises: 010
Create Date: 2026-03-12

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None


def upgrade():
    # Drop old persona conversation tables
    # These are replaced by the adviser conversations system
    op.drop_table('message')
    op.drop_table('conversation')


def downgrade():
    # Recreate tables if needed to rollback
    # (This is a simplified version - full recreation would need all columns)
    op.create_table(
        'conversation',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('conversation_type', sa.String(50), nullable=False, server_default='general'),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('related_persona_ids', sa.JSON(), nullable=True),
        sa.Column('related_decision_id', sa.Integer(), nullable=True),
        sa.Column('is_archived', sa.Boolean(), server_default='false'),
        sa.Column('extra_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        'message',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('conversation_id', sa.Integer(), sa.ForeignKey('conversation.id'), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('persona_id', sa.Integer(), nullable=True),
        sa.Column('citations', sa.JSON(), nullable=True),
        sa.Column('extra_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
