"""
Integrations API

Manages per-user OAuth connections to external data sources:
Slack, Outlook, Teams, Notion, Salesforce, Zendesk, GitHub.

Endpoints:
  GET    /integrations                — list user's integrations + available systems
  POST   /integrations/:system/connect — store token (after OAuth handled by frontend)
  PATCH  /integrations/:system        — update config (channel IDs, repos, etc.)
  DELETE /integrations/:system        — disconnect
  POST   /integrations/:system/sync   — manual on-demand sync trigger
  GET    /integrations/oauth/callback/microsoft — Microsoft OAuth callback
"""

import logging
import secrets
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.user_integration import (
    IntegrationStatus, IntegrationSystem, UserIntegration, INTEGRATION_META
)
from app.services.encryption_service import EncryptionService
from app.services.integration_sync_service import sync_integration

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/integrations", tags=["integrations"])
_enc = EncryptionService()


def _token_key(integration: UserIntegration) -> str:
    return f"integration:{integration.id}"


def _encrypt(value: str, key_id: str) -> bytes:
    data, nonce, salt = _enc.encrypt_content(value, key_id)
    return _enc.pack_encrypted_blob(data, nonce, salt)


# ── Schemas ────────────────────────────────────────────────────────────────────

class ConnectPayload(BaseModel):
    access_token:  str
    refresh_token: str | None = None
    token_expiry:  datetime | None = None
    config:        dict[str, Any] = {}


class UpdateConfigPayload(BaseModel):
    config:       dict[str, Any] | None = None
    sync_enabled: bool | None = None


class IntegrationOut(BaseModel):
    source_system:  str
    status:         str
    last_synced_at: datetime | None
    last_error:     str | None
    sync_enabled:   bool
    config:         dict[str, Any]
    meta:           dict[str, Any]

    class Config:
        from_attributes = True


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_or_none(
    user_id: int, system: IntegrationSystem, db: AsyncSession
) -> UserIntegration | None:
    result = await db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id      == user_id,
            UserIntegration.source_system == system,
        )
    )
    return result.scalar_one_or_none()


def _to_out(i: UserIntegration) -> IntegrationOut:
    return IntegrationOut(
        source_system  = i.source_system.value,
        status         = i.status.value,
        last_synced_at = i.last_synced_at,
        last_error     = i.last_error,
        sync_enabled   = i.sync_enabled,
        config         = {k: v for k, v in (i.config or {}).items() if k not in ("client_id", "client_secret")},
        meta           = INTEGRATION_META.get(i.source_system.value, {}),
    )


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("")
async def list_integrations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all available integration systems with their connection status for this user.
    Connected integrations include live status; unconnected ones show metadata only.
    """
    result = await db.execute(
        select(UserIntegration).where(UserIntegration.user_id == current_user.id)
    )
    connected = {i.source_system.value: i for i in result.scalars().all()}

    out = []
    for system_key, meta in INTEGRATION_META.items():
        if system_key in connected:
            out.append(_to_out(connected[system_key]))
        else:
            out.append({
                "source_system": system_key,
                "status":        "not_connected",
                "last_synced_at": None,
                "last_error":    None,
                "sync_enabled":  False,
                "config":        {},
                "meta":          meta,
            })
    return out


@router.post("/{system}/connect", status_code=201)
async def connect_integration(
    system: IntegrationSystem,
    payload: ConnectPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Store OAuth tokens for a source system.
    Frontend is responsible for running the OAuth flow and obtaining the access token;
    this endpoint just persists it encrypted.
    """
    existing = await _get_or_none(current_user.id, system, db)

    if existing:
        integration = existing
    else:
        integration = UserIntegration(
            user_id       = current_user.id,
            tenant_id     = current_user.tenant_id,
            source_system = system,
        )
        db.add(integration)
        await db.flush()  # get integration.id for key derivation

    key_id = _token_key(integration)
    integration.access_token_enc  = _encrypt(payload.access_token, key_id)
    integration.refresh_token_enc = _encrypt(payload.refresh_token, key_id) if payload.refresh_token else None
    integration.token_expiry      = payload.token_expiry
    integration.config            = {**( integration.config or {}), **payload.config}
    integration.status            = IntegrationStatus.CONNECTED
    integration.sync_enabled      = True
    integration.last_error        = None

    await db.commit()
    await db.refresh(integration)
    return _to_out(integration)


@router.patch("/{system}")
async def update_integration_config(
    system: IntegrationSystem,
    payload: UpdateConfigPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update channel IDs, repo names, or sync_enabled flag."""
    integration = await _get_or_none(current_user.id, system, db)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not connected")

    if payload.config is not None:
        integration.config = {**(integration.config or {}), **payload.config}
    if payload.sync_enabled is not None:
        integration.sync_enabled = payload.sync_enabled
        if payload.sync_enabled and integration.status == IntegrationStatus.DISCONNECTED:
            integration.status = IntegrationStatus.CONNECTED

    await db.commit()
    await db.refresh(integration)
    return _to_out(integration)


@router.delete("/{system}", status_code=204)
async def disconnect_integration(
    system: IntegrationSystem,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove the OAuth connection. Tokens are wiped immediately."""
    integration = await _get_or_none(current_user.id, system, db)
    if not integration:
        return

    integration.access_token_enc  = None
    integration.refresh_token_enc = None
    integration.token_expiry      = None
    integration.status            = IntegrationStatus.DISCONNECTED
    integration.sync_enabled      = False
    integration.incremental_state = {}

    await db.commit()


@router.post("/{system}/sync")
async def trigger_manual_sync(
    system: IntegrationSystem,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger an immediate on-demand sync for one integration."""
    integration = await _get_or_none(current_user.id, system, db)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not connected")
    if integration.status == IntegrationStatus.DISCONNECTED:
        raise HTTPException(status_code=400, detail="Integration is disconnected")

    count = await sync_integration(integration, db)
    await db.commit()
    return {"items_synced": count, "status": integration.status.value}


# ── Microsoft OAuth callback ───────────────────────────────────────────────────
# The frontend opens a popup to /api/v1/integrations/oauth/start/microsoft which
# redirects to Microsoft. Microsoft redirects back here with ?code=&state=.
# We exchange the code for tokens and store them, then close the popup.

_ms_state_store: dict[str, dict] = {}  # ephemeral in-process state store (sufficient for single-instance)


@router.get("/oauth/start/microsoft")
async def microsoft_oauth_start(
    system: str = Query("outlook"),
    current_user: User = Depends(get_current_user),
):
    """Redirect user to Microsoft login for Outlook or Teams."""
    from app.core.config import settings

    client_id = getattr(settings, "MICROSOFT_CLIENT_ID", None)
    if not client_id:
        raise HTTPException(status_code=500, detail="MICROSOFT_CLIENT_ID not configured")

    redirect_uri = f"{getattr(settings, 'FRONTEND_URL', '')}/api/v1/integrations/oauth/callback/microsoft"
    state_val    = secrets.token_urlsafe(16)

    _ms_state_store[state_val] = {
        "user_id":  current_user.id,
        "tenant_id": current_user.tenant_id,
        "system":   system,
        "expires":  datetime.utcnow() + timedelta(minutes=10),
    }

    scopes_map = {
        "outlook": "Mail.Read Calendars.Read User.Read offline_access",
        "teams":   "ChannelMessage.Read.All Chat.Read User.Read offline_access",
    }
    scope = scopes_map.get(system, "User.Read offline_access")

    auth_url = (
        f"https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
        f"?client_id={client_id}"
        f"&response_type=code"
        f"&redirect_uri={redirect_uri}"
        f"&scope={scope}"
        f"&state={state_val}"
        f"&response_mode=query"
    )
    return RedirectResponse(auth_url)


@router.get("/oauth/callback/microsoft")
async def microsoft_oauth_callback(
    code: str   = Query(...),
    state: str  = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Exchange Microsoft auth code for tokens, store them, close popup.
    Frontend popup detects close and refreshes integration list.
    """
    try:
        import msal  # type: ignore[import]
    except ImportError:
        raise HTTPException(status_code=500, detail="msal not installed")

    state_data = _ms_state_store.pop(state, None)
    if not state_data or state_data["expires"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    from app.core.config import settings
    client_id     = getattr(settings, "MICROSOFT_CLIENT_ID", None)
    client_secret = getattr(settings, "MICROSOFT_CLIENT_SECRET", None)
    redirect_uri  = f"{getattr(settings, 'FRONTEND_URL', '')}/api/v1/integrations/oauth/callback/microsoft"

    app = msal.ConfidentialClientApplication(
        client_id=client_id,
        client_credential=client_secret,
        authority="https://login.microsoftonline.com/common",
    )
    result = app.acquire_token_by_authorization_code(
        code,
        scopes=["User.Read", "offline_access"],
        redirect_uri=redirect_uri,
    )
    if "access_token" not in result:
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {result.get('error_description', result)}")

    user_id   = state_data["user_id"]
    tenant_id = state_data["tenant_id"]
    system    = IntegrationSystem(state_data["system"])

    existing = await _get_or_none(user_id, system, db)
    if existing:
        integration = existing
    else:
        integration = UserIntegration(
            user_id=user_id, tenant_id=tenant_id, source_system=system
        )
        db.add(integration)
        await db.flush()

    key_id = _token_key(integration)
    integration.access_token_enc  = _encrypt(result["access_token"], key_id)
    integration.refresh_token_enc = _encrypt(result["refresh_token"], key_id) if "refresh_token" in result else None
    integration.token_expiry      = datetime.utcnow() + timedelta(seconds=result.get("expires_in", 3600))
    integration.status            = IntegrationStatus.CONNECTED
    integration.sync_enabled      = True
    integration.last_error        = None

    await db.commit()

    # Close popup — frontend listens for window.close()
    return RedirectResponse(url="/integrations/connected?source=" + system.value)
