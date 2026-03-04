"""
Tenant settings endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes
from pydantic import BaseModel, Field
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import get_current_tenant_id
from app.models.tenant import Tenant

router = APIRouter()


class PersonaRefreshSettings(BaseModel):
    """Persona auto-refresh settings"""
    enabled: bool
    interval_days: int = Field(ge=1, le=365, description="Days between refreshes (1-365)")


@router.get("/persona-refresh")
async def get_persona_refresh_settings(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Get persona auto-refresh settings"""
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = tenant.settings or {}
    return {
        "enabled": settings.get("persona_refresh_enabled", False),
        "interval_days": settings.get("persona_refresh_interval_days", 7),
        "last_refresh_date": settings.get("persona_last_refresh_date"),
    }


@router.put("/persona-refresh")
async def update_persona_refresh_settings(
    settings_update: PersonaRefreshSettings,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Update persona auto-refresh settings"""
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = tenant.settings or {}
    settings["persona_refresh_enabled"] = settings_update.enabled
    settings["persona_refresh_interval_days"] = settings_update.interval_days
    tenant.settings = settings

    # Mark as modified for SQLAlchemy to detect JSON change
    attributes.flag_modified(tenant, 'settings')

    await db.commit()

    return {"success": True, "message": "Settings updated successfully"}


class ThemeRefreshSettings(BaseModel):
    """Theme auto-refresh settings"""
    enabled: bool
    interval_days: int = Field(ge=1, le=365, description="Days between refreshes (1-365)")


@router.get("/theme-refresh")
async def get_theme_refresh_settings(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Get theme auto-refresh settings"""
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = tenant.settings or {}
    return {
        "enabled": settings.get("theme_refresh_enabled", False),
        "interval_days": settings.get("theme_refresh_interval_days", 7),
        "last_refresh_date": settings.get("theme_last_refresh_date"),
    }


@router.put("/theme-refresh")
async def update_theme_refresh_settings(
    settings_update: ThemeRefreshSettings,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Update theme auto-refresh settings"""
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = tenant.settings or {}
    settings["theme_refresh_enabled"] = settings_update.enabled
    settings["theme_refresh_interval_days"] = settings_update.interval_days
    tenant.settings = settings

    # Mark as modified for SQLAlchemy to detect JSON change
    attributes.flag_modified(tenant, 'settings')

    await db.commit()

    return {"success": True, "message": "Settings updated successfully"}


class KnowledgeRefreshSettings(BaseModel):
    """Knowledge source auto-refresh settings"""
    enabled: bool
    interval_days: int = Field(ge=1, le=365, description="Days between refreshes (1-365)")


@router.get("/knowledge-refresh")
async def get_knowledge_refresh_settings(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Get knowledge source auto-refresh settings"""
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = tenant.settings or {}
    return {
        "enabled": settings.get("knowledge_refresh_enabled", False),
        "interval_days": settings.get("knowledge_refresh_interval_days", 7),
        "last_refresh_date": settings.get("knowledge_last_refresh_date"),
    }


@router.put("/knowledge-refresh")
async def update_knowledge_refresh_settings(
    settings_update: KnowledgeRefreshSettings,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Update knowledge source auto-refresh settings"""
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = tenant.settings or {}
    settings["knowledge_refresh_enabled"] = settings_update.enabled
    settings["knowledge_refresh_interval_days"] = settings_update.interval_days
    tenant.settings = settings

    # Mark as modified for SQLAlchemy to detect JSON change
    attributes.flag_modified(tenant, 'settings')

    await db.commit()

    return {"success": True, "message": "Settings updated successfully"}
