"""
Work Context Models
Personal PM context - role, team, projects, relationships, capacity
"""

from sqlalchemy import Column, String, Integer, ForeignKey, Text, JSON, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from enum import Enum
from datetime import datetime

from app.models.base import BaseModel


class CapacityStatus(str, Enum):
    """PM capacity status"""
    SUSTAINABLE = "sustainable"
    STRETCHED = "stretched"
    OVERLOADED = "overloaded"
    UNSUSTAINABLE = "unsustainable"


class ProjectStatus(str, Enum):
    """Project status (RAG)"""
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"
    COMPLETED = "completed"
    PAUSED = "paused"


class ProjectRole(str, Enum):
    """PM's role in project"""
    OWNER = "owner"
    CONTRIBUTOR = "contributor"
    ADVISOR = "advisor"


class TaskPriority(str, Enum):
    """Task priority tiers"""
    CRITICAL = "critical"  # 🔴 Critical Today
    HIGH_LEVERAGE = "high_leverage"  # 🟡 High Leverage
    STAKEHOLDER = "stakeholder"  # 🔵 Stakeholder/Relationship
    SWEEP = "sweep"  # ⚪ Sweep Queue
    BACKLOG = "backlog"  # 🟣 Backlog


class TaskStatus(str, Enum):
    """Task status"""
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    DROPPED = "dropped"
    DELEGATED = "delegated"


class DecisionCategory(str, Enum):
    """Decision category"""
    PRODUCT = "product"
    TECHNICAL = "technical"
    ORGANIZATIONAL = "organizational"
    CAREER = "career"
    PROCESS = "process"
    STAKEHOLDER = "stakeholder"


class MeetingType(str, Enum):
    """Meeting type"""
    ONE_ON_ONE_MANAGER = "one_on_one_manager"
    ONE_ON_ONE_PEER = "one_on_one_peer"
    ONE_ON_ONE_DIRECT_REPORT = "one_on_one_direct_report"
    TEAM_SYNC = "team_sync"
    STAKEHOLDER = "stakeholder"
    PLANNING = "planning"
    REVIEW = "review"
    OTHER = "other"


# ===================================
# WORK CONTEXT
# ===================================

class WorkContext(BaseModel):
    """
    Personal PM work context - role, team, manager, capacity
    One per user
    """
    __tablename__ = "work_context"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Role & Position
    title = Column(String(255), nullable=True)
    team = Column(String(255), nullable=True)
    team_description = Column(Text, nullable=True)
    manager_name = Column(String(255), nullable=True)
    manager_title = Column(String(255), nullable=True)
    team_size = Column(Integer, nullable=True)
    team_composition = Column(Text, nullable=True)  # e.g., "5 engineers, 2 designers, 3 PMs"
    recent_changes = Column(Text, nullable=True)  # Reorgs, layoffs, team changes

    # Working Model
    working_hours = Column(String(255), nullable=True)  # e.g., "9am-6pm PT"
    communication_style = Column(Text, nullable=True)
    biggest_time_sink = Column(Text, nullable=True)
    protected_time = Column(Text, nullable=True)

    # Capacity
    capacity_status = Column(SQLEnum(CapacityStatus), nullable=True)
    capacity_factors = Column(Text, nullable=True)

    # Signals & Landscape
    signals = Column(JSON, nullable=True)  # Array of signals affecting priorities

    # Career Narrative
    career_story = Column(Text, nullable=True)  # Story you want leadership to tell
    impact_moments = Column(JSON, nullable=True)  # Array of key impact moments

    # Relationships
    user = relationship("User", back_populates="work_context")
    active_projects = relationship("ActiveProject", back_populates="work_context", cascade="all, delete-orphan")
    relationships = relationship("KeyRelationship", back_populates="work_context", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<WorkContext(user_id={self.user_id}, title='{self.title}')>"


class ActiveProject(BaseModel):
    """
    Active projects for a PM
    """
    __tablename__ = "active_projects"

    work_context_id = Column(Integer, ForeignKey("work_context.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    status = Column(SQLEnum(ProjectStatus), nullable=False, default=ProjectStatus.GREEN)
    next_milestone = Column(String(500), nullable=True)
    next_milestone_date = Column(DateTime, nullable=True)
    role = Column(SQLEnum(ProjectRole), nullable=False)
    key_stakeholders = Column(JSON, nullable=True)  # Array of stakeholder names
    notes = Column(Text, nullable=True)

    # Relationships
    work_context = relationship("WorkContext", back_populates="active_projects")
    user = relationship("User")

    def __repr__(self):
        return f"<ActiveProject(name='{self.name}', status='{self.status}')>"


class KeyRelationship(BaseModel):
    """
    Key stakeholders and relationships for a PM
    """
    __tablename__ = "key_relationships"

    work_context_id = Column(Integer, ForeignKey("work_context.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    role = Column(String(255), nullable=True)
    relationship_type = Column(String(50), nullable=True)  # manager, peer, stakeholder, direct_report
    cares_about = Column(Text, nullable=True)
    current_dynamic = Column(Text, nullable=True)
    communication_preference = Column(Text, nullable=True)
    investment_needed = Column(Text, nullable=True)  # Relationship building actions

    # Relationships
    work_context = relationship("WorkContext", back_populates="relationships")
    user = relationship("User")

    def __repr__(self):
        return f"<KeyRelationship(name='{self.name}', type='{self.relationship_type}')>"


# ===================================
# DECISION LOG
# ===================================

class PMDecision(BaseModel):
    """
    PM Decision log - track personal PM decisions with full context
    Separate from Decision (decision briefs in decision workbench)
    """
    __tablename__ = "pm_decisions"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=True, index=True)

    decision_number = Column(Integer, nullable=False)  # Sequential per user
    title = Column(String(500), nullable=False)
    category = Column(SQLEnum(DecisionCategory), nullable=False)

    context = Column(Text, nullable=False)  # What prompted this decision
    options_considered = Column(JSON, nullable=False)  # Array of {option, pros, cons}
    decision = Column(Text, nullable=False)  # What was decided
    reasoning = Column(Text, nullable=False)  # Why this option
    tradeoffs = Column(Text, nullable=True)  # What we're giving up
    stakeholders = Column(JSON, nullable=True)  # Array of stakeholder names
    expected_outcome = Column(Text, nullable=True)
    actual_outcome = Column(Text, nullable=True)  # Filled in during review
    lessons = Column(Text, nullable=True)  # Filled in during review

    decision_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    review_date = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="decisions")
    product = relationship("Product")

    def __repr__(self):
        return f"<PMDecision(number={self.decision_number}, title='{self.title}')>"


# ===================================
# TASK BOARD
# ===================================

class Task(BaseModel):
    """
    PM task board with priority tiers
    """
    __tablename__ = "tasks"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=True, index=True)

    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(SQLEnum(TaskPriority), nullable=False)
    status = Column(SQLEnum(TaskStatus), nullable=False, default=TaskStatus.TODO)

    # Context
    deadline = Column(DateTime, nullable=True)
    why_critical = Column(Text, nullable=True)  # For CRITICAL tasks
    impact = Column(Text, nullable=True)  # For HIGH_LEVERAGE tasks
    stakeholder_name = Column(String(255), nullable=True)  # For STAKEHOLDER tasks
    stakeholder_reason = Column(Text, nullable=True)  # Why it matters
    source = Column(String(255), nullable=True)  # Where did this come from
    notes = Column(Text, nullable=True)

    # Completion
    completed_at = Column(DateTime, nullable=True)
    outcome = Column(Text, nullable=True)  # What happened (for completed/dropped tasks)

    # Relationships
    user = relationship("User", back_populates="tasks")
    product = relationship("Product")

    def __repr__(self):
        return f"<Task(title='{self.title}', priority='{self.priority}', status='{self.status}')>"


class WeeklyFocus(BaseModel):
    """
    Three Things That Matter This Week
    """
    __tablename__ = "weekly_focus"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    week_start_date = Column(DateTime, nullable=False)  # Monday of the week
    focus_1 = Column(String(500), nullable=True)
    focus_2 = Column(String(500), nullable=True)
    focus_3 = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    user = relationship("User")

    def __repr__(self):
        return f"<WeeklyFocus(user_id={self.user_id}, week={self.week_start_date})>"


# ===================================
# MEETING NOTES
# ===================================

class MeetingNote(BaseModel):
    """
    Meeting notes and prep
    """
    __tablename__ = "meeting_notes"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(500), nullable=False)
    meeting_type = Column(SQLEnum(MeetingType), nullable=False)
    meeting_date = Column(DateTime, nullable=False)
    attendees = Column(JSON, nullable=True)  # Array of attendee names

    # Prep (filled before meeting)
    prep_notes = Column(Text, nullable=True)
    agenda = Column(JSON, nullable=True)  # Array of agenda items
    discussion_topics = Column(JSON, nullable=True)  # Array of topics to discuss

    # Notes (filled during/after meeting)
    notes = Column(Text, nullable=True)
    action_items = Column(JSON, nullable=True)  # Array of {action, owner, deadline}
    decisions = Column(JSON, nullable=True)  # Array of decisions made
    follow_ups = Column(JSON, nullable=True)  # Array of follow-up items

    # Relationships
    user = relationship("User", back_populates="meeting_notes")

    def __repr__(self):
        return f"<MeetingNote(title='{self.title}', date={self.meeting_date})>"
