"""
UserIntegration model — per-user OAuth connections to external data sources.

Each row represents one user's connection to one source system (Slack, Outlook, etc.).
Tokens are stored as AES-256-GCM encrypted blobs using EncryptionService.
"""

import enum
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Column, Integer, ForeignKey, String, Boolean, DateTime, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB, BYTEA
from sqlalchemy.orm import relationship

from app.models.base import Base


class IntegrationSystem(str, enum.Enum):
    SLACK      = "slack"
    OUTLOOK    = "outlook"
    TEAMS      = "teams"
    NOTION     = "notion"
    SALESFORCE = "salesforce"
    ZENDESK    = "zendesk"
    GITHUB     = "github"
    # dlt verified sources
    JIRA       = "jira"
    HUBSPOT    = "hubspot"
    FRESHDESK  = "freshdesk"
    ASANA      = "asana"
    PIPEDRIVE  = "pipedrive"
    # REST-API custom sources
    CONFLUENCE = "confluence"
    INTERCOM   = "intercom"
    LINEAR     = "linear"
    GMAIL      = "gmail"
    ZOOM       = "zoom"
    DISCORD    = "discord"


class IntegrationStatus(str, enum.Enum):
    PENDING_AUTH  = "pending_auth"
    CONNECTED     = "connected"
    ERROR         = "error"
    DISCONNECTED  = "disconnected"


# Human-readable display metadata for the frontend
INTEGRATION_META: dict[str, dict] = {
    "slack": {
        "label": "Slack",
        "description": "Import messages and threads from your Slack workspace",
        "icon": "slack",
        "auth_type": "oauth",
        "scopes": ["channels:history", "channels:read", "users:read", "search:read"],
    },
    "outlook": {
        "label": "Outlook / Office 365",
        "description": "Import emails and calendar events from your Microsoft account",
        "icon": "mail",
        "auth_type": "microsoft_oauth",
        "scopes": ["Mail.Read", "Calendars.Read", "User.Read", "offline_access"],
    },
    "teams": {
        "label": "Microsoft Teams",
        "description": "Import messages and meeting notes from Teams channels",
        "icon": "teams",
        "auth_type": "microsoft_oauth",
        "scopes": ["ChannelMessage.Read.All", "Chat.Read", "User.Read", "offline_access"],
    },
    "notion": {
        "label": "Notion",
        "description": "Import pages and databases from your Notion workspace",
        "icon": "notion",
        "auth_type": "oauth",
        "scopes": ["read_content"],
    },
    "salesforce": {
        "label": "Salesforce",
        "description": "Import accounts, contacts, and opportunity notes",
        "icon": "salesforce",
        "auth_type": "oauth",
        "scopes": ["api", "refresh_token"],
    },
    "zendesk": {
        "label": "Zendesk",
        "description": "Import support tickets and customer conversations",
        "icon": "zendesk",
        "auth_type": "oauth",
        "scopes": ["read"],
    },
    "github": {
        "label": "GitHub",
        "description": "Import issues, PRs, and commit messages from your repositories",
        "icon": "github",
        "auth_type": "oauth",
        "scopes": ["repo", "read:user"],
    },
    "jira": {
        "label": "Jira",
        "description": "Import issues, epics, sprints, and comments from Jira projects",
        "icon": "jira",
        "auth_type": "api_token",
        "scopes": [],
    },
    "hubspot": {
        "label": "HubSpot",
        "description": "Import contacts, deals, companies, and CRM notes",
        "icon": "hubspot",
        "auth_type": "api_token",
        "scopes": [],
    },
    "freshdesk": {
        "label": "Freshdesk",
        "description": "Import support tickets and customer conversations",
        "icon": "freshdesk",
        "auth_type": "api_token",
        "scopes": [],
    },
    "asana": {
        "label": "Asana",
        "description": "Import tasks, projects, and team activity from Asana",
        "icon": "asana",
        "auth_type": "api_token",
        "scopes": [],
    },
    "pipedrive": {
        "label": "Pipedrive",
        "description": "Import deals, contacts, and pipeline activity from Pipedrive",
        "icon": "pipedrive",
        "auth_type": "api_token",
        "scopes": [],
    },
    "confluence": {
        "label": "Confluence",
        "description": "Import pages and spaces from your Confluence knowledge base",
        "icon": "confluence",
        "auth_type": "api_token",
        "scopes": [],
    },
    "intercom": {
        "label": "Intercom",
        "description": "Import customer conversations and support threads from Intercom",
        "icon": "intercom",
        "auth_type": "api_token",
        "scopes": [],
    },
    "linear": {
        "label": "Linear",
        "description": "Import issues, projects, and roadmap data from Linear",
        "icon": "linear",
        "auth_type": "api_token",
        "scopes": [],
    },
    "gmail": {
        "label": "Gmail",
        "description": "Import emails and threads from Gmail",
        "icon": "gmail",
        "auth_type": "oauth",
        "scopes": ["https://www.googleapis.com/auth/gmail.readonly"],
    },
    "zoom": {
        "label": "Zoom",
        "description": "Import meeting transcripts and recordings metadata from Zoom",
        "icon": "zoom",
        "auth_type": "oauth",
        "scopes": ["recording:read", "meeting:read"],
    },
    "discord": {
        "label": "Discord",
        "description": "Import messages and threads from Discord servers",
        "icon": "discord",
        "auth_type": "api_token",
        "scopes": [],
    },
}


class UserIntegration(Base):
    __tablename__ = "user_integrations"

    id         = Column(Integer, primary_key=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user_id   = Column(Integer, ForeignKey("users.id",   ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    source_system = Column(SQLEnum(IntegrationSystem), nullable=False, index=True)

    # AES-256-GCM encrypted blobs — use EncryptionService to read/write
    access_token_enc  = Column(BYTEA, nullable=True)
    refresh_token_enc = Column(BYTEA, nullable=True)
    token_expiry      = Column(DateTime, nullable=True)

    # Source-specific config: e.g. {"channel_ids": ["C123"], "repo": "org/repo"}
    config = Column(JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"))

    # dlt pipeline state / Graph API deltaToken — updated after every successful pull
    incremental_state = Column(JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"))

    status         = Column(SQLEnum(IntegrationStatus), nullable=False, default=IntegrationStatus.PENDING_AUTH, index=True)
    last_synced_at = Column(DateTime, nullable=True)
    last_error     = Column(Text, nullable=True)
    sync_enabled   = Column(Boolean, nullable=False, default=True)

    # relationships
    user   = relationship("User",   foreign_keys=[user_id])
    tenant = relationship("Tenant", foreign_keys=[tenant_id])

    __table_args__ = (
        sa.UniqueConstraint("user_id", "source_system", name="uq_user_integration_system"),
    )

    def __repr__(self) -> str:
        return f"<UserIntegration user={self.user_id} system={self.source_system} status={self.status}>"
