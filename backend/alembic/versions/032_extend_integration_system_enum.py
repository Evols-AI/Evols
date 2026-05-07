"""Extend IntegrationSystem enum with Jira, HubSpot, Freshdesk, Asana, Pipedrive, Confluence, Intercom, Linear, Gmail, Zoom, Discord

Revision ID: 032
Revises: 031
Create Date: 2026-05-06

"""
from alembic import op

revision = '032'
down_revision = '031'
branch_labels = None
depends_on = None

NEW_VALUES = ['jira', 'hubspot', 'freshdesk', 'asana', 'pipedrive', 'confluence', 'intercom', 'linear', 'gmail', 'zoom', 'discord']


def upgrade():
    for value in NEW_VALUES:
        op.execute(f"ALTER TYPE integrationsystem ADD VALUE IF NOT EXISTS '{value}'")


def downgrade():
    # PostgreSQL does not support removing enum values without recreating the type.
    # Downgrade is a no-op — the extra values are harmless if the code reverts.
    pass
