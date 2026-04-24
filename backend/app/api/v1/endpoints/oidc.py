"""
OIDC Provider Bridge
Implements a minimal OpenID Connect provider so LibreChat (and any other
OIDC client) can delegate authentication to Evols.

Flow:
  1. LibreChat redirects browser to GET /authorize?response_type=code&...
  2. We redirect to the Evols login page (frontend) with the OIDC params preserved
  3. Evols login page POSTs credentials to /api/v1/auth/login as normal
  4. On success, the frontend redirects to GET /api/v1/oidc/callback?email=...&code_verifier=...
  5. We issue a one-time auth code and redirect to LibreChat's redirect_uri
  6. LibreChat POSTs the code to POST /token → we return an id_token + access_token
  7. LibreChat calls GET /userinfo with the access_token → we return the user profile

This is a server-side OIDC Authorization Code flow (no PKCE required since
the client secret is shared server-to-server).

Configuration env vars (add to .env and Cloud Run secrets):
  OIDC_ISSUER         — https://your-backend.run.app/api/v1/oidc
  OIDC_CLIENT_ID      — evols-workbench  (or any string)
  OIDC_CLIENT_SECRET  — long random secret, shared with LibreChat
  FRONTEND_URL        — https://your-frontend.run.app  (already exists)
"""

import base64
import secrets
import hashlib
import json
from datetime import datetime, timedelta
from typing import Optional, Dict
from urllib.parse import urlencode, urlparse, parse_qs

import redis.asyncio as aioredis
from loguru import logger
from fastapi import APIRouter, Depends, HTTPException, Request, Form, Query
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.config import settings
from app.core.security import verify_password, create_access_token, decode_access_token
from app.core.dependencies import get_current_user, get_current_tenant_id
from app.models.user import User
from app.models.tenant import Tenant
from app.models.user_tenant import UserTenant

router = APIRouter()

_OTT_TTL_SECONDS = 60
_CODE_TTL_SECONDS = 300


def _redis() -> aioredis.Redis:
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)


async def _ott_set(token: str, user_id: int, tenant_id: int) -> None:
    try:
        async with _redis() as r:
            await r.setex(f"ott:{token}", _OTT_TTL_SECONDS, json.dumps({"user_id": user_id, "tenant_id": tenant_id}))
        logger.info("[OIDC] OTT stored: %s... user=%s", token[:8], user_id)
    except Exception as e:
        logger.error("[OIDC] Redis error in _ott_set: %s", e)
        raise


async def _ott_pop(token: str) -> Optional[Dict]:
    try:
        async with _redis() as r:
            key = f"ott:{token}"
            raw = await r.getdel(key)
            logger.info("[OIDC] OTT pop %s...: %s", token[:8], "found" if raw else "not found")
            return json.loads(raw) if raw else None
    except Exception as e:
        logger.error("[OIDC] Redis error in _ott_pop: %s", e)
        return None


async def _code_set(code: str, user_id: int, tenant_id: int, redirect_uri: str) -> None:
    async with _redis() as r:
        await r.setex(f"oidc_code:{code}", _CODE_TTL_SECONDS, json.dumps({"user_id": user_id, "tenant_id": tenant_id, "redirect_uri": redirect_uri}))


async def _code_pop(code: str) -> Optional[Dict]:
    async with _redis() as r:
        key = f"oidc_code:{code}"
        raw = await r.getdel(key)
        return json.loads(raw) if raw else None


def _oidc_base(request: Request) -> str:
    """The canonical OIDC issuer URL derived from the request host."""
    issuer = getattr(settings, "OIDC_ISSUER", None)
    if issuer:
        return issuer.rstrip("/")
    # Fallback: construct from request
    return str(request.base_url).rstrip("/") + "/api/v1/oidc"


def _client_id() -> str:
    return getattr(settings, "OIDC_CLIENT_ID", "evols-workbench")


def _client_secret() -> str:
    return getattr(settings, "OIDC_CLIENT_SECRET", "")


def _verify_client(client_id: str, client_secret: str) -> bool:
    if client_id != _client_id():
        return False
    expected = _client_secret()
    if not expected:
        return False
    # Constant-time compare
    return secrets.compare_digest(client_secret, expected)


# ── OIDC Discovery ─────────────────────────────────────────────────────────

@router.get("/.well-known/openid-configuration")
async def openid_configuration(request: Request):
    """
    OIDC Discovery Document.
    LibreChat fetches this once at startup to discover all other endpoint URLs.
    """
    base = _oidc_base(request)
    return JSONResponse({
        "issuer": base,
        "authorization_endpoint": f"{base}/authorize",
        "token_endpoint": f"{base}/token",
        "userinfo_endpoint": f"{base}/userinfo",
        "jwks_uri": f"{base}/jwks",
        "response_types_supported": ["code"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["HS256"],
        "scopes_supported": ["openid", "profile", "email"],
        "token_endpoint_auth_methods_supported": ["client_secret_post"],
        "claims_supported": ["sub", "email", "name", "given_name", "family_name"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
    })


# ── Authorization endpoint ─────────────────────────────────────────────────

@router.get("/authorize")
async def authorize(
    response_type: str = Query(...),
    client_id: str = Query(...),
    redirect_uri: str = Query(...),
    scope: str = Query(default="openid"),
    state: Optional[str] = Query(default=None),
    nonce: Optional[str] = Query(default=None),
    ott: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Authorization endpoint.
    Normal flow: redirect to Evols login page.
    Silent iframe flow: if ?ott= is present and valid, skip login and issue auth code directly.
    """
    if response_type != "code":
        raise HTTPException(status_code=400, detail="Only response_type=code is supported")
    if client_id != _client_id():
        raise HTTPException(status_code=400, detail="Unknown client_id")

    # Silent iframe auto-auth: OTT bypasses login page
    if ott:
        data = await _ott_pop(ott)
        if data:
            user_id = data["user_id"]
            tenant_id = data["tenant_id"]
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user and user.is_active:
                code = secrets.token_urlsafe(32)
                await _code_set(code, user_id, tenant_id, redirect_uri)
                params: Dict[str, str] = {"code": code}
                if state:
                    params["state"] = state
                return RedirectResponse(url=f"{redirect_uri}?{urlencode(params)}", status_code=302)

    # Build the callback URL that the frontend should redirect to after login
    callback_params: Dict[str, str] = {
        "redirect_uri": redirect_uri,
    }
    if state:
        callback_params["state"] = state
    if nonce:
        callback_params["nonce"] = nonce

    frontend_login = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
    login_url = (
        f"{frontend_login.rstrip('/')}/login"
        f"?oidc_callback=1&{urlencode(callback_params)}"
    )
    return RedirectResponse(url=login_url, status_code=302)


# ── Callback endpoint (called by frontend after successful login) ──────────

@router.get("/callback")
async def oidc_callback(
    request: Request,
    redirect_uri: str = Query(...),
    state: Optional[str] = Query(default=None),
    # The frontend passes a short-lived Evols JWT it just received from /auth/login
    token: str = Query(..., description="Short-lived Evols JWT from /auth/login"),
    db: AsyncSession = Depends(get_db),
):
    """
    Called by the Evols frontend after a successful login during an OIDC flow.
    The frontend appends `?token=<evols_jwt>` to this URL.
    We validate the JWT, create an auth code, and redirect to LibreChat.
    """
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("user_id")
    tenant_id = payload.get("tenant_id")
    if not user_id or not tenant_id:
        raise HTTPException(status_code=401, detail="Token missing user_id or tenant_id")

    # Verify user still exists and is active
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    code = secrets.token_urlsafe(32)
    await _code_set(code, user_id, tenant_id, redirect_uri)

    params: Dict[str, str] = {"code": code}
    if state:
        params["state"] = state

    return RedirectResponse(url=f"{redirect_uri}?{urlencode(params)}", status_code=302)


# ── Token endpoint ─────────────────────────────────────────────────────────

def _resolve_client_credentials(request: Request, form_id: Optional[str], form_secret: Optional[str]):
    """Return (client_id, client_secret) from form fields or Basic auth header."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Basic "):
        try:
            cid, _, csec = base64.b64decode(auth[6:]).decode().partition(":")
            return cid, csec
        except Exception:
            pass
    return form_id or "", form_secret or ""


@router.post("/token")
async def token_endpoint(
    request: Request,
    grant_type: str = Form(...),
    code: Optional[str] = Form(None),
    redirect_uri: Optional[str] = Form(None),
    refresh_token: Optional[str] = Form(None),
    client_id: Optional[str] = Form(None),
    client_secret: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Token endpoint — handles authorization_code and refresh_token grants.
    Accepts credentials as form fields (client_secret_post) or Basic auth header (client_secret_basic).
    """
    resolved_id, resolved_secret = _resolve_client_credentials(request, client_id, client_secret)
    if not _verify_client(resolved_id, resolved_secret):
        raise HTTPException(status_code=401, detail="Invalid client credentials")

    if grant_type == "authorization_code":
        if not code or not redirect_uri:
            raise HTTPException(status_code=400, detail="code and redirect_uri required")
        code_data = await _code_pop(code)
        if not code_data:
            raise HTTPException(status_code=400, detail="Invalid or expired authorization code")
        if code_data["redirect_uri"] != redirect_uri:
            raise HTTPException(status_code=400, detail="redirect_uri mismatch")
        user_id = code_data["user_id"]
        tenant_id = code_data["tenant_id"]

    elif grant_type == "refresh_token":
        if not refresh_token:
            raise HTTPException(status_code=400, detail="refresh_token required")
        payload = decode_access_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(status_code=400, detail="Invalid refresh token")
        user_id = payload.get("user_id")
        tenant_id = payload.get("tenant_id")

    else:
        raise HTTPException(status_code=400, detail="Unsupported grant_type")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    issuer = _oidc_base(request)
    now = datetime.utcnow()

    id_token_data = {
        "iss": issuer,
        "sub": str(user.id),
        "aud": resolved_id,
        "iat": now,
        "exp": now + timedelta(hours=1),
        "email": user.email,
        "name": user.full_name or user.email,
        "given_name": (user.full_name or "").split(" ")[0] if user.full_name else "",
        "family_name": " ".join((user.full_name or "").split(" ")[1:]) if user.full_name else "",
        "user_id": user.id,
        "tenant_id": tenant_id,
    }
    import jose.jwt as _jose
    oidc_secret = _client_secret()

    access_token = create_access_token(
        data={"user_id": user.id, "email": user.email, "tenant_id": tenant_id},
        expires_delta=timedelta(hours=1),
    )
    # id_token must be signed with OIDC_CLIENT_SECRET so LibreChat's openIdJwtStrategy can verify it
    id_token_data["iat"] = int(now.timestamp())
    id_token_data["exp"] = int((now + timedelta(hours=1)).timestamp())
    id_token = _jose.encode(id_token_data, oidc_secret, algorithm="HS256")
    new_refresh_token = create_access_token(
        data={"user_id": user.id, "email": user.email, "tenant_id": tenant_id, "type": "refresh"},
        expires_delta=timedelta(days=30),
    )

    return JSONResponse({
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": 3600,
        "id_token": id_token,
        "refresh_token": new_refresh_token,
        "scope": "openid profile email",
    })


# ── Userinfo endpoint ──────────────────────────────────────────────────────

@router.get("/userinfo")
async def userinfo(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    UserInfo endpoint — return user profile for a valid access_token.
    LibreChat calls this after receiving the token to get the user's name and email.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = auth_header[7:]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing user_id")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return JSONResponse({
        "sub": str(user.id),
        "email": user.email,
        "email_verified": True,
        "name": user.full_name or user.email,
        "given_name": (user.full_name or "").split(" ")[0] if user.full_name else "",
        "family_name": " ".join((user.full_name or "").split(" ")[1:]) if user.full_name else "",
    })


# ── JWKS endpoint (not used for HS256 but some clients request it) ─────────

@router.get("/jwks")
async def jwks():
    """JWKS endpoint — returns empty keyset (we use HS256, not RS256)."""
    return JSONResponse({"keys": []})


# ── One-time token endpoints (iframe silent auto-auth) ─────────────────────

@router.post("/one-time-token")
async def create_one_time_token(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Mint a 30-second one-time token for silent iframe authentication.
    Called by the Evols workbench page before rendering the LibreChat iframe.
    The token is passed as ?ott=<token> in the iframe src URL.
    Single use — consumed immediately by the LibreChat fork on load.
    """
    token = secrets.token_urlsafe(32)
    await _ott_set(token, current_user.id, tenant_id)
    return {"token": token, "expires_in": _OTT_TTL_SECONDS}


@router.post("/exchange-one-time-token")
async def exchange_one_time_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Exchange a one-time token for a full OIDC token set.
    Called by the LibreChat fork immediately on page load when ?ott=<token> is present.
    No auth header required — the OTT is the credential.
    Returns the same shape as /token so the fork can reuse the same handler.
    """
    body = await request.json()
    token = body.get("token", "")

    data = await _ott_pop(token)
    if not data:
        raise HTTPException(status_code=401, detail="Invalid or expired one-time token")

    user_id = data["user_id"]
    tenant_id = data["tenant_id"]

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    issuer = f"{getattr(settings, 'OIDC_ISSUER', '').rstrip('/') or '/api/v1/oidc'}"
    now = datetime.utcnow()
    client_id = _client_id()

    id_token_data = {
        "iss": issuer,
        "sub": str(user.id),
        "aud": client_id,
        "iat": now,
        "exp": now + timedelta(hours=1),
        "email": user.email,
        "name": user.full_name or user.email,
        "given_name": (user.full_name or "").split(" ")[0] if user.full_name else "",
        "family_name": " ".join((user.full_name or "").split(" ")[1:]) if user.full_name else "",
        "user_id": user.id,
        "tenant_id": tenant_id,
    }
    access_token_data = {
        "user_id": user.id,
        "email": user.email,
        "tenant_id": tenant_id,
    }
    access_token = create_access_token(data=access_token_data, expires_delta=timedelta(hours=1))
    id_token = create_access_token(data=id_token_data, expires_delta=timedelta(hours=1))

    return JSONResponse({
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": 3600,
        "id_token": id_token,
        "scope": "openid profile email",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.full_name or user.email,
            "tenant_id": tenant_id,
        }
    })
