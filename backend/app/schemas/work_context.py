"""
Work Context Schemas
Pydantic schemas for personal PM context
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.work_context import (
    CapacityStatus, ProjectStatus, ProjectRole,
    TaskPriority, TaskStatus, DecisionCategory, MeetingType
)


# ===================================
# WORK CONTEXT
# ===================================

class WorkContextBase(BaseModel):
    title: Optional[str] = None
    team: Optional[str] = None
    team_description: Optional[str] = None
    manager_name: Optional[str] = None
    manager_title: Optional[str] = None
    team_size: Optional[int] = None
    team_composition: Optional[str] = None
    recent_changes: Optional[str] = None
    working_hours: Optional[str] = None
    communication_style: Optional[str] = None
    biggest_time_sink: Optional[str] = None
    protected_time: Optional[str] = None
    capacity_status: Optional[CapacityStatus] = None
    capacity_factors: Optional[str] = None
    signals: Optional[List[str]] = None
    career_story: Optional[str] = None
    impact_moments: Optional[List[dict]] = None


class WorkContextCreate(WorkContextBase):
    pass


class WorkContextUpdate(WorkContextBase):
    pass


class WorkContextResponse(WorkContextBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===================================
# ACTIVE PROJECT
# ===================================

class ActiveProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    status: ProjectStatus
    next_milestone: Optional[str] = None
    next_milestone_date: Optional[datetime] = None
    role: ProjectRole
    key_stakeholders: Optional[List[str]] = None
    notes: Optional[str] = None


class ActiveProjectCreate(ActiveProjectBase):
    pass


class ActiveProjectUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[ProjectStatus] = None
    next_milestone: Optional[str] = None
    next_milestone_date: Optional[datetime] = None
    role: Optional[ProjectRole] = None
    key_stakeholders: Optional[List[str]] = None
    notes: Optional[str] = None


class ActiveProjectResponse(ActiveProjectBase):
    id: int
    work_context_id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===================================
# KEY RELATIONSHIP
# ===================================

class KeyRelationshipBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    role: Optional[str] = None
    relationship_type: Optional[str] = None
    cares_about: Optional[str] = None
    current_dynamic: Optional[str] = None
    communication_preference: Optional[str] = None
    investment_needed: Optional[str] = None


class KeyRelationshipCreate(KeyRelationshipBase):
    pass


class KeyRelationshipUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    relationship_type: Optional[str] = None
    cares_about: Optional[str] = None
    current_dynamic: Optional[str] = None
    communication_preference: Optional[str] = None
    investment_needed: Optional[str] = None


class KeyRelationshipResponse(KeyRelationshipBase):
    id: int
    work_context_id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===================================
# PM DECISION
# ===================================

class PMDecisionBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    category: DecisionCategory
    context: str
    options_considered: List[dict]  # [{option, pros, cons}]
    decision: str
    reasoning: str
    tradeoffs: Optional[str] = None
    stakeholders: Optional[List[str]] = None
    expected_outcome: Optional[str] = None
    product_id: Optional[int] = None


class PMDecisionCreate(PMDecisionBase):
    pass


class PMDecisionUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[DecisionCategory] = None
    context: Optional[str] = None
    options_considered: Optional[List[dict]] = None
    decision: Optional[str] = None
    reasoning: Optional[str] = None
    tradeoffs: Optional[str] = None
    stakeholders: Optional[List[str]] = None
    expected_outcome: Optional[str] = None
    actual_outcome: Optional[str] = None
    lessons: Optional[str] = None


class PMDecisionResponse(PMDecisionBase):
    id: int
    user_id: int
    decision_number: int
    decision_date: datetime
    actual_outcome: Optional[str] = None
    lessons: Optional[str] = None
    review_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===================================
# TASK
# ===================================

class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    priority: TaskPriority
    status: TaskStatus = TaskStatus.TODO
    deadline: Optional[datetime] = None
    why_critical: Optional[str] = None
    impact: Optional[str] = None
    stakeholder_name: Optional[str] = None
    stakeholder_reason: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    product_id: Optional[int] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    deadline: Optional[datetime] = None
    why_critical: Optional[str] = None
    impact: Optional[str] = None
    stakeholder_name: Optional[str] = None
    stakeholder_reason: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    outcome: Optional[str] = None


class TaskResponse(TaskBase):
    id: int
    user_id: int
    completed_at: Optional[datetime] = None
    outcome: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===================================
# WEEKLY FOCUS
# ===================================

class WeeklyFocusBase(BaseModel):
    week_start_date: datetime
    focus_1: Optional[str] = None
    focus_2: Optional[str] = None
    focus_3: Optional[str] = None
    notes: Optional[str] = None


class WeeklyFocusCreate(WeeklyFocusBase):
    pass


class WeeklyFocusUpdate(BaseModel):
    focus_1: Optional[str] = None
    focus_2: Optional[str] = None
    focus_3: Optional[str] = None
    notes: Optional[str] = None


class WeeklyFocusResponse(WeeklyFocusBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===================================
# MEETING NOTE
# ===================================

class MeetingNoteBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    meeting_type: MeetingType
    meeting_date: datetime
    attendees: Optional[List[str]] = None
    prep_notes: Optional[str] = None
    agenda: Optional[List[str]] = None
    discussion_topics: Optional[List[str]] = None
    notes: Optional[str] = None
    action_items: Optional[List[dict]] = None  # [{action, owner, deadline}]
    decisions: Optional[List[str]] = None
    follow_ups: Optional[List[str]] = None


class MeetingNoteCreate(MeetingNoteBase):
    pass


class MeetingNoteUpdate(BaseModel):
    title: Optional[str] = None
    meeting_type: Optional[MeetingType] = None
    meeting_date: Optional[datetime] = None
    attendees: Optional[List[str]] = None
    prep_notes: Optional[str] = None
    agenda: Optional[List[str]] = None
    discussion_topics: Optional[List[str]] = None
    notes: Optional[str] = None
    action_items: Optional[List[dict]] = None
    decisions: Optional[List[str]] = None
    follow_ups: Optional[List[str]] = None


class MeetingNoteResponse(MeetingNoteBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
