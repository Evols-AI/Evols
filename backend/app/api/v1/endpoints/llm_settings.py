"""
LLM Settings Endpoints
Manage tenant-specific LLM provider configuration (BYOK - Bring Your Own Keys)
"""

import logging
import time
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_tenant_id, get_current_user
from app.core.security import encrypt_llm_config, decrypt_llm_config, mask_api_key
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.llm_settings import (
    LLMSettingsUpdate,
    LLMSettingsResponse,
    LLMTestConnectionRequest,
    LLMTestConnectionResponse,
    ModelOptionsResponse,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=Optional[LLMSettingsResponse])
async def get_llm_settings(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Get current tenant's LLM configuration (with masked API keys)

    Returns:
        LLM settings with masked sensitive fields, or None if not configured
    """
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant or not tenant.llm_config:
        return None

    try:
        # Decrypt the configuration
        decrypted_config = decrypt_llm_config(tenant.llm_config)

        # Mask sensitive fields
        provider = decrypted_config.get("provider")
        response_data = {
            "provider": provider,
            "model": decrypted_config.get("model"),
            "updated_at": tenant.updated_at,
        }

        # Mask API keys
        if "api_key" in decrypted_config:
            response_data["api_key_masked"] = mask_api_key(decrypted_config["api_key"])

        # Add provider-specific fields
        if provider == "azure_openai":
            response_data["endpoint"] = decrypted_config.get("endpoint")
        elif provider == "aws_bedrock":
            response_data["region"] = decrypted_config.get("region")

        return LLMSettingsResponse(**response_data)

    except Exception as e:
        logger.error(f"Failed to retrieve LLM settings for tenant {tenant_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve LLM settings"
        )


@router.put("/", response_model=LLMSettingsResponse)
async def update_llm_settings(
    config: LLMSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    """
    Update tenant's LLM configuration

    Encrypts sensitive fields before storing in database.
    Requires tenant admin privileges.

    Args:
        config: LLM configuration (provider-specific)

    Returns:
        Updated LLM settings with masked API keys
    """
    # Get tenant
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    try:
        # Convert Pydantic model to dict
        config_dict = config.model_dump()

        # Encrypt sensitive fields
        encrypted_config = encrypt_llm_config(config_dict)

        # Update tenant
        tenant.llm_config = encrypted_config
        await db.commit()
        await db.refresh(tenant)

        # Log audit event
        logger.info(
            f"LLM settings updated for tenant {tenant_id} by user {current_user.id} "
            f"(provider: {config_dict.get('provider')})"
        )

        # Return masked response
        return LLMSettingsResponse(
            provider=config_dict.get("provider"),
            model=config_dict.get("model"),
            api_key_masked=mask_api_key(config_dict.get("api_key", "")),
            endpoint=config_dict.get("endpoint"),
            region=config_dict.get("region"),
            updated_at=tenant.updated_at,
        )

    except Exception as e:
        logger.error(f"Failed to update LLM settings for tenant {tenant_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update LLM settings: {str(e)}"
        )


@router.post("/test", response_model=LLMTestConnectionResponse)
async def test_llm_connection(
    request: LLMTestConnectionRequest,
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Test LLM connection with provided configuration (without saving)

    This endpoint validates credentials by making a test API call.

    Args:
        request: LLM configuration to test

    Returns:
        Test result with success/failure and latency
    """
    config_dict = request.config.model_dump()
    provider = config_dict.get("provider")

    try:
        # Import LLM service
        from app.services.llm_service import get_llm_service

        # Create temporary LLM service with test config
        llm_service = get_llm_service(tenant_config=config_dict)

        # Make test API call
        start_time = time.time()
        test_response = await llm_service.generate(
            prompt="Respond with exactly 'OK' if you can read this message.",
            temperature=0.0,
            max_tokens=10,
        )
        latency_ms = int((time.time() - start_time) * 1000)

        # Check if response is valid
        if test_response and test_response.content:
            logger.info(
                f"LLM connection test successful for tenant {tenant_id} "
                f"(provider: {provider}, latency: {latency_ms}ms)"
            )
            return LLMTestConnectionResponse(
                success=True,
                message=f"Connection successful! Model responded in {latency_ms}ms.",
                provider=provider,
                model=config_dict.get("model"),
                latency_ms=latency_ms,
            )
        else:
            raise ValueError("Empty response from LLM")

    except Exception as e:
        error_message = str(e)
        logger.warning(
            f"LLM connection test failed for tenant {tenant_id} "
            f"(provider: {provider}): {error_message}"
        )

        # Return user-friendly error messages
        if "api_key" in error_message.lower() or "authentication" in error_message.lower():
            message = "Authentication failed. Please check your API key."
        elif "rate" in error_message.lower() or "quota" in error_message.lower():
            message = "Rate limit or quota exceeded. Please check your account."
        elif "timeout" in error_message.lower():
            message = "Connection timed out. Please check your network and endpoint."
        else:
            message = f"Connection failed: {error_message}"

        return LLMTestConnectionResponse(
            success=False,
            message=message,
            provider=provider,
            model=config_dict.get("model"),
            latency_ms=None,
        )


@router.delete("/")
async def delete_llm_settings(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    """
    Remove tenant's LLM configuration

    After deletion, the system will fall back to environment variable configuration
    for development/testing.

    Returns:
        Success message
    """
    # Get tenant
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    try:
        # Remove LLM config
        tenant.llm_config = None
        await db.commit()

        # Log audit event
        logger.info(
            f"LLM settings deleted for tenant {tenant_id} by user {current_user.id}"
        )

        return {
            "success": True,
            "message": "LLM configuration removed successfully. System will fall back to default configuration.",
        }

    except Exception as e:
        logger.error(f"Failed to delete LLM settings for tenant {tenant_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete LLM settings: {str(e)}"
        )


@router.get("/models", response_model=ModelOptionsResponse)
async def get_model_options():
    """
    Get available model options for all providers

    Returns cached models if available, otherwise returns static defaults.
    Use POST /llm-settings/models/refresh to fetch latest models from providers.

    Returns:
        Model options for OpenAI, Anthropic, Azure OpenAI, and AWS Bedrock
    """
    from app.services.model_fetcher import ModelFetcherService
    from app.schemas.llm_settings import (
        OPENAI_MODELS,
        OPENAI_EMBEDDING_MODELS,
        AWS_BEDROCK_MODELS,
        ANTHROPIC_MODELS,
        AWS_REGIONS,
    )

    # Try to get cached models, fall back to static lists
    openai_cache = ModelFetcherService.get_cached_models("openai")
    bedrock_cache = ModelFetcherService.get_cached_models("aws_bedrock")

    return ModelOptionsResponse(
        openai_models=openai_cache.get("models", OPENAI_MODELS) if openai_cache else OPENAI_MODELS,
        openai_embedding_models=openai_cache.get("embedding_models", OPENAI_EMBEDDING_MODELS) if openai_cache else OPENAI_EMBEDDING_MODELS,
        anthropic_models=ANTHROPIC_MODELS,  # Always static
        aws_bedrock_models=bedrock_cache.get("models", AWS_BEDROCK_MODELS) if bedrock_cache else AWS_BEDROCK_MODELS,
        aws_regions=AWS_REGIONS,
    )


@router.post("/models/refresh")
async def refresh_models(
    provider: str,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Refresh model list from provider API

    Fetches latest available models from the provider and caches them.
    Requires valid API credentials to be configured for the tenant.

    Supported providers:
    - openai: Fetches models from OpenAI API
    - aws_bedrock: Fetches models from AWS Bedrock

    Args:
        provider: Provider name (openai, aws_bedrock)

    Returns:
        Updated model list
    """
    from app.services.model_fetcher import ModelFetcherService

    # Validate provider
    if provider not in ["openai", "aws_bedrock"]:
        raise HTTPException(
            status_code=400,
            detail=f"Dynamic refresh not supported for provider '{provider}'. "
                   f"Supported providers: openai, aws_bedrock"
        )

    # Get tenant's LLM config
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant or not tenant.llm_config:
        raise HTTPException(
            status_code=400,
            detail="No LLM configuration found. Please configure your API keys first."
        )

    try:
        # Decrypt config
        config = decrypt_llm_config(tenant.llm_config)

        # Fetch models based on provider
        if provider == "openai":
            api_key = config.get("api_key")
            if not api_key:
                raise HTTPException(
                    status_code=400,
                    detail="OpenAI API key not configured"
                )

            models = await ModelFetcherService.fetch_and_cache_openai(api_key)
            logger.info(f"Refreshed OpenAI models for tenant {tenant_id}")

            return {
                "success": True,
                "provider": provider,
                "models": models.get("models", []),
                "embedding_models": models.get("embedding_models", []),
                "cached_until": "24 hours",
            }

        elif provider == "aws_bedrock":
            access_key_id = config.get("access_key_id")
            secret_access_key = config.get("secret_access_key")
            region = config.get("region", "us-east-1")

            if not access_key_id or not secret_access_key:
                raise HTTPException(
                    status_code=400,
                    detail="AWS credentials not configured"
                )

            models = await ModelFetcherService.fetch_and_cache_bedrock(
                access_key_id, secret_access_key, region
            )
            logger.info(f"Refreshed AWS Bedrock models for tenant {tenant_id} in {region}")

            return {
                "success": True,
                "provider": provider,
                "models": models,
                "cached_until": "24 hours",
            }

    except HTTPException:
        raise
    except ValueError as e:
        # User-friendly error from model fetcher
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to refresh models for {provider}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to refresh models: {str(e)}"
        )
