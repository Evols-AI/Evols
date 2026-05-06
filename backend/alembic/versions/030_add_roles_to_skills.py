"""Add roles column to skills table

Revision ID: 030
Revises: 029
Create Date: 2026-05-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = '030'
down_revision = '029'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'skills',
        sa.Column('roles', JSON, nullable=False, server_default='[]')
    )


def downgrade():
    op.drop_column('skills', 'roles')
