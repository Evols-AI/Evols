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
    integration_sync_interval_minutes: int = Field(ge=5, le=1440, default=5, description="Minutes between live integration syncs (5-1440, minimum 5)")
    dedup_interval_hours: int = Field(ge=1, le=168, default=24, description="Hours between entity dedup & resolution runs (1-168, default 24)")
    default_retention_policy: str = Field(
        default="30_days_encrypted",
        description="Default raw-data retention policy applied to all sources (uploaded docs + live integrations)"
    )


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
        "integration_sync_interval_minutes": settings.get("integration_sync_interval_minutes", 5),
        "dedup_interval_hours": settings.get("dedup_interval_hours", 24),
        "default_retention_policy": settings.get("default_retention_policy", "30_days_encrypted"),
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
    settings["integration_sync_interval_minutes"] = max(5, settings_update.integration_sync_interval_minutes)
    settings["dedup_interval_hours"] = max(1, settings_update.dedup_interval_hours)

    from app.services.retention_service import RetentionPolicyService
    if settings_update.default_retention_policy in RetentionPolicyService.valid_policies():
        settings["default_retention_policy"] = settings_update.default_retention_policy
    else:
        raise HTTPException(status_code=400, detail=f"Invalid retention policy: {settings_update.default_retention_policy}")

    tenant.settings = settings

    # Mark as modified for SQLAlchemy to detect JSON change
    attributes.flag_modified(tenant, 'settings')

    await db.commit()

    return {"success": True, "message": "Settings updated successfully"}


# ── Graph extraction defaults ─────────────────────────────────────────────────
# These are the Evols-shipped defaults pre-populated in the UI.
# Tenants own the full list — they can remove, rename, edit definitions, or add
# their own. Everything is stored as entity_types / entity_attributes in
# Tenant.settings. These dicts are the factory defaults shown before first save.

_DEFAULT_ENTITY_TYPE_DEFS: dict[str, str] = {
    "Person": "An individual human identified by name, role, or relationship to the team or product.",
    "Organization": "A company, institution, or group that acts as a customer, partner, or stakeholder.",
    "Product": "A software product, service, or platform being built, sold, or evaluated.",
    "Feature": "A specific capability or function of a product, requested or already implemented.",
    "PainPoint": "A problem, frustration, or obstacle experienced by a customer or user.",
    "FeatureRequest": "An explicit ask from a customer or stakeholder for a new or changed product capability.",
    "Persona": "A named archetype representing a segment of users or buyers with shared goals and behaviours.",
    "Competitor": "A company or product competing in the same market space.",
    "BusinessGoal": "A strategic objective or KPI the team or company is working toward.",
    "Metric": "A quantitative measure used to track performance, usage, or health of a product or team.",
    "Decision": "A resolved choice made by the team with documented reasoning and tradeoffs.",
    "Meeting": "A recorded synchronous interaction between team members or with customers.",
    "Project": "An active initiative or workstream with defined scope and milestones.",
    "Technology": "A tool, framework, language, or infrastructure component used or evaluated.",
    "Market": "A target customer segment, vertical, or geographic region the product serves.",
    "Task": "A unit of work or action item assigned to a person or team.",
}

_DEFAULT_ENTITY_ATTRIBUTE_DEFS: dict[str, str] = {
    "sentiment": "Emotional tone toward the entity: positive, neutral, or negative.",
    "urgency": "How time-sensitive the mention is: low, medium, or high.",
    "business_impact": "Estimated impact on business outcomes: low, medium, or high.",
    "context_snippet": "A short verbatim quote from the source text that best captures this entity.",
    "confidence": "Extraction confidence score between 0 and 1.",
}

# Canonical names expected by LightRAG's built-in ENTITY_TYPES list.
_BUILTIN_TYPE_NAMES: set[str] = set(_DEFAULT_ENTITY_TYPE_DEFS.keys())


def _default_entity_types() -> list[dict]:
    return [{"name": k, "definition": v} for k, v in _DEFAULT_ENTITY_TYPE_DEFS.items()]


def _default_entity_attributes() -> list[dict]:
    return [{"name": k, "definition": v} for k, v in _DEFAULT_ENTITY_ATTRIBUTE_DEFS.items()]


class EntityEntry(BaseModel):
    """A single entity type or attribute with an optional one-line definition."""
    name: str = Field(description="Name, e.g. 'Contract' or 'deal_value'")
    definition: Optional[str] = Field(
        default=None,
        description="One-line description injected into the LLM extraction prompt",
    )


class GraphExtractionSettings(BaseModel):
    """Full tenant-owned entity type and attribute lists for LightRAG extraction."""
    entity_types: list[EntityEntry] = Field(
        default_factory=list,
        description="Complete list of entity types the tenant wants LightRAG to extract",
    )
    entity_attributes: list[EntityEntry] = Field(
        default_factory=list,
        description="Complete list of per-entity attributes the LLM should extract",
    )


def _normalise_entry_list(raw: list) -> list[dict]:
    """Normalise a stored list to [{name, definition}] — handles legacy plain strings."""
    out = []
    for item in raw:
        if isinstance(item, dict) and item.get("name", "").strip():
            out.append({"name": item["name"].strip(), "definition": item.get("definition") or None})
        elif isinstance(item, str) and item.strip():
            out.append({"name": item.strip(), "definition": None})
    return out


@router.get("/graph-extraction")
async def get_graph_extraction_settings(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Return the tenant's entity type and attribute lists.

    Falls back to the Evols factory defaults when the tenant hasn't saved yet,
    so the UI is pre-populated on first visit.
    """
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    s = tenant.settings or {}

    # Use saved list if present; otherwise fall back to factory defaults.
    # Always ensure built-in attributes are present even if a prior save was
    # incomplete (e.g. race condition before loading had finished).
    if "entity_types" in s:
        entity_types = _normalise_entry_list(s["entity_types"])
        # Re-inject any missing built-in entity types at the front
        saved_type_names = {e["name"] for e in entity_types}
        missing_builtin_types = [
            e for e in _default_entity_types()
            if e["name"] not in saved_type_names
        ]
        if missing_builtin_types:
            entity_types = missing_builtin_types + entity_types
    elif "custom_entity_types" in s:
        # Migrate legacy format: prepend built-ins, append custom
        custom = _normalise_entry_list(s["custom_entity_types"])
        entity_types = _default_entity_types() + [e for e in custom if e["name"] not in _BUILTIN_TYPE_NAMES]
    else:
        entity_types = _default_entity_types()

    if "entity_attributes" in s:
        entity_attributes = _normalise_entry_list(s["entity_attributes"])
        # Re-inject any missing built-in attributes at the front
        saved_attr_names = {e["name"] for e in entity_attributes}
        missing_builtins = [
            e for e in _default_entity_attributes()
            if e["name"] not in saved_attr_names
        ]
        if missing_builtins:
            entity_attributes = missing_builtins + entity_attributes
    else:
        entity_attributes = _default_entity_attributes()

    return {
        "entity_types": entity_types,
        "entity_attributes": entity_attributes,
        # Legacy fields — kept so older frontend code doesn't break during deploy
        "default_entity_types": _default_entity_types(),
        "default_entity_attributes": list(_DEFAULT_ENTITY_ATTRIBUTE_DEFS.keys()),
        "custom_entity_types": [],
        "custom_entity_attributes": [],
    }


@router.put("/graph-extraction")
async def update_graph_extraction_settings(
    body: GraphExtractionSettings,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Save the tenant's full entity type and attribute lists."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    def _clean(items: list[EntityEntry], label: str) -> list[dict]:
        seen: set[str] = set()
        out = []
        for entry in items:
            name = entry.name.strip()
            if not name:
                raise HTTPException(status_code=400, detail=f"{label} names must not be empty")
            if name not in seen:
                seen.add(name)
                out.append({"name": name, "definition": entry.definition.strip() if entry.definition else None})
        return out

    s = tenant.settings or {}
    s["entity_types"] = _clean(body.entity_types, "Entity type")
    s["entity_attributes"] = _clean(body.entity_attributes, "Entity attribute")
    # Clear legacy keys to avoid confusion during reads
    s.pop("custom_entity_types", None)
    s.pop("custom_entity_attributes", None)
    tenant.settings = s

    attributes.flag_modified(tenant, "settings")
    await db.commit()

    return {
        "success": True,
        "message": "Graph extraction settings updated successfully",
        "entity_types": s["entity_types"],
        "entity_attributes": s["entity_attributes"],
    }
