"""add_skill_name_to_messages

Revision ID: 31cb144bffb6
Revises: 5a4b5851999a
Create Date: 2026-03-24 20:34:45.813103

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '31cb144bffb6'
down_revision = '5a4b5851999a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add skill_name column to messages table
    # This allows file-based skills to be identified by name instead of database ID
    op.add_column('messages', sa.Column('skill_name', sa.String(length=255), nullable=True))

    # Add index for faster lookups
    op.create_index(op.f('ix_messages_skill_name'), 'messages', ['skill_name'], unique=False)


def downgrade() -> None:
    # Remove index and column
    op.drop_index(op.f('ix_messages_skill_name'), table_name='messages')
    op.drop_column('messages', 'skill_name')
