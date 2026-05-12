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


# ── Retention helper ───────────────────────────────────────────────────────────

async def _store_raw_with_retention(
    texts: list[str],
    source_label: str,
    integration: UserIntegration,
    db: AsyncSession,
) -> None:
    """
    Persist raw integration content as a single ContextSource row in Evols's DB
    and apply the tenant's default retention policy to it.

    LightRAG has already received the extracted knowledge graph regardless of
    this policy — retention only controls how long the original raw text survives
    in Evols's own database.
    """
    if not texts:
        return

    from app.models.context import ContextSource, ContextSourceType, ContextProcessingStatus
    from app.models.tenant import Tenant
    from app.services.retention_service import RetentionPolicyService

    # Look up tenant retention policy
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == integration.tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    policy = (tenant.settings or {}).get("default_retention_policy", "30_days_encrypted") if tenant else "30_days_encrypted"
    if policy not in RetentionPolicyService.valid_policies():
        policy = "30_days_encrypted"

    # Combine all items into one raw blob for the row
    raw_content = "\n\n---\n\n".join(texts)

    source = ContextSource(
        tenant_id=integration.tenant_id,
        user_id=integration.user_id,
        source_type=ContextSourceType.DOCUMENT_PDF,  # generic fallback type for integrations
        name=source_label,
        content=raw_content,
        status=ContextProcessingStatus.COMPLETED,
        entities_extracted_count=len(texts),
        retention_policy=policy,
    )
    db.add(source)
    await db.flush()  # get source.id before applying retention

    retention_service = RetentionPolicyService(db)
    try:
        await retention_service.apply_retention_policy(source, policy, encrypt_if_needed=True)
    except Exception as e:
        logger.warning(f"[IntegrationSync] Retention policy application failed for {source_label}: {e}")


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

async def _pull_slack(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    """Pull new Slack messages using dlt verified source."""
    try:
        import dlt
        from dlt.sources.slack import slack_source  # type: ignore[import]
    except ImportError:
        logger.warning("dlt slack source not installed — skipping Slack pull")
        return [], []

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

    texts, file_sources = [], []
    for resource in source.resources.values():
        for item in resource:
            text = _format_slack_message(item)
            if text:
                texts.append(text)
                file_sources.append(f"slack:{integration.user_id}:{item.get('ts', item.get('id', ''))}")

    if texts:
        state["last_ts"] = datetime.now(timezone.utc).isoformat()
        integration.incremental_state = state

    return texts, file_sources


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


async def _pull_notion(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    try:
        import dlt
        from dlt.sources.notion import notion_databases  # type: ignore[import]
    except ImportError:
        logger.warning("dlt notion source not installed — skipping Notion pull")
        return [], []

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

    return texts, file_sources


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


async def _pull_zendesk(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    try:
        import dlt
        from dlt.sources.zendesk import zendesk_support  # type: ignore[import]
    except ImportError:
        logger.warning("dlt zendesk source not installed — skipping Zendesk pull")
        return [], []

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
        state["last_ts"] = datetime.now(timezone.utc).isoformat()
        integration.incremental_state = state

    return texts, file_sources


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


async def _pull_github(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    try:
        import dlt
        from dlt.sources.github import github_reactions  # type: ignore[import]
    except ImportError:
        logger.warning("dlt github source not installed — skipping GitHub pull")
        return [], []

    access_token = _decrypt_token(integration.access_token_enc, _token_key(integration))
    if not access_token:
        raise ValueError("No GitHub access token")

    config = integration.config or {}
    repos  = config.get("repos", [])
    state  = integration.incremental_state or {}

    if not repos:
        return [], []

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
        for repo in repos:
            state[f"last_ts_{repo}"] = datetime.now(timezone.utc).isoformat()
        integration.incremental_state = state

    return texts, file_sources


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


async def _pull_salesforce(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    try:
        import dlt
        from dlt.sources.salesforce import salesforce_source  # type: ignore[import]
    except ImportError:
        logger.warning("dlt salesforce source not installed — skipping Salesforce pull")
        return [], []

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

    return texts, file_sources


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


# ── dlt verified sources: Jira, HubSpot, Freshdesk, Asana, Pipedrive ─────────

async def _pull_jira(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    """Pull issues and comments via dlt Jira source."""
    try:
        import dlt
        from dlt.sources.jira import jira  # type: ignore[import]
    except ImportError:
        logger.warning("dlt jira source not installed — skipping Jira pull")
        return [], []

    config    = integration.config or {}
    api_token = _decrypt_token(integration.access_token_enc, _token_key(integration))
    if not api_token:
        raise ValueError("No Jira API token")

    domain    = config.get("domain", "")        # e.g. yourcompany.atlassian.net
    email     = config.get("email", "")
    state     = integration.incremental_state or {}

    pipeline = dlt.pipeline(
        pipeline_name=f"jira_{integration.user_id}",
        destination="duckdb",
        dataset_name="jira",
    )
    source = jira(
        subdomain=domain,
        email=email,
        api_token=api_token,
        start_date=state.get("last_ts"),
    )

    texts, file_sources = [], []
    for resource in source.resources.values():
        for item in resource:
            text = _format_jira_issue(item)
            if text:
                texts.append(text)
                file_sources.append(f"jira:{integration.user_id}:{item.get('id', item.get('key', ''))}")

    if texts:
        state["last_ts"] = datetime.now(timezone.utc).isoformat()
        integration.incremental_state = state

    return texts, file_sources


def _format_jira_issue(issue: dict) -> str:
    key     = issue.get("key", "")
    summary = issue.get("summary", issue.get("fields", {}).get("summary", ""))
    desc    = issue.get("description", issue.get("fields", {}).get("description", "")) or ""
    if isinstance(desc, dict):  # Jira ADF format
        desc = desc.get("text", "") or ""
    status   = issue.get("status", issue.get("fields", {}).get("status", {}) or {})
    if isinstance(status, dict):
        status = status.get("name", "")
    assignee = (issue.get("fields", {}).get("assignee") or {}).get("displayName", "")
    if not summary and not desc:
        return ""
    parts = [f"# Jira {key}: {summary}"]
    if status:
        parts.append(f"Status: {status}")
    if assignee:
        parts.append(f"Assignee: {assignee}")
    if desc:
        parts.append(f"\n{str(desc)[:5000]}")
    return "\n".join(parts)


async def _pull_hubspot(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    """Pull contacts, deals, and notes via dlt HubSpot source."""
    try:
        import dlt
        from dlt.sources.hubspot import hubspot  # type: ignore[import]
    except ImportError:
        logger.warning("dlt hubspot source not installed — skipping HubSpot pull")
        return [], []

    api_key = _decrypt_token(integration.access_token_enc, _token_key(integration))
    if not api_key:
        raise ValueError("No HubSpot API key")

    state = integration.incremental_state or {}
    pipeline = dlt.pipeline(
        pipeline_name=f"hubspot_{integration.user_id}",
        destination="duckdb",
        dataset_name="hubspot",
    )
    source = hubspot(api_key=api_key)

    texts, file_sources = [], []
    for resource in source.resources.values():
        for item in resource:
            text = _format_hubspot_record(item)
            if text:
                texts.append(text)
                file_sources.append(f"hubspot:{integration.user_id}:{item.get('id', '')}")

    if texts:
        state["last_ts"] = datetime.now(timezone.utc).isoformat()
        integration.incremental_state = state

    return texts, file_sources


def _format_hubspot_record(rec: dict) -> str:
    props = rec.get("properties", rec)
    name  = props.get("name") or props.get("dealname") or f"{props.get('firstname', '')} {props.get('lastname', '')}".strip()
    notes = props.get("hs_note_body", "") or props.get("description", "") or ""
    if not name and not notes:
        return ""
    kind  = "Deal" if "dealname" in props else ("Contact" if "firstname" in props or "lastname" in props else "Record")
    parts = [f"# HubSpot {kind}: {name}"]
    for field in ("email", "company", "dealstage", "amount", "jobtitle"):
        if props.get(field):
            parts.append(f"{field}: {props[field]}")
    if notes:
        parts.append(f"\n{notes[:4000]}")
    return "\n".join(parts)


async def _pull_freshdesk(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    """Pull support tickets via dlt Freshdesk source."""
    try:
        import dlt
        from dlt.sources.freshdesk import freshdesk  # type: ignore[import]
    except ImportError:
        logger.warning("dlt freshdesk source not installed — skipping Freshdesk pull")
        return [], []

    config   = integration.config or {}
    api_key  = _decrypt_token(integration.access_token_enc, _token_key(integration))
    if not api_key:
        raise ValueError("No Freshdesk API key")

    domain   = config.get("domain", "")   # yourcompany.freshdesk.com
    state    = integration.incremental_state or {}

    pipeline = dlt.pipeline(
        pipeline_name=f"freshdesk_{integration.user_id}",
        destination="duckdb",
        dataset_name="freshdesk",
    )
    source = freshdesk(domain=domain, api_key=api_key, start_date=state.get("last_ts"))

    texts, file_sources = [], []
    for resource in source.resources.values():
        for item in resource:
            text = _format_freshdesk_ticket(item)
            if text:
                texts.append(text)
                file_sources.append(f"freshdesk:{integration.user_id}:{item.get('id', '')}")

    if texts:
        state["last_ts"] = datetime.now(timezone.utc).isoformat()
        integration.incremental_state = state

    return texts, file_sources


def _format_freshdesk_ticket(ticket: dict) -> str:
    subject  = ticket.get("subject", "Support ticket")
    body     = ticket.get("description_text", "") or ticket.get("description", "") or ""
    if not body:
        return ""
    status   = {2: "Open", 3: "Pending", 4: "Resolved", 5: "Closed"}.get(ticket.get("status", 0), "")
    priority = {1: "Low", 2: "Medium", 3: "High", 4: "Urgent"}.get(ticket.get("priority", 0), "")
    parts    = [f"# Freshdesk Ticket: {subject}"]
    if status:
        parts.append(f"Status: {status}")
    if priority:
        parts.append(f"Priority: {priority}")
    parts.append(f"\n{body[:5000]}")
    return "\n".join(parts)


async def _pull_asana(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    """Pull tasks and projects via dlt Asana source."""
    try:
        import dlt
        from dlt.sources.asana import asana_source  # type: ignore[import]
    except ImportError:
        logger.warning("dlt asana source not installed — skipping Asana pull")
        return [], []

    access_token = _decrypt_token(integration.access_token_enc, _token_key(integration))
    if not access_token:
        raise ValueError("No Asana access token")

    config       = integration.config or {}
    workspace_id = config.get("workspace_id", "")
    state        = integration.incremental_state or {}

    pipeline = dlt.pipeline(
        pipeline_name=f"asana_{integration.user_id}",
        destination="duckdb",
        dataset_name="asana",
    )
    source = asana_source(
        access_token=access_token,
        workspace_id=workspace_id or None,
        start_date=state.get("last_ts"),
    )

    texts, file_sources = [], []
    for resource in source.resources.values():
        for item in resource:
            text = _format_asana_task(item)
            if text:
                texts.append(text)
                file_sources.append(f"asana:{integration.user_id}:{item.get('gid', item.get('id', ''))}")

    if texts:
        state["last_ts"] = datetime.now(timezone.utc).isoformat()
        integration.incremental_state = state

    return texts, file_sources


def _format_asana_task(task: dict) -> str:
    name    = task.get("name", "")
    notes   = task.get("notes", "") or ""
    status  = "Completed" if task.get("completed") else "Active"
    project = (task.get("memberships") or [{}])[0].get("project", {}).get("name", "") if task.get("memberships") else ""
    if not name and not notes:
        return ""
    parts = [f"# Asana Task: {name}"]
    if project:
        parts.append(f"Project: {project}")
    parts.append(f"Status: {status}")
    if notes:
        parts.append(f"\n{notes[:4000]}")
    return "\n".join(parts)


async def _pull_pipedrive(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    """Pull deals, contacts, and notes via dlt Pipedrive source."""
    try:
        import dlt
        from dlt.sources.pipedrive import pipedrive_source  # type: ignore[import]
    except ImportError:
        logger.warning("dlt pipedrive source not installed — skipping Pipedrive pull")
        return [], []

    api_token = _decrypt_token(integration.access_token_enc, _token_key(integration))
    if not api_token:
        raise ValueError("No Pipedrive API token")

    state = integration.incremental_state or {}
    pipeline = dlt.pipeline(
        pipeline_name=f"pipedrive_{integration.user_id}",
        destination="duckdb",
        dataset_name="pipedrive",
    )
    source = pipedrive_source(
        pipedrive_api_key=api_token,
        since_timestamp=state.get("last_ts"),
    )

    texts, file_sources = [], []
    for resource in source.resources.values():
        for item in resource:
            text = _format_pipedrive_record(item)
            if text:
                texts.append(text)
                file_sources.append(f"pipedrive:{integration.user_id}:{item.get('id', '')}")

    if texts:
        state["last_ts"] = datetime.now(timezone.utc).isoformat()
        integration.incremental_state = state

    return texts, file_sources


def _format_pipedrive_record(rec: dict) -> str:
    title   = rec.get("title", rec.get("name", ""))
    content = rec.get("content", "") or rec.get("note", "") or ""
    kind    = "Deal" if "stage_id" in rec else ("Contact" if "email" in rec else "Record")
    if not title and not content:
        return ""
    parts = [f"# Pipedrive {kind}: {title}"]
    for field in ("status", "stage_id", "value", "currency", "org_name"):
        if rec.get(field):
            parts.append(f"{field}: {rec[field]}")
    if content:
        parts.append(f"\n{content[:4000]}")
    return "\n".join(parts)


# ── Custom REST-API sources: Confluence, Intercom, Linear ─────────────────────

async def _pull_confluence(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    """Pull pages from Confluence via its REST API (no dlt source available)."""
    try:
        import httpx  # type: ignore[import]
    except ImportError:
        logger.warning("httpx not installed — skipping Confluence pull")
        return [], []

    config    = integration.config or {}
    api_token = _decrypt_token(integration.access_token_enc, _token_key(integration))
    if not api_token:
        raise ValueError("No Confluence API token")

    domain    = config.get("domain", "")          # yourcompany.atlassian.net
    email     = config.get("email", "")
    space_key = config.get("space_key", "")       # optional filter
    state     = integration.incremental_state or {}

    base_url = f"https://{domain}/wiki/rest/api"
    auth     = (email, api_token)
    params   = {"limit": 100, "expand": "body.storage,version,ancestors"}
    if space_key:
        params["spaceKey"] = space_key
    if state.get("last_ts"):
        params["lastModified"] = state["last_ts"]

    texts, file_sources = [], []
    async with httpx.AsyncClient(auth=auth, timeout=30) as client:
        url = f"{base_url}/content"
        while url:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            for page in data.get("results", []):
                text = _format_confluence_page(page)
                if text:
                    texts.append(text)
                    file_sources.append(f"confluence:{integration.user_id}:{page.get('id', '')}")
            next_link = data.get("_links", {}).get("next")
            url    = f"https://{domain}/wiki{next_link}" if next_link else None
            params = {}  # next URL already has params

    if texts:
        state["last_ts"] = datetime.now(timezone.utc).isoformat()
        integration.incremental_state = state

    return texts, file_sources


def _format_confluence_page(page: dict) -> str:
    title   = page.get("title", "")
    body    = page.get("body", {}).get("storage", {}).get("value", "") or ""
    if not title and not body:
        return ""
    # Strip XML/HTML tags from Confluence storage format
    import re
    body = re.sub(r"<[^>]+>", " ", body).strip()
    space = page.get("space", {}).get("name", "") if isinstance(page.get("space"), dict) else ""
    parts = [f"# Confluence: {title}"]
    if space:
        parts.append(f"Space: {space}")
    if body:
        parts.append(f"\n{body[:6000]}")
    return "\n".join(parts)


async def _pull_intercom(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    """Pull conversations from Intercom via its REST API."""
    try:
        import httpx  # type: ignore[import]
    except ImportError:
        logger.warning("httpx not installed — skipping Intercom pull")
        return [], []

    access_token = _decrypt_token(integration.access_token_enc, _token_key(integration))
    if not access_token:
        raise ValueError("No Intercom access token")

    state    = integration.incremental_state or {}
    headers  = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    params: dict = {"per_page": 150, "order": "desc", "sort": "updated_at"}
    if state.get("last_ts"):
        params["updated_since"] = state["last_ts"]

    texts, file_sources = [], []
    async with httpx.AsyncClient(headers=headers, timeout=30) as client:
        url = "https://api.intercom.io/conversations"
        while url:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            for convo in data.get("conversations", []):
                text = _format_intercom_conversation(convo)
                if text:
                    texts.append(text)
                    file_sources.append(f"intercom:{integration.user_id}:{convo.get('id', '')}")
            pages = data.get("pages", {})
            next_page = pages.get("next", {}).get("starting_after") if isinstance(pages.get("next"), dict) else None
            if next_page:
                params = {"per_page": 150, "starting_after": next_page}
            else:
                url = None

    if texts:
        state["last_ts"] = datetime.now(timezone.utc).isoformat()
        integration.incremental_state = state

    return texts, file_sources


def _format_intercom_conversation(convo: dict) -> str:
    source = convo.get("source", {})
    body   = source.get("body", "") or ""
    import re
    body   = re.sub(r"<[^>]+>", " ", body).strip()
    author = source.get("author", {}).get("name", "") or source.get("author", {}).get("email", "")
    state  = convo.get("state", "")
    cid    = convo.get("id", "")
    if not body:
        return ""
    parts = [f"Intercom conversation {cid} from {author} (state: {state})"]
    parts.append(body[:5000])
    # Include conversation parts (replies)
    for part in (convo.get("conversation_parts", {}).get("conversation_parts") or [])[:10]:
        part_body = re.sub(r"<[^>]+>", " ", part.get("body", "") or "").strip()
        part_author = (part.get("author") or {}).get("name", "")
        if part_body:
            parts.append(f"\n{part_author}: {part_body[:2000]}")
    return "\n".join(parts)


async def _pull_linear(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    """Pull issues and projects from Linear via its GraphQL API."""
    try:
        import httpx  # type: ignore[import]
    except ImportError:
        logger.warning("httpx not installed — skipping Linear pull")
        return [], []

    api_key  = _decrypt_token(integration.access_token_enc, _token_key(integration))
    if not api_key:
        raise ValueError("No Linear API key")

    config   = integration.config or {}
    team_key = config.get("team_key", "")   # optional filter by team key
    state    = integration.incremental_state or {}

    filter_clause = ""
    if state.get("last_ts"):
        filter_clause = f', filter: {{ updatedAt: {{ gt: "{state["last_ts"]}" }} }}'
    elif team_key:
        filter_clause = f', filter: {{ team: {{ key: {{ eq: "{team_key}" }} }} }}'

    query = f"""
    {{
      issues(first: 250{filter_clause}) {{
        nodes {{
          id
          identifier
          title
          description
          state {{ name }}
          assignee {{ name }}
          project {{ name }}
          priority
          updatedAt
        }}
      }}
    }}
    """

    headers  = {"Authorization": api_key, "Content-Type": "application/json"}
    texts, file_sources = [], []
    async with httpx.AsyncClient(headers=headers, timeout=30) as client:
        resp = await client.post("https://api.linear.app/graphql", json={"query": query})
        resp.raise_for_status()
        data = resp.json()
        for issue in (data.get("data", {}).get("issues", {}).get("nodes") or []):
            text = _format_linear_issue(issue)
            if text:
                texts.append(text)
                file_sources.append(f"linear:{integration.user_id}:{issue.get('id', '')}")

    if texts:
        state["last_ts"] = datetime.now(timezone.utc).isoformat()
        integration.incremental_state = state

    return texts, file_sources


def _format_linear_issue(issue: dict) -> str:
    identifier  = issue.get("identifier", "")
    title       = issue.get("title", "")
    description = issue.get("description", "") or ""
    state_name  = (issue.get("state") or {}).get("name", "")
    assignee    = (issue.get("assignee") or {}).get("name", "")
    project     = (issue.get("project") or {}).get("name", "")
    priority    = {0: "No priority", 1: "Urgent", 2: "High", 3: "Medium", 4: "Low"}.get(issue.get("priority", 0), "")
    if not title and not description:
        return ""
    parts = [f"# Linear {identifier}: {title}"]
    if project:
        parts.append(f"Project: {project}")
    if state_name:
        parts.append(f"State: {state_name}")
    if assignee:
        parts.append(f"Assignee: {assignee}")
    if priority:
        parts.append(f"Priority: {priority}")
    if description:
        parts.append(f"\n{description[:5000]}")
    return "\n".join(parts)


# ── REST-API sources: Gmail, Zoom, Discord ────────────────────────────────────

async def _pull_gmail(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    """Pull email threads from Gmail via Google API (OAuth access token)."""
    try:
        import httpx  # type: ignore[import]
    except ImportError:
        logger.warning("httpx not installed — skipping Gmail pull")
        return [], []

    access_token = _decrypt_token(integration.access_token_enc, _token_key(integration))
    if not access_token:
        raise ValueError("No Gmail access token")

    config  = integration.config or {}
    state   = integration.incremental_state or {}
    headers = {"Authorization": f"Bearer {access_token}"}

    # Build query: only newer than watermark, skip sent/drafts
    query_parts = ["-in:sent", "-in:drafts"]
    if state.get("last_history_id"):
        # Use Gmail history API for incremental pulls after first run
        pass  # handled below
    after_ts = state.get("after_epoch")
    if after_ts:
        query_parts.append(f"after:{after_ts}")

    texts, file_sources = [], []
    async with httpx.AsyncClient(headers=headers, timeout=30) as client:
        if state.get("last_history_id"):
            # Incremental: fetch new message IDs via history feed
            resp = await client.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/history",
                params={"startHistoryId": state["last_history_id"], "historyTypes": "messageAdded"},
            )
            if resp.status_code == 404:
                # History expired — fall back to full list query
                state.pop("last_history_id", None)
            else:
                resp.raise_for_status()
                history_data = resp.json()
                msg_ids = [
                    m["message"]["id"]
                    for h in history_data.get("history", [])
                    for m in h.get("messagesAdded", [])
                ]
                if history_data.get("historyId"):
                    state["last_history_id"] = history_data["historyId"]
                for mid in msg_ids:
                    msg_resp = await client.get(
                        f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{mid}",
                        params={"format": "metadata", "metadataHeaders": ["Subject", "From", "Date"]},
                    )
                    if msg_resp.status_code != 200:
                        continue
                    full_resp = await client.get(
                        f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{mid}",
                        params={"format": "full"},
                    )
                    if full_resp.status_code != 200:
                        continue
                    text = _format_gmail_message(full_resp.json())
                    if text:
                        texts.append(text)
                        file_sources.append(f"gmail:{integration.user_id}:{mid}")
                integration.incremental_state = state
                return texts, file_sources

        # Full / first-time list fetch
        params: dict = {"maxResults": 100, "q": " ".join(query_parts)}
        list_resp = await client.get(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages", params=params
        )
        list_resp.raise_for_status()
        list_data = list_resp.json()

        for msg_stub in list_data.get("messages", []):
            mid = msg_stub["id"]
            msg_resp = await client.get(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{mid}",
                params={"format": "full"},
            )
            if msg_resp.status_code != 200:
                continue
            text = _format_gmail_message(msg_resp.json())
            if text:
                texts.append(text)
                file_sources.append(f"gmail:{integration.user_id}:{mid}")

        # Store history ID for next incremental run
        profile_resp = await client.get("https://gmail.googleapis.com/gmail/v1/users/me/profile")
        if profile_resp.status_code == 200:
            state["last_history_id"] = profile_resp.json().get("historyId")
        state["after_epoch"] = int(datetime.now(timezone.utc).timestamp())
        integration.incremental_state = state

    return texts, file_sources


def _format_gmail_message(msg: dict) -> str:
    import base64, re
    headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
    subject = headers.get("Subject", "")
    sender  = headers.get("From", "")
    date    = headers.get("Date", "")

    # Extract body — prefer text/plain, fall back to text/html stripped
    body = ""
    def _extract_parts(parts: list) -> str:
        for part in parts:
            mime = part.get("mimeType", "")
            data = part.get("body", {}).get("data", "")
            if mime == "text/plain" and data:
                return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
            if "parts" in part:
                result = _extract_parts(part["parts"])
                if result:
                    return result
        # Fall back to html
        for part in parts:
            mime = part.get("mimeType", "")
            data = part.get("body", {}).get("data", "")
            if mime == "text/html" and data:
                html = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
                return re.sub(r"<[^>]+>", " ", html).strip()
        return ""

    payload = msg.get("payload", {})
    if payload.get("parts"):
        body = _extract_parts(payload["parts"])
    elif payload.get("body", {}).get("data"):
        raw = base64.urlsafe_b64decode(payload["body"]["data"] + "==").decode("utf-8", errors="replace")
        body = re.sub(r"<[^>]+>", " ", raw).strip() if "<" in raw else raw

    body = body.strip()
    if not body and not subject:
        return ""
    parts = [f"# Email: {subject}"]
    if sender:
        parts.append(f"From: {sender}")
    if date:
        parts.append(f"Date: {date}")
    if body:
        parts.append(f"\n{body[:5000]}")
    return "\n".join(parts)


async def _pull_zoom(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    """Pull meeting transcripts from Zoom via its REST API (OAuth)."""
    try:
        import httpx  # type: ignore[import]
    except ImportError:
        logger.warning("httpx not installed — skipping Zoom pull")
        return [], []

    access_token = _decrypt_token(integration.access_token_enc, _token_key(integration))
    if not access_token:
        raise ValueError("No Zoom access token")

    state   = integration.incremental_state or {}
    headers = {"Authorization": f"Bearer {access_token}"}

    # Date range: last sync or past 30 days
    from_date = state.get("last_ts", (datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ) - __import__("datetime").timedelta(days=30)).strftime("%Y-%m-%d"))
    to_date   = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    texts, file_sources = [], []
    async with httpx.AsyncClient(headers=headers, timeout=30) as client:
        # List cloud recordings in the date window
        recordings_resp = await client.get(
            "https://api.zoom.us/v2/users/me/recordings",
            params={"from": from_date, "to": to_date, "page_size": 100},
        )
        recordings_resp.raise_for_status()
        meetings = recordings_resp.json().get("meetings", [])

        for meeting in meetings:
            meeting_id  = meeting.get("uuid", meeting.get("id", ""))
            topic       = meeting.get("topic", "Zoom meeting")
            start_time  = meeting.get("start_time", "")
            duration    = meeting.get("duration", 0)

            # Find transcript file(s)
            for rec_file in meeting.get("recording_files", []):
                if rec_file.get("file_type") != "TRANSCRIPT":
                    continue
                dl_url  = rec_file.get("download_url", "")
                if not dl_url:
                    continue
                # Append access token to download URL (Zoom requirement)
                transcript_resp = await client.get(
                    f"{dl_url}?access_token={access_token}", follow_redirects=True
                )
                if transcript_resp.status_code != 200:
                    continue
                vtt_content = transcript_resp.text
                text = _format_zoom_transcript(vtt_content, topic, start_time, duration)
                if text:
                    texts.append(text)
                    file_sources.append(f"zoom:{integration.user_id}:{meeting_id}")

    if texts:
        state["last_ts"] = to_date
        integration.incremental_state = state

    return texts, file_sources


def _format_zoom_transcript(vtt: str, topic: str, start_time: str, duration: int) -> str:
    """Convert WebVTT transcript to readable text, stripping timestamps."""
    import re
    lines = []
    for line in vtt.splitlines():
        line = line.strip()
        # Skip WEBVTT header, timestamp cues (00:00:00.000 --> ...), and blank lines
        if not line or line == "WEBVTT" or re.match(r"^\d+$", line) or "-->" in line:
            continue
        lines.append(line)
    transcript = " ".join(lines).strip()
    if not transcript:
        return ""
    parts = [f"# Zoom Meeting Transcript: {topic}"]
    if start_time:
        parts.append(f"Date: {start_time}")
    if duration:
        parts.append(f"Duration: {duration} minutes")
    parts.append(f"\n{transcript[:8000]}")
    return "\n".join(parts)


async def _pull_discord(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    """Pull messages from Discord channels via the Discord REST API (bot token)."""
    try:
        import httpx  # type: ignore[import]
    except ImportError:
        logger.warning("httpx not installed — skipping Discord pull")
        return [], []

    bot_token = _decrypt_token(integration.access_token_enc, _token_key(integration))
    if not bot_token:
        raise ValueError("No Discord bot token")

    config      = integration.config or {}
    guild_id    = config.get("guild_id", "")
    channel_ids = config.get("channel_ids", [])   # optional filter; blank = all text channels
    state       = integration.incremental_state or {}
    headers     = {"Authorization": f"Bot {bot_token}"}

    if not guild_id:
        raise ValueError("Discord guild_id is required in config")

    texts, file_sources = [], []
    async with httpx.AsyncClient(headers=headers, timeout=30) as client:
        # Discover channels if no filter provided
        if not channel_ids:
            ch_resp = await client.get(f"https://discord.com/api/v10/guilds/{guild_id}/channels")
            ch_resp.raise_for_status()
            # Type 0 = GUILD_TEXT
            channel_ids = [c["id"] for c in ch_resp.json() if c.get("type") == 0]

        for channel_id in channel_ids:
            watermark_key = f"last_msg_{channel_id}"
            params: dict  = {"limit": 100}
            if state.get(watermark_key):
                params["after"] = state[watermark_key]

            while True:
                resp = await client.get(
                    f"https://discord.com/api/v10/channels/{channel_id}/messages",
                    params=params,
                )
                if resp.status_code == 403:
                    # Bot lacks access to this channel — skip silently
                    break
                resp.raise_for_status()
                messages = resp.json()
                if not messages:
                    break

                # Discord returns newest-first; reverse to process chronologically
                for msg in reversed(messages):
                    text = _format_discord_message(msg, guild_id, channel_id)
                    if text:
                        texts.append(text)
                        file_sources.append(f"discord:{integration.user_id}:{channel_id}:{msg['id']}")

                # Update watermark to highest snowflake ID seen
                state[watermark_key] = messages[0]["id"]  # first = newest

                # If we got fewer than 100 we're caught up
                if len(messages) < 100:
                    break
                params = {"limit": 100, "after": state[watermark_key]}

    integration.incremental_state = state
    return texts, file_sources


def _format_discord_message(msg: dict, guild_id: str, channel_id: str) -> str:
    content = (msg.get("content") or "").strip()
    # Skip empty messages, bot messages, and very short noise
    if not content or len(content) < 15:
        return ""
    if msg.get("author", {}).get("bot"):
        return ""
    author    = msg.get("author", {}).get("username", "unknown")
    timestamp = msg.get("timestamp", "")[:10]  # YYYY-MM-DD
    parts = [f"Discord message from {author} (channel {channel_id}, {timestamp})"]
    parts.append(content[:3000])
    # Include thread replies if present
    for embed in msg.get("embeds", []):
        desc = embed.get("description", "")
        if desc:
            parts.append(f"[embed] {desc[:500]}")
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


async def _pull_outlook(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    try:
        from msgraph import GraphServiceClient  # type: ignore[import]
        from kiota_authentication_azure.azure_identity_authentication_provider import AzureIdentityAuthenticationProvider  # type: ignore[import]
        from azure.core.credentials import AccessToken  # type: ignore[import]
        from azure.core.credentials_async import AsyncTokenCredential  # type: ignore[import]
    except ImportError:
        logger.warning("msgraph-sdk not installed — skipping Outlook pull")
        return [], []

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

    return texts, file_sources


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


async def _pull_teams(integration: UserIntegration, db: AsyncSession) -> tuple[list[str], list[str]]:
    try:
        from msgraph import GraphServiceClient  # type: ignore[import]
        from azure.core.credentials import AccessToken  # type: ignore[import]
        from azure.core.credentials_async import AsyncTokenCredential  # type: ignore[import]
    except ImportError:
        logger.warning("msgraph-sdk not installed — skipping Teams pull")
        return [], []

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

    return texts, file_sources


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
    IntegrationSystem.JIRA:       _pull_jira,
    IntegrationSystem.HUBSPOT:    _pull_hubspot,
    IntegrationSystem.FRESHDESK:  _pull_freshdesk,
    IntegrationSystem.ASANA:      _pull_asana,
    IntegrationSystem.PIPEDRIVE:  _pull_pipedrive,
    IntegrationSystem.CONFLUENCE: _pull_confluence,
    IntegrationSystem.INTERCOM:   _pull_intercom,
    IntegrationSystem.LINEAR:     _pull_linear,
    IntegrationSystem.GMAIL:      _pull_gmail,
    IntegrationSystem.ZOOM:       _pull_zoom,
    IntegrationSystem.DISCORD:    _pull_discord,
}


async def sync_integration(integration: UserIntegration, db: AsyncSession) -> int:
    """
    Pull new data for a single UserIntegration.
    - Calls the source-specific pull function to get (texts, file_sources).
    - Pushes texts to LightRAG for graph extraction.
    - Stores raw content as a ContextSource row in Evols's DB and applies the
      tenant's default retention policy (encrypted 30/90-day window or immediate delete).
    Updates integration.status, last_synced_at, last_error in-place.
    Caller must commit the session.
    Returns number of items pushed to LightRAG.
    """
    pull_fn = _PULL_FN.get(integration.source_system)
    if not pull_fn:
        logger.warning(f"No pull function for {integration.source_system}")
        return 0

    try:
        texts, file_sources = await pull_fn(integration, db)

        if texts:
            # Push to LightRAG (always — regardless of retention policy)
            from app.services.lightrag_ingestion_service import load_tenant_graph_config
            cfg = await load_tenant_graph_config(integration.tenant_id, db)
            await _insert_texts(
                texts, file_sources,
                extra_entity_types=cfg.extra_entity_types if cfg else None,
                extra_entity_attributes=cfg.extra_entity_attributes if cfg else None,
            )

            # Record raw content in Evols DB and apply tenant retention policy
            source_label = f"{integration.source_system.value} sync — user {integration.user_id} — {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
            await _store_raw_with_retention(texts, source_label, integration, db)

        integration.status         = IntegrationStatus.CONNECTED
        integration.last_synced_at = datetime.utcnow()
        integration.last_error     = None
        logger.info(f"Integration sync ok: user={integration.user_id} system={integration.source_system} items={len(texts)}")
        return len(texts)
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
