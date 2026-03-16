"""
Skill Schemas
Pydantic models for adviser API requests/responses
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime


# ===================================
# BASE SCHEMAS
# ===================================

class AdviserBase(BaseModel):
    """Base adviser fields"""
    name: str
    description: Optional[str] = None
    icon: Optional[str] = "💡"


class SkillResponse(AdviserBase):
    """Response for single adviser"""
    id: int
    type: str  # 'default' or 'custom'
    is_custom: bool

    class Config:
        from_attributes = True


class SkillListResponse(BaseModel):
    """List of available skills"""
    advisers: List[Dict[str, Any]]  # Keep old field name for backward compatibility


# ===================================
# SESSION SCHEMAS
# ===================================

class SkillSessionCreateRequest(BaseModel):
    """Request to create a new session"""
    skill_id: int
    skill_type: str = Field(..., pattern="^(default|custom)$")


class SkillSessionResponse(BaseModel):
    """Response after creating session"""
    session_id: str
    phase: str
    initial_questions: Optional[List[Dict[str, Any]]] = None
    skill_id: Optional[int] = None
    skill_type: Optional[str] = None
    session_name: Optional[str] = None
    created_at: Optional[str] = None
    last_message_at: Optional[str] = None


class SkillSessionAnswersRequest(BaseModel):
    """Submit answers to initial questions"""
    answers: Dict[str, Any]


class SkillSessionChatRequest(BaseModel):
    """Send a refinement message"""
    message: str


class SkillSessionChatResponse(BaseModel):
    """Response to chat message"""
    response: str
    updated_output: Optional[Dict[str, Any]] = None


class SkillSessionEvaluationRequest(BaseModel):
    """Submit session feedback"""
    rating: Optional[int] = Field(None, ge=1, le=5)
    helpful: Optional[bool] = None
    feedback_text: Optional[str] = None


# ===================================
# CUSTOM ADVISER SCHEMAS
# ===================================

class CustomSkillCreate(BaseModel):
    """Create a new custom adviser"""
    source_skill_id: Optional[int] = None  # If cloning from default
    name: str
    description: Optional[str] = None
    icon: Optional[str] = "💡"
    tools: List[str] = []
    initial_questions: List[Dict[str, Any]] = []
    task_definitions: List[str] = []
    instructions: str
    output_template: Optional[str] = None


class CustomSkillUpdate(BaseModel):
    """Update a custom adviser"""
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    tools: Optional[List[str]] = None
    initial_questions: Optional[List[Dict[str, Any]]] = None
    task_definitions: Optional[List[str]] = None
    instructions: Optional[str] = None
    output_template: Optional[str] = None
    is_active: Optional[bool] = None


class CustomSkillResponse(BaseModel):
    """Custom adviser response"""
    id: int
    name: str
    description: Optional[str]
    icon: Optional[str]
    source_skill_id: Optional[int]
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


# ===================================
# TOOL SCHEMAS
# ===================================

class ToolDefinition(BaseModel):
    """Tool definition for adviser configuration"""
    name: str
    description: str
    parameters: List[Dict[str, Any]]


class ToolListResponse(BaseModel):
    """List of available tools"""
    tools: List[ToolDefinition]


# Backward compatibility aliases
AdviserResponse = SkillResponse
AdviserListResponse = SkillListResponse
SessionCreateRequest = SkillSessionCreateRequest
SessionResponse = SkillSessionResponse
SessionAnswersRequest = SkillSessionAnswersRequest
SessionChatRequest = SkillSessionChatRequest
SessionChatResponse = SkillSessionChatResponse
SessionEvaluationRequest = SkillSessionEvaluationRequest
CustomAdviserCreate = CustomSkillCreate
CustomAdviserUpdate = CustomSkillUpdate
CustomAdviserResponse = CustomSkillResponse

# Export
__all__ = [
    # New names
    'SkillResponse',
    'SkillListResponse',
    'SkillSessionCreateRequest',
    'SkillSessionResponse',
    'SkillSessionAnswersRequest',
    'SkillSessionChatRequest',
    'SkillSessionChatResponse',
    'SkillSessionEvaluationRequest',
    'CustomSkillCreate',
    'CustomSkillUpdate',
    'CustomSkillResponse',
    'ToolDefinition',
    'ToolListResponse',
    # Backward compatibility (old names)
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
]
