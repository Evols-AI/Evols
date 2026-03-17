"""
Adviser Schemas - DEPRECATED
This file is kept for backward compatibility.
All schema definitions have been moved to skill.py.
Import from app.schemas.skill instead.
"""

# Import all from skill module for backward compatibility
from app.schemas.skill import (
    SkillBase as AdviserBase,
    SkillResponse as AdviserResponse,
    SkillListResponse as AdviserListResponse,
    CustomSkillCreate as CustomAdviserCreate,
    CustomSkillUpdate as CustomAdviserUpdate,
    CustomSkillResponse as CustomAdviserResponse,
)

# Alias for backward compatibility
AdviserDetailResponse = AdviserResponse

__all__ = [
    'AdviserBase',
    'AdviserResponse',
    'AdviserListResponse',
    'AdviserDetailResponse',
    'CustomAdviserCreate',
    'CustomAdviserUpdate',
    'CustomAdviserResponse',
]
