"""
Skill Customization API Endpoints
Allows users to customize skill instructions and context
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.user_skill_customization import UserSkillCustomization
from app.services.skill_loader_service import get_skill_loader

router = APIRouter()


# Request/Response Models
class SkillCustomizationCreate(BaseModel):
    skill_name: str
    custom_instructions: Optional[str] = None
    custom_context: Optional[str] = None
    output_format_preferences: Optional[str] = None


class SkillCustomizationUpdate(BaseModel):
    custom_instructions: Optional[str] = None
    custom_context: Optional[str] = None
    output_format_preferences: Optional[str] = None
    is_active: Optional[bool] = None


class SkillCustomizationResponse(BaseModel):
    id: int
    skill_name: str
    custom_instructions: Optional[str]
    custom_context: Optional[str]
    output_format_preferences: Optional[str]
    is_active: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class SkillInfo(BaseModel):
    name: str
    description: str
    category: str
    has_customization: bool


@router.get("/available-skills", response_model=List[SkillInfo])
async def list_available_skills(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all available skills with customization status
    """
    skill_loader = get_skill_loader()
    all_skills = skill_loader.load_all_skills()

    # Get user's existing customizations
    result = await db.execute(
        select(UserSkillCustomization.skill_name)
        .where(UserSkillCustomization.user_id == current_user.id)
        .where(UserSkillCustomization.is_active == True)
    )
    customized_skills = {row[0] for row in result.fetchall()}

    skill_infos = []
    for skill_name, skill_data in all_skills.items():
        skill_infos.append(SkillInfo(
            name=skill_name,
            description=skill_data.get('description', ''),
            category=skill_data.get('category', ''),
            has_customization=skill_name in customized_skills
        ))

    # Sort by category, then name
    skill_infos.sort(key=lambda s: (s.category, s.name))
    return skill_infos


@router.get("/", response_model=List[SkillCustomizationResponse])
async def list_customizations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List user's skill customizations
    """
    result = await db.execute(
        select(UserSkillCustomization)
        .where(UserSkillCustomization.user_id == current_user.id)
        .where(UserSkillCustomization.is_active == True)
        .order_by(UserSkillCustomization.skill_name)
    )
    customizations = result.scalars().all()

    return [
        SkillCustomizationResponse(
            id=c.id,
            skill_name=c.skill_name,
            custom_instructions=c.custom_instructions,
            custom_context=c.custom_context,
            output_format_preferences=c.output_format_preferences,
            is_active=c.is_active,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat()
        ) for c in customizations
    ]


@router.get("/{skill_name}", response_model=Optional[SkillCustomizationResponse])
async def get_skill_customization(
    skill_name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get customization for a specific skill
    """
    result = await db.execute(
        select(UserSkillCustomization)
        .where(UserSkillCustomization.user_id == current_user.id)
        .where(UserSkillCustomization.skill_name == skill_name)
        .where(UserSkillCustomization.is_active == True)
    )
    customization = result.scalar_one_or_none()

    if not customization:
        return None

    return SkillCustomizationResponse(
        id=customization.id,
        skill_name=customization.skill_name,
        custom_instructions=customization.custom_instructions,
        custom_context=customization.custom_context,
        output_format_preferences=customization.output_format_preferences,
        is_active=customization.is_active,
        created_at=customization.created_at.isoformat(),
        updated_at=customization.updated_at.isoformat()
    )


@router.post("/", response_model=SkillCustomizationResponse, status_code=status.HTTP_201_CREATED)
async def create_skill_customization(
    data: SkillCustomizationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create or update skill customization
    """
    # Validate skill exists
    skill_loader = get_skill_loader()
    if not skill_loader.get_skill_by_name(data.skill_name):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill '{data.skill_name}' not found"
        )

    # Check if customization already exists
    result = await db.execute(
        select(UserSkillCustomization)
        .where(UserSkillCustomization.user_id == current_user.id)
        .where(UserSkillCustomization.skill_name == data.skill_name)
        .where(UserSkillCustomization.is_active == True)
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Update existing
        existing.custom_instructions = data.custom_instructions
        existing.custom_context = data.custom_context
        existing.output_format_preferences = data.output_format_preferences
        await db.commit()
        await db.refresh(existing)
        customization = existing
    else:
        # Create new
        customization = UserSkillCustomization(
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            skill_name=data.skill_name,
            custom_instructions=data.custom_instructions,
            custom_context=data.custom_context,
            output_format_preferences=data.output_format_preferences
        )
        db.add(customization)
        await db.commit()
        await db.refresh(customization)

    return SkillCustomizationResponse(
        id=customization.id,
        skill_name=customization.skill_name,
        custom_instructions=customization.custom_instructions,
        custom_context=customization.custom_context,
        output_format_preferences=customization.output_format_preferences,
        is_active=customization.is_active,
        created_at=customization.created_at.isoformat(),
        updated_at=customization.updated_at.isoformat()
    )


@router.put("/{skill_name}", response_model=SkillCustomizationResponse)
async def update_skill_customization(
    skill_name: str,
    data: SkillCustomizationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update existing skill customization
    """
    result = await db.execute(
        select(UserSkillCustomization)
        .where(UserSkillCustomization.user_id == current_user.id)
        .where(UserSkillCustomization.skill_name == skill_name)
        .where(UserSkillCustomization.is_active == True)
    )
    customization = result.scalar_one_or_none()

    if not customization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No customization found for skill '{skill_name}'"
        )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customization, field, value)

    await db.commit()
    await db.refresh(customization)

    return SkillCustomizationResponse(
        id=customization.id,
        skill_name=customization.skill_name,
        custom_instructions=customization.custom_instructions,
        custom_context=customization.custom_context,
        output_format_preferences=customization.output_format_preferences,
        is_active=customization.is_active,
        created_at=customization.created_at.isoformat(),
        updated_at=customization.updated_at.isoformat()
    )


@router.delete("/{skill_name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill_customization(
    skill_name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete skill customization (revert to default)
    """
    result = await db.execute(
        select(UserSkillCustomization)
        .where(UserSkillCustomization.user_id == current_user.id)
        .where(UserSkillCustomization.skill_name == skill_name)
        .where(UserSkillCustomization.is_active == True)
    )
    customization = result.scalar_one_or_none()

    if not customization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No customization found for skill '{skill_name}'"
        )

    # Soft delete - set is_active to False
    customization.is_active = False
    await db.commit()


@router.post("/{skill_name}/preview")
async def preview_skill_customization(
    skill_name: str,
    data: SkillCustomizationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Preview what the skill would look like with customizations applied
    """
    # Validate skill exists
    skill_loader = get_skill_loader()
    skill_data = skill_loader.get_skill_by_name(skill_name)
    if not skill_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill '{skill_name}' not found"
        )

    # Simulate the merged instructions
    base_instructions = skill_data.get('instructions', skill_data.get('content', ''))

    # Create temporary customizations dict for merging
    customizations = {
        'custom_context': data.custom_context,
        'custom_instructions': data.custom_instructions,
        'output_format_preferences': data.output_format_preferences
    }

    # Use the same merge logic as context aggregator
    from app.services.context_aggregator import ContextAggregator
    aggregator = ContextAggregator(db, current_user)
    merged_instructions = aggregator._merge_instructions(base_instructions, customizations)

    return {
        'skill_name': skill_name,
        'base_instructions': base_instructions,
        'merged_instructions': merged_instructions,
        'customizations_applied': customizations
    }