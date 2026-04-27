"""
LLM Proxy
Accepts OpenAI-compatible requests from LibreChat, looks up the tenant's
BYOK keys from Postgres, and forwards to the real LLM provider.

URL pattern (matches librechat.yaml baseURL):
  POST /api/v1/llm-proxy/anthropic/v1/messages
  POST /api/v1/llm-proxy/openai/chat/completions
  POST /api/v1/llm-proxy/gemini/chat/completions

Auth (two modes):
  1. Standard: Authorization: Bearer <evols_jwt>  — validated by get_current_user
  2. LibreChat internal: X-Evols-User-Id: <evols_user_id_int>
     Used when LibreChat injects the user's OIDC sub claim (Evols Postgres user ID)
     via the {{LIBRECHAT_USER_OPENIDID}} header placeholder. No JWT needed.

This means:
  - No LLM keys at deploy time
  - Each tenant uses their own BYOK keys (already in Postgres)
  - Works for all tenants without any per-tenant config
"""

import json
import logging
import os
import uuid
import httpx
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

# Dedicated thread pool for Bedrock boto3 calls — keeps them off the default executor
# so they don't starve LightRAG embedding concurrency
_BEDROCK_POOL = ThreadPoolExecutor(max_workers=16, thread_name_prefix="bedrock")

from fastapi import APIRouter, Depends, HTTPException, Request

logger = logging.getLogger(__name__)
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_tenant_id
from app.core.security import decrypt_llm_config
from app.models.user import User
from app.models.tenant import Tenant
from app.services.llm_service import LLMService, LLMConfig

router = APIRouter()


def _service_key() -> str:
    return getattr(settings, "LIGHTRAG_API_KEY", None) or os.environ.get("LIGHTRAG_API_KEY", "")


async def _get_tenant_id_for_service(db: AsyncSession) -> int:
    """
    Resolve the default tenant for service-to-service calls (e.g. LightRAG).
    Returns the first active tenant that has LLM keys configured.
    Raises 503 if none found.
    """
    from app.core.security import decrypt_llm_config as _decrypt
    result = await db.execute(select(Tenant).where(Tenant.is_active == True))  # noqa: E712
    tenants = result.scalars().all()
    for tenant in tenants:
        if tenant.llm_config:
            try:
                cfg = _decrypt(tenant.llm_config)
                # Accept any provider that has credentials configured
                has_key = (
                    cfg.get("api_key")                          # OpenAI / Anthropic
                    or cfg.get("access_key_id")                 # AWS Bedrock
                    or (cfg.get("provider") == "aws_bedrock")   # Bedrock with IAM role
                )
                if has_key:
                    return tenant.id
            except Exception:
                continue
    raise HTTPException(
        status_code=503,
        detail="No tenant with configured LLM keys found. Set up keys in Settings → LLM Settings.",
    )


async def _get_user_for_proxy(request: Request, db: AsyncSession) -> User:
    """
    Resolve the current user for LLM proxy requests.

    Tries three auth modes in order:
    1. X-Evols-Service-Key header — used by internal services (LightRAG, background workers).
       Value must match LIGHTRAG_API_KEY env var. Resolves to the default org tenant.
       Returns a sentinel User with tenant_id set; no real user row needed.
    2. X-Evols-User-Id header — set by LibreChat via {{LIBRECHAT_USER_OPENIDID}} placeholder,
       which resolves to the user's OIDC sub (= their Evols Postgres user_id int).
    3. Standard Bearer JWT — falls through to get_current_user.
    """
    # Service key auth — accepts both X-Evols-Service-Key header and Bearer token
    # (LightRAG sends api_key as Bearer token; other internal services may use the header)
    svc_key = _service_key()
    service_key = request.headers.get("X-Evols-Service-Key", "").strip()
    if not service_key:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer ") and svc_key:
            candidate = auth_header[7:]
            if candidate == svc_key:
                service_key = candidate
    if service_key:
        if not svc_key or service_key != svc_key:
            raise HTTPException(status_code=401, detail="Invalid service key")
        tenant_id = await _get_tenant_id_for_service(db)
        sentinel = User()
        sentinel.tenant_id = tenant_id
        sentinel.is_active = True
        return sentinel

    user_id_header = request.headers.get("X-Evols-User-Id", "").strip()
    if user_id_header:
        try:
            user_id = int(user_id_header)
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid X-Evols-User-Id header")

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")
        return user

    # Fall back to standard Bearer JWT auth
    from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
    from app.core.security import decode_access_token
    import bcrypt
    from app.models.api_key import ApiKey
    from sqlalchemy import and_
    from datetime import datetime

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Authentication required: provide Authorization header or X-Evols-User-Id",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header[7:]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    pid = payload.get("user_id")
    if not pid:
        raise HTTPException(status_code=401, detail="Token missing user_id")

    result = await db.execute(select(User).where(User.id == pid))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


async def _get_tenant_id_for_proxy(user: User) -> int:
    if user.tenant_id is None:
        raise HTTPException(
            status_code=400,
            detail="User has no tenant context",
        )
    return user.tenant_id


# ── Provider upstream URLs ────────────────────────────────────────────────────

_UPSTREAM = {
    "anthropic": "https://api.anthropic.com",
    "openai":    "https://api.openai.com",
    "gemini":    "https://generativelanguage.googleapis.com/v1beta/openai",
}

# Headers LibreChat sends that we should NOT forward upstream
_HOP_BY_HOP = {
    "host", "content-length", "transfer-encoding", "connection",
    "authorization",      # replaced with the tenant's real key
    "x-evols-user-id",   # internal auth header, not for upstream
}


async def _get_tenant_llm_key(db: AsyncSession, tenant_id: int, provider: str) -> str:
    """
    Retrieve and decrypt the tenant's API key for the requested provider.
    Raises 422 if the tenant hasn't configured keys for this provider.
    """
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()

    if not tenant or not tenant.llm_config:
        raise HTTPException(
            status_code=422,
            detail=f"No LLM configuration found. Go to Settings → LLM Settings to add your {provider} API key."
        )

    config = decrypt_llm_config(tenant.llm_config)
    configured_provider = config.get("provider", "")

    # Map provider name in URL to provider name in config
    provider_map = {
        "anthropic": "anthropic",
        "openai":    "openai",
        "gemini":    "google_gemini",
    }
    expected = provider_map.get(provider)

    if configured_provider != expected:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Your workspace is configured for '{configured_provider}' but this request "
                f"targets '{provider}'. Go to Settings → LLM Settings to update your provider."
            )
        )

    api_key = config.get("api_key")
    if not api_key:
        raise HTTPException(
            status_code=422,
            detail=f"API key not set for {provider}. Go to Settings → LLM Settings."
        )

    return api_key


async def _proxy(
    request: Request,
    provider: str,
    path: str,
    db: AsyncSession,
    tenant_id: int,
):
    """
    Core proxy logic: replace auth header with tenant key, forward request,
    stream response back.
    """
    upstream_base = _UPSTREAM.get(provider)
    if not upstream_base:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {provider}")

    api_key = await _get_tenant_llm_key(db, tenant_id, provider)

    # Build upstream URL
    upstream_url = f"{upstream_base}/{path.lstrip('/')}"
    query = str(request.url.query)
    if query:
        upstream_url = f"{upstream_url}?{query}"

    # Forward headers, replacing Authorization with the real key
    forward_headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in _HOP_BY_HOP
    }
    if provider == "anthropic":
        forward_headers["x-api-key"] = api_key
        forward_headers["anthropic-version"] = forward_headers.get("anthropic-version", "2023-06-01")
    else:
        forward_headers["authorization"] = f"Bearer {api_key}"

    body = await request.body()

    client = httpx.AsyncClient(timeout=120)
    upstream_resp = await client.send(
        client.build_request(
            method=request.method,
            url=upstream_url,
            headers=forward_headers,
            content=body,
        ),
        stream=True,
    )

    response_headers = {
        k: v for k, v in upstream_resp.headers.items()
        if k.lower() not in {"transfer-encoding", "connection"}
    }

    async def stream_and_close():
        try:
            async for chunk in upstream_resp.aiter_bytes():
                yield chunk
        finally:
            await upstream_resp.aclose()
            await client.aclose()

    return StreamingResponse(
        stream_and_close(),
        status_code=upstream_resp.status_code,
        headers=response_headers,
        media_type=upstream_resp.headers.get("content-type", "application/json"),
    )


# ── Bedrock model ID normalizer ───────────────────────────────────────────────

_BEDROCK_MODEL_MAP = {
    # Claude 4.x requires cross-region inference profiles (us.anthropic.* prefix)
    "claude-haiku-4-5-20251001":        "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    "claude-haiku-4-5":                 "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    "claude-sonnet-4-6":                "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "claude-sonnet-4-6-20250514":       "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "claude-sonnet-4":                  "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "claude-opus-4-7":                  "us.anthropic.claude-opus-4-1-20250805-v1:0",
    "claude-opus-4":                    "us.anthropic.claude-opus-4-1-20250805-v1:0",
}

def _normalize_bedrock_model(model: str) -> str:
    """Translate short/OpenAI-style model names to valid Bedrock model IDs."""
    if model in _BEDROCK_MODEL_MAP:
        return _BEDROCK_MODEL_MAP[model]
    # Already a valid Bedrock ID (contains a dot or slash)
    if "." in model or "/" in model:
        return model
    # Fallback to Sonnet 4
    return "us.anthropic.claude-sonnet-4-20250514-v1:0"


# ── Route handlers ─────────────────────────────────────────────────────────────
# Catch-all paths for each provider so LibreChat can call any sub-path
# (e.g. /v1/messages, /chat/completions, /v1/chat/completions, etc.)

@router.api_route("/anthropic/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
async def proxy_anthropic(
    path: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user_for_proxy(request, db)
    tenant_id = await _get_tenant_id_for_proxy(user)
    return await _proxy(request, "anthropic", path, db, tenant_id)


@router.api_route("/openai/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
async def proxy_openai(
    path: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user_for_proxy(request, db)
    tenant_id = await _get_tenant_id_for_proxy(user)
    return await _proxy(request, "openai", path, db, tenant_id)


@router.api_route("/gemini/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
async def proxy_gemini(
    path: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user_for_proxy(request, db)
    tenant_id = await _get_tenant_id_for_proxy(user)
    return await _proxy(request, "gemini", path, db, tenant_id)


@router.api_route("/bedrock/embeddings", methods=["POST", "OPTIONS"])
@router.api_route("/bedrock/v1/embeddings", methods=["POST", "OPTIONS"])
async def proxy_bedrock_embeddings(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Translate OpenAI-format embeddings requests to AWS Bedrock Titan Embeddings.
    Handles both /bedrock/embeddings and /bedrock/v1/embeddings — LightRAG omits the /v1/ prefix.
    Returns: OpenAI-compatible embeddings response.

    MUST be registered before the /bedrock/{path:path} catch-all below.
    """
    if request.method == "OPTIONS":
        return JSONResponse({}, status_code=200)

    user = await _get_user_for_proxy(request, db)
    tenant_id = await _get_tenant_id_for_proxy(user)

    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant or not tenant.llm_config:
        raise HTTPException(status_code=422, detail="No LLM configuration found.")

    config = decrypt_llm_config(tenant.llm_config)
    if config.get("provider") != "aws_bedrock":
        raise HTTPException(
            status_code=422,
            detail=f"Tenant is configured for '{config.get('provider')}', not aws_bedrock.",
        )

    body = await request.json()
    raw_input = body.get("input", "")
    inputs: list[str] = [raw_input] if isinstance(raw_input, str) else list(raw_input)

    # Default to Titan Embeddings V2 — 1024 dims, normalize on
    bedrock_model = body.get("model", "amazon.titan-embed-text-v2:0")
    if bedrock_model.startswith("text-embedding-"):
        bedrock_model = "amazon.titan-embed-text-v2:0"

    import asyncio
    import boto3

    region = config.get("region", "us-east-1")
    access_key_id = config.get("access_key_id")
    secret_access_key = config.get("secret_access_key")
    session_token = config.get("session_token")

    def _embed_sync(texts: list[str]) -> tuple[list[list[float]], int]:
        client = boto3.client(
            "bedrock-runtime",
            region_name=region,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            aws_session_token=session_token,
        )
        embs, tokens = [], 0
        for text in texts:
            resp = client.invoke_model(
                modelId=bedrock_model,
                contentType="application/json",
                accept="application/json",
                body=json.dumps({"inputText": text, "dimensions": 1024, "normalize": True}),
            )
            data = json.loads(resp["body"].read())
            embs.append(data["embedding"])
            tokens += data.get("inputTextTokenCount", 0)
        return embs, tokens

    try:
        embeddings, total_tokens = await asyncio.get_event_loop().run_in_executor(
            _BEDROCK_POOL, _embed_sync, inputs
        )
    except Exception as e:
        logger.error(f"[bedrock embeddings] {e}")
        raise HTTPException(status_code=502, detail=f"Bedrock embeddings error: {e}")

    return JSONResponse({
        "object": "list",
        "data": [
            {"object": "embedding", "index": i, "embedding": emb}
            for i, emb in enumerate(embeddings)
        ],
        "model": bedrock_model,
        "usage": {"prompt_tokens": total_tokens, "total_tokens": total_tokens},
    })


@router.api_route("/bedrock/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
async def proxy_bedrock(
    path: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Bedrock proxy — translates OpenAI chat/completions format to AWS Bedrock Converse API.
    AWS Bedrock has no OpenAI-compatible REST endpoint, so we use LLMService directly.
    """
    if request.method == "OPTIONS":
        return JSONResponse({}, status_code=200)

    user = await _get_user_for_proxy(request, db)
    tenant_id = await _get_tenant_id_for_proxy(user)

    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant or not tenant.llm_config:
        raise HTTPException(status_code=422, detail="No LLM configuration found.")

    config = decrypt_llm_config(tenant.llm_config)
    if config.get("provider") != "aws_bedrock":
        raise HTTPException(
            status_code=422,
            detail=f"Tenant is configured for '{config.get('provider')}', not aws_bedrock.",
        )

    body = await request.json()
    messages = body.get("messages", [])
    model = body.get("model", config.get("model_id", "us.anthropic.claude-sonnet-4-6"))
    model = _normalize_bedrock_model(model)
    temperature = float(body.get("temperature", 0.7))
    max_tokens = int(body.get("max_tokens", 4096))
    tools = body.get("tools")
    tool_choice = body.get("tool_choice")
    stream = body.get("stream", False)

    llm_config = LLMConfig(
        provider="aws_bedrock",
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        aws_region=config.get("region", "us-east-1"),
        aws_access_key_id=config.get("access_key_id"),
        aws_secret_access_key=config.get("secret_access_key"),
        aws_session_token=config.get("session_token"),
    )

    service = LLMService(llm_config, enable_cache=False)

    if stream:
        response = await service.generate(
            messages=messages,
            tools=tools,
            tool_choice=tool_choice,
        )

        logger.info(
            "[Bedrock proxy] stream response: content=%r tool_calls=%d finish_reason=%s",
            response.content,
            len(response.tool_calls) if response.tool_calls else 0,
            response.finish_reason,
        )

        cid = f"chatcmpl-{uuid.uuid4().hex}"

        def _chunk(delta: dict, finish_reason=None) -> str:
            return "data: " + json.dumps({
                "id": cid,
                "object": "chat.completion.chunk",
                "model": model,
                "choices": [{"index": 0, "delta": delta, "finish_reason": finish_reason}],
            }) + "\n\n"

        async def sse_stream():
            # Role chunk
            yield _chunk({"role": "assistant"})

            if response.tool_calls:
                # Tool call chunks — one per tool call
                for i, tc in enumerate(response.tool_calls):
                    yield _chunk({
                        "tool_calls": [{
                            "index": i,
                            "id": tc.id,
                            "type": "function",
                            "function": {"name": tc.function["name"], "arguments": ""},
                        }]
                    })
                    yield _chunk({
                        "tool_calls": [{
                            "index": i,
                            "function": {"arguments": tc.function.get("arguments", "{}")},
                        }]
                    })
                yield _chunk({}, finish_reason="tool_calls")
            else:
                # Text content chunk
                if response.content:
                    yield _chunk({"content": response.content})
                yield _chunk({}, finish_reason="stop")

            yield "data: [DONE]\n\n"

        return StreamingResponse(sse_stream(), media_type="text/event-stream")

    # Non-streaming: return OpenAI-compatible response
    response = await service.generate(
        messages=messages,
        tools=tools,
        tool_choice=tool_choice,
    )

    openai_response = {
        "id": f"chatcmpl-{uuid.uuid4().hex}",
        "object": "chat.completion",
        "model": model,
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": response.content,
            },
            "finish_reason": response.finish_reason,
        }],
        "usage": response.usage,
    }
    if response.tool_calls:
        openai_response["choices"][0]["message"]["tool_calls"] = [
            {"id": tc.id, "type": "function", "function": tc.function}
            for tc in response.tool_calls
        ]

    return JSONResponse(openai_response)
