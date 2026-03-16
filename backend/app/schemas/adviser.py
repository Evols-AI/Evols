"""
Adviser Schemas - DEPRECATED
This file is kept for backward compatibility.
All adviser schemas have been renamed to skill schemas.
Import from app.schemas.skill or app.schemas instead.
"""

# Import all from skill module with old names
from app.schemas.skill import (
    # New skill classes aliased to old adviser names
    SkillResponse as AdviserResponse,
    SkillListResponse as AdviserListResponse,
    SkillSessionCreateRequest as SessionCreateRequest,
    SkillSessionResponse as SessionResponse,
    SkillSessionAnswersRequest as SessionAnswersRequest,
    SkillSessionChatRequest as SessionChatRequest,
    SkillSessionChatResponse as SessionChatResponse,
    SkillSessionEvaluationRequest as SessionEvaluationRequest,
    CustomSkillCreate as CustomAdviserCreate,
    CustomSkillUpdate as CustomAdviserUpdate,
    CustomSkillResponse as CustomAdviserResponse,
    ToolDefinition,
    ToolListResponse,
)

__all__ = [
    'AdviserResponse',
    'AdviserListResponse',
    'SessionCreateRequest',
    'SessionResponse',
    'SessionAnswersRequest',
    'SessionChatRequest',
    'SessionChatResponse',
    'SessionEvaluationRequest',
    'CustomAdviserCreate',
    'CustomAdviserUpdate',
    'CustomAdviserResponse',
    'ToolDefinition',
    'ToolListResponse',
]
