"""
Integration Sync Service

Pulls data from connected external sources (Slack, Outlook, Teams, Notion,
Salesforce, Zendesk, GitHub) and feeds it into LightRAG via the existing
lightrag_ingestion_service.

Architecture:
- dlt handles Slack, Notion, Zendesk, GitHub, Salesforce (in-process, no subprocess)
- Microsoft Graph SDK handles Outlook + Teams (per-user delegated OAuth)
- Each pull is incremental — watermarks stored in user_integrations.incremental_state
- Token refresh is handled transparently before each pull
- Raw items are formatted as natural-language text then pushed to LightRAG
"""

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_integration import UserIntegration, IntegrationStatus, IntegrationSystem
from app.services.encryption_service import EncryptionService
from app.services.lightrag_ingestion_service import _insert_texts

logger = logging.getLogger(__name__)

_enc = EncryptionService()


# ── Token helpers ──────────────────────────────────────────────────────────────

def _decrypt_token(blob: bytes | None, key_id: str) -> str | None:
    if not blob:
        return None
    try:
        return _enc.decrypt_content(*_enc.unpack_encrypted_blob(blob), key_id)
    except Exception:
        return None


def _encrypt_token(value: str, key_id: str) -> bytes:
    data, nonce, salt = _enc.encrypt_content(value, key_id)
    return _enc.pack_encrypted_blob(data, nonce, salt)


def _token_key(integration: UserIntegration) -> str:
    return f"integration:{integration.id}"


# ── Per-source pull functions ──────────────────────────────────────────────────

async def _pull_slack(integration: UserIntegration, db: AsyncSession) -> int:
    """Pull new Slack messages using dlt verified source."""
    try:
        import dlt
        from dlt.sources.slack import slack_source  # type: ignore[import]
    except ImportError:
        logger.warning("dlt slack source not installed — skipping Slack pull")
        return 0

    access_token = _decrypt_token(integration.access_token_enc, _token_key(integration))
    if not access_token:
        raise ValueError("No Slack access token")

    config      = integration.config or {}
    channel_ids = config.get("channel_ids", [])
    state       = integration.incremental_state or {}

    pipeline_name = f"slack_{integration.user_id}"
    pipeline = dlt.pipeline(pipeline_name=pipeline_name, destination="duckdb", dataset_name="slack")

    source = slack_source(
        access_token=access_token,
        channel_ids=channel_ids or None,
        start_date=state.get("last_ts"),
    )

    texts, sources = [], []
    for resource in source.resources.values():
        for item in resource:
            text = _format_slack_message(item)
            if text:
                texts.append(text)
                sources.append(f"slack:{integration.user_id}:{item.get('ts', item.get('id', ''))}")

    if texts:
        await _insert_texts(texts, sources)

    # Update watermark — latest message timestamp
    if texts:
        state["last_ts"] = datetime.now(timezone.utc).isoformat()
        integration.incremental_state = state

    return len(texts)


def _format_slack_message(msg: dict) -> str:
    text = msg.get("text", "").strip()
    if not text or len(text) < 10:
        return ""
    user  = msg.get("user") or msg.get("username", "unknown")
    ts    = msg.get("ts", "")
    chan  = msg.get("channel", "")
    parts = [f"Slack message from {user}"]
    if chan:
        parts[0] += f" in #{chan}"
    if ts:
        try:
            dt = datetime.fromtimestamp(float(ts), tz=timezone.utc)
            parts.append(f"Date: {dt.strftime('%Y-%m-%d %H:%M UTC')}")
        except (ValueError, OSError):
            pass
    parts.append(f"\n{text}")
    return "\n".join(parts)


async def _pull_notion(integration: UserIntegration, db: AsyncSession) -> int:
    try:
        import dlt
        from dlt.sources.notion import notion_databases  # type: ignore[import]
    except ImportError:
        logger.warning("dlt notion source not installed — skipping Notion pull")
        return 0

    access_token = _decrypt_token(integration.access_token_enc, _token_key(integration))
    if not access_token:
        raise ValueError("No Notion access token")

    config   = integration.config or {}
    db_ids   = config.get("database_ids", [])

    pipeline = dlt.pipeline(
        pipeline_name=f"notion_{integration.user_id}",
        destination="duckdb",
        dataset_name="notion",
    )
    source = notion_databases(database_ids=db_ids or None, api_key=access_token)

    texts, file_sources = [], []
    for resource in source.resources.values():
        for item in resource:
            text = _format_notion_page(item)
            if text:
                texts.append(text)
                file_sources.append(f"notion:{integration.user_id}:{item.get('id', '')}")

    if texts:
        await _insert_texts(texts, file_sources)

    return len(texts)


def _format_notion_page(page: dict) -> str:
    title = ""
    props = page.get("properties", {})
    for prop in props.values():
        if prop.get("type") == "title":
            title = "".join(t.get("plain_text", "") for t in prop.get("title", []))
            break
    content = page.get("content", "") or page.get("text", "") or ""
    if not content and not title:
        return ""
    parts = [f"# {title}"] if title else []
    if content:
        parts.append(content[:6000])
    return "\n".join(parts)


async def _pull_zendesk(integration: UserIntegration, db: AsyncSession) -> int:
    try:
        import dlt
        from dlt.sources.zendesk import zendesk_support  # type: ignore[import]
    except ImportError:
        logger.warning("dlt zendesk source not installed — skipping Zendesk pull")
        return 0

    access_token = _decrypt_token(integration.access_token_enc, _token_key(integration))
    if not access_token:
        raise ValueError("No Zendesk access token")

    config    = integration.config or {}
    subdomain = config.get("subdomain", "")
    state     = integration.incremental_state or {}

    pipeline = dlt.pipeline(
        pipeline_name=f"zendesk_{integration.user_id}",
        destination="duckdb",
        dataset_name="zendesk",
    )
    source = zendesk_support(
        subdomain=subdomain,
        oauth_token=access_token,
        start_date=state.get("last_ts"),
    )

    texts, file_sources = [], []
    for resource in source.resources.values():
        for item in resource:
            text = _format_zendesk_ticket(item)
            if text:
                texts.append(text)
                file_sources.append(f"zendesk:{integration.user_id}:{item.get('id', '')}")

    if texts:
        await _insert_texts(texts, file_sources)

    if texts:
        state["last_ts"] = datetime.now(timezone.utc).isoformat()
        integration.incremental_state = state

    return len(texts)


def _format_zendesk_ticket(ticket: dict) -> str:
    subject = ticket.get("subject", "Support ticket")
    body    = ticket.get("description", "") or ticket.get("body", "")
    if not body:
        return ""
    status   = ticket.get("status", "")
    priority = ticket.get("priority", "")
    parts    = [f"# Support Ticket: {subject}"]
    if status:
        parts.append(f"Status: {status}")
    if priority:
        parts.append(f"Priority: {priority}")
    parts.append(f"\n{body[:5000]}")
    return "\n".join(parts)


async def _pull_github(integration: UserIntegration, db: AsyncSession) -> int:
    try:
        import dlt
        from dlt.sources.github import github_reactions  # type: ignore[import]
    except ImportError:
        logger.warning("dlt github source not installed — skipping GitHub pull")
        return 0

    access_token = _decrypt_token(integration.access_token_enc, _token_key(integration))
    if not access_token:
        raise ValueError("No GitHub access token")

    config = integration.config or {}
    repos  = config.get("repos", [])
    state  = integration.incremental_state or {}

    if not repos:
        return 0

    texts, file_sources = [], []
    for repo in repos:
        owner, name = repo.split("/", 1)
        pipeline = dlt.pipeline(
            pipeline_name=f"github_{integration.user_id}_{owner}_{name}",
            destination="duckdb",
            dataset_name="github",
        )
        source = github_reactions(
            owner=owner,
            name=name,
            access_token=access_token,
            start_date=state.get(f"last_ts_{repo}"),
        )
        for resource in source.resources.values():
            for item in resource:
                text = _format_github_item(item, repo)
                if text:
                    texts.append(text)
                    file_sources.append(f"github:{integration.user_id}:{repo}:{item.get('id', item.get('number', ''))}")

    if texts:
        await _insert_texts(texts, file_sources)

    if texts:
        for repo in repos:
            state[f"last_ts_{repo}"] = datetime.now(timezone.utc).isoformat()
        integration.incremental_state = state

    return len(texts)


def _format_github_item(item: dict, repo: str) -> str:
    kind    = "Issue" if "issue_url" not in item else "PR"
    title   = item.get("title", "")
    body    = item.get("body", "") or ""
    number  = item.get("number", "")
    state   = item.get("state", "")
    if not title and not body:
        return ""
    parts = [f"# GitHub {kind} #{number}: {title}"]
    parts.append(f"Repo: {repo}")
    if state:
        parts.append(f"State: {state}")
    if body:
        parts.append(f"\n{body[:4000]}")
    return "\n".join(parts)


async def _pull_salesforce(integration: UserIntegration, db: AsyncSession) -> int:
    try:
        import dlt
        from dlt.sources.salesforce import salesforce_source  # type: ignore[import]
    except ImportError:
        logger.warning("dlt salesforce source not installed — skipping Salesforce pull")
        return 0

    access_token = _decrypt_token(integration.access_token_enc, _token_key(integration))
    if not access_token:
        raise ValueError("No Salesforce access token")

    config        = integration.config or {}
    instance_url  = config.get("instance_url", "")

    pipeline = dlt.pipeline(
        pipeline_name=f"salesforce_{integration.user_id}",
        destination="duckdb",
        dataset_name="salesforce",
    )
    source = salesforce_source(
        instance_url=instance_url,
        access_token=access_token,
    )

    texts, file_sources = [], []
    for resource in source.resources.values():
        for item in resource:
            text = _format_salesforce_record(item)
            if text:
                texts.append(text)
                file_sources.append(f"salesforce:{integration.user_id}:{item.get('Id', '')}")

    if texts:
        await _insert_texts(texts, file_sources)

    return len(texts)


def _format_salesforce_record(rec: dict) -> str:
    name    = rec.get("Name", rec.get("Subject", ""))
    kind    = rec.get("attributes", {}).get("type", "Record")
    desc    = rec.get("Description", "") or rec.get("Body", "") or ""
    if not name and not desc:
        return ""
    parts = [f"# Salesforce {kind}: {name}"]
    for field in ("AccountName", "StageName", "Status", "Priority", "Type"):
        if rec.get(field):
            parts.append(f"{field}: {rec[field]}")
    if desc:
        parts.append(f"\n{desc[:4000]}")
    return "\n".join(parts)


# ── Microsoft Graph (Outlook + Teams) ─────────────────────────────────────────

async def _refresh_microsoft_token(integration: UserIntegration, db: AsyncSession) -> str | None:
    """Silently refresh a Microsoft access token using MSAL."""
    try:
        import msal  # type: ignore[import]
    except ImportError:
        logger.warning("msal not installed — cannot refresh Microsoft token")
        return None

    from app.core.config import settings
    key_id        = _token_key(integration)
    refresh_token = _decrypt_token(integration.refresh_token_enc, key_id)
    if not refresh_token:
        return None

    config       = integration.config or {}
    client_id    = getattr(settings, "MICROSOFT_CLIENT_ID", None) or config.get("client_id")
    tenant_hint  = config.get("ms_tenant", "common")

    app = msal.PublicClientApplication(
        client_id=client_id,
        authority=f"https://login.microsoftonline.com/{tenant_hint}",
    )
    result = app.acquire_token_by_refresh_token(
        refresh_token,
        scopes=integration.config.get("scopes", ["Mail.Read", "User.Read", "offline_access"]),
    )
    if "access_token" not in result:
        raise ValueError(f"MSAL refresh failed: {result.get('error_description', result)}")

    # Persist refreshed tokens
    integration.access_token_enc  = _encrypt_token(result["access_token"], key_id)
    if "refresh_token" in result:
        integration.refresh_token_enc = _encrypt_token(result["refresh_token"], key_id)
    from datetime import timedelta
    integration.token_expiry = datetime.utcnow() + timedelta(seconds=result.get("expires_in", 3600))
    await db.flush()

    return result["access_token"]


async def _pull_outlook(integration: UserIntegration, db: AsyncSession) -> int:
    try:
        from msgraph import GraphServiceClient  # type: ignore[import]
        from kiota_authentication_azure.azure_identity_authentication_provider import AzureIdentityAuthenticationProvider  # type: ignore[import]
        from azure.core.credentials import AccessToken  # type: ignore[import]
        from azure.core.credentials_async import AsyncTokenCredential  # type: ignore[import]
    except ImportError:
        logger.warning("msgraph-sdk not installed — skipping Outlook pull")
        return 0

    access_token = await _ensure_valid_microsoft_token(integration, db)
    if not access_token:
        raise ValueError("Could not obtain valid Outlook access token")

    state      = integration.incremental_state or {}
    delta_link = state.get("outlook_delta_link")

    # Build a simple credential wrapper
    class _StaticCredential(AsyncTokenCredential):
        def __init__(self, token: str):
            self._token = token
        async def get_token(self, *scopes, **kwargs):
            return AccessToken(self._token, int(datetime.utcnow().timestamp()) + 3600)
        async def close(self):
            pass

    client = GraphServiceClient(credentials=_StaticCredential(access_token))

    texts, file_sources = [], []
    try:
        if delta_link:
            result = await client.me.messages.delta.get(delta_link=delta_link)
        else:
            result = await client.me.messages.get(top=50, filter="isRead eq false")

        messages = result.value or []
        for msg in messages:
            text = _format_outlook_message(msg)
            if text:
                texts.append(text)
                file_sources.append(f"outlook:{integration.user_id}:{msg.id}")

        # Store delta link for next incremental pull
        if hasattr(result, "odata_delta_link") and result.odata_delta_link:
            state["outlook_delta_link"] = result.odata_delta_link
            integration.incremental_state = state

    except Exception as exc:
        raise ValueError(f"Outlook Graph API error: {exc}") from exc

    if texts:
        await _insert_texts(texts, file_sources)

    return len(texts)


def _format_outlook_message(msg: Any) -> str:
    subject = getattr(msg, "subject", "") or ""
    body    = ""
    if hasattr(msg, "body") and msg.body:
        body = getattr(msg.body, "content", "") or ""
        # strip HTML tags minimally
        import re
        body = re.sub(r"<[^>]+>", " ", body).strip()
    sender = ""
    if hasattr(msg, "sender") and msg.sender:
        ep = getattr(msg.sender, "email_address", None)
        if ep:
            sender = getattr(ep, "name", "") or getattr(ep, "address", "")
    if not subject and not body:
        return ""
    parts = [f"# Email: {subject}"]
    if sender:
        parts.append(f"From: {sender}")
    if body:
        parts.append(f"\n{body[:5000]}")
    return "\n".join(parts)


async def _pull_teams(integration: UserIntegration, db: AsyncSession) -> int:
    try:
        from msgraph import GraphServiceClient  # type: ignore[import]
        from azure.core.credentials import AccessToken  # type: ignore[import]
        from azure.core.credentials_async import AsyncTokenCredential  # type: ignore[import]
    except ImportError:
        logger.warning("msgraph-sdk not installed — skipping Teams pull")
        return 0

    access_token = await _ensure_valid_microsoft_token(integration, db)
    if not access_token:
        raise ValueError("Could not obtain valid Teams access token")

    class _StaticCredential(AsyncTokenCredential):
        def __init__(self, token: str):
            self._token = token
        async def get_token(self, *scopes, **kwargs):
            return AccessToken(self._token, int(datetime.utcnow().timestamp()) + 3600)
        async def close(self):
            pass

    client = GraphServiceClient(credentials=_StaticCredential(access_token))
    config = integration.config or {}
    state  = integration.incremental_state or {}

    texts, file_sources = [], []
    try:
        teams_result = await client.me.joined_teams.get()
        for team in (teams_result.value or []):
            channels_result = await client.teams.by_team_id(team.id).channels.get()
            for channel in (channels_result.value or []):
                delta_key = f"teams_delta_{team.id}_{channel.id}"
                delta_link = state.get(delta_key)
                try:
                    if delta_link:
                        msgs = await client.teams.by_team_id(team.id).channels.by_channel_id(channel.id).messages.delta.get(delta_link=delta_link)
                    else:
                        msgs = await client.teams.by_team_id(team.id).channels.by_channel_id(channel.id).messages.get(top=50)
                    for msg in (msgs.value or []):
                        text = _format_teams_message(msg, team.display_name, channel.display_name)
                        if text:
                            texts.append(text)
                            file_sources.append(f"teams:{integration.user_id}:{team.id}:{channel.id}:{msg.id}")
                    if hasattr(msgs, "odata_delta_link") and msgs.odata_delta_link:
                        state[delta_key] = msgs.odata_delta_link
                except Exception as e:
                    logger.warning(f"Teams channel pull error ({team.id}/{channel.id}): {e}")
        integration.incremental_state = state
    except Exception as exc:
        raise ValueError(f"Teams Graph API error: {exc}") from exc

    if texts:
        await _insert_texts(texts, file_sources)

    return len(texts)


def _format_teams_message(msg: Any, team_name: str, channel_name: str) -> str:
    body = ""
    if hasattr(msg, "body") and msg.body:
        import re
        body = re.sub(r"<[^>]+>", " ", getattr(msg.body, "content", "") or "").strip()
    if not body or len(body) < 10:
        return ""
    sender = ""
    if hasattr(msg, "from_") and msg.from_:
        user = getattr(msg.from_, "user", None)
        if user:
            sender = getattr(user, "display_name", "") or ""
    parts = [f"Teams message from {sender} in {team_name} / #{channel_name}"]
    parts.append(body[:3000])
    return "\n".join(parts)


# ── Token validity helper ──────────────────────────────────────────────────────

async def _ensure_valid_microsoft_token(integration: UserIntegration, db: AsyncSession) -> str | None:
    now = datetime.utcnow()
    if integration.token_expiry and integration.token_expiry > now:
        # Token still valid
        return _decrypt_token(integration.access_token_enc, _token_key(integration))
    # Try refresh
    return await _refresh_microsoft_token(integration, db)


# ── Dispatcher ────────────────────────────────────────────────────────────────

_PULL_FN = {
    IntegrationSystem.SLACK:      _pull_slack,
    IntegrationSystem.NOTION:     _pull_notion,
    IntegrationSystem.ZENDESK:    _pull_zendesk,
    IntegrationSystem.GITHUB:     _pull_github,
    IntegrationSystem.SALESFORCE: _pull_salesforce,
    IntegrationSystem.OUTLOOK:    _pull_outlook,
    IntegrationSystem.TEAMS:      _pull_teams,
}


async def sync_integration(integration: UserIntegration, db: AsyncSession) -> int:
    """
    Pull new data for a single UserIntegration.
    Updates integration.status, last_synced_at, last_error in-place.
    Caller must commit the session.
    Returns number of items pushed to LightRAG.
    """
    pull_fn = _PULL_FN.get(integration.source_system)
    if not pull_fn:
        logger.warning(f"No pull function for {integration.source_system}")
        return 0

    try:
        count = await pull_fn(integration, db)
        integration.status         = IntegrationStatus.CONNECTED
        integration.last_synced_at = datetime.utcnow()
        integration.last_error     = None
        logger.info(f"Integration sync ok: user={integration.user_id} system={integration.source_system} items={count}")
        return count
    except Exception as exc:
        integration.status     = IntegrationStatus.ERROR
        integration.last_error = str(exc)
        logger.error(f"Integration sync error: user={integration.user_id} system={integration.source_system} — {exc}")
        return 0


async def _get_sync_interval_minutes(db: AsyncSession, tenant_id: int) -> int:
    """Read integration_sync_interval_minutes from tenant settings (default 5, minimum 5)."""
    from app.models.tenant import Tenant
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        return 5
    minutes = (tenant.settings or {}).get("integration_sync_interval_minutes", 5)
    return max(5, int(minutes))


async def sync_all_due(db: AsyncSession) -> None:
    """
    Called by the scheduler every 5 minutes.
    Each integration is only pulled if its tenant's configured interval has elapsed.
    """
    from datetime import timedelta

    result = await db.execute(
        select(UserIntegration).where(
            UserIntegration.sync_enabled == True,
            UserIntegration.status.in_([IntegrationStatus.CONNECTED, IntegrationStatus.ERROR]),
        )
    )
    all_integrations = result.scalars().all()

    # Group by tenant to avoid re-fetching settings per integration
    tenant_intervals: dict[int, int] = {}
    due: list[UserIntegration] = []
    for integration in all_integrations:
        if integration.tenant_id not in tenant_intervals:
            tenant_intervals[integration.tenant_id] = await _get_sync_interval_minutes(db, integration.tenant_id)
        interval = tenant_intervals[integration.tenant_id]
        cutoff = datetime.utcnow() - timedelta(minutes=interval)
        if integration.last_synced_at is None or integration.last_synced_at < cutoff:
            due.append(integration)

    for integration in due:
        await sync_integration(integration, db)

    if due:
        await db.commit()

    logger.info(f"Integration scheduler: synced {len(due)}/{len(all_integrations)} integrations")
