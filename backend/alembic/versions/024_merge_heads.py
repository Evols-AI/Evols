"""Merge numbered branch (023) and un-numbered branch (41251bd9a31e)

Revision ID: 024
Revises: 023, 41251bd9a31e
Create Date: 2026-04-14

"""
from alembic import op

revision = '024'
down_revision = ('023', '41251bd9a31e')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
