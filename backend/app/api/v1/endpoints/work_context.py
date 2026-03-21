"""
Work Context API Endpoints
Personal PM context - role, team, projects, relationships, capacity
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.work_context import (
    WorkContext, ActiveProject, KeyRelationship,
    PMDecision, Task, WeeklyFocus, MeetingNote,
    TaskPriority, TaskStatus
)
from app.schemas.work_context import (
    WorkContextCreate, WorkContextUpdate, WorkContextResponse,
    ActiveProjectCreate, ActiveProjectUpdate, ActiveProjectResponse,
    KeyRelationshipCreate, KeyRelationshipUpdate, KeyRelationshipResponse,
    PMDecisionCreate, PMDecisionUpdate, PMDecisionResponse,
    TaskCreate, TaskUpdate, TaskResponse,
    WeeklyFocusCreate, WeeklyFocusUpdate, WeeklyFocusResponse,
    MeetingNoteCreate, MeetingNoteUpdate, MeetingNoteResponse
)

router = APIRouter()


# ===================================
# WORK CONTEXT
# ===================================

@router.get("/work-context", response_model=WorkContextResponse)
async def get_work_context(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's work context (creates empty one if doesn't exist)"""
    result = await db.execute(
        select(WorkContext).filter(WorkContext.user_id == current_user.id)
    )
    work_context = result.scalar_one_or_none()

    if not work_context:
        # Create empty work context
        work_context = WorkContext(user_id=current_user.id)
        db.add(work_context)
        await db.commit()
        await db.refresh(work_context)

    return work_context


@router.put("/work-context", response_model=WorkContextResponse)
async def update_work_context(
    data: WorkContextUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update user's work context"""
    result = await db.execute(
        select(WorkContext).filter(WorkContext.user_id == current_user.id)
    )
    work_context = result.scalar_one_or_none()

    if not work_context:
        # Create new work context
        work_context = WorkContext(user_id=current_user.id)
        db.add(work_context)

    # Update fields
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(work_context, field, value)

    await db.commit()
    await db.refresh(work_context)
    return work_context


# ===================================
# ACTIVE PROJECTS
# ===================================

@router.get("/active-projects", response_model=List[ActiveProjectResponse])
async def get_active_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all active projects for user"""
    result = await db.execute(
        select(ActiveProject)
        .filter(ActiveProject.user_id == current_user.id)
        .order_by(ActiveProject.created_at.desc())
    )
    projects = result.scalars().all()
    return projects


@router.post("/active-projects", response_model=ActiveProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_active_project(
    data: ActiveProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new active project"""
    # Ensure work context exists
    result = await db.execute(
        select(WorkContext).filter(WorkContext.user_id == current_user.id)
    )
    work_context = result.scalar_one_or_none()

    if not work_context:
        work_context = WorkContext(user_id=current_user.id)
        db.add(work_context)
        await db.commit()
        await db.refresh(work_context)

    project = ActiveProject(
        **data.model_dump(),
        work_context_id=work_context.id,
        user_id=current_user.id
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.put("/active-projects/{project_id}", response_model=ActiveProjectResponse)
async def update_active_project(
    project_id: int,
    data: ActiveProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update active project"""
    result = await db.execute(
        select(ActiveProject).filter(
            ActiveProject.id == project_id,
            ActiveProject.user_id == current_user.id
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/active-projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_active_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete active project"""
    result = await db.execute(
        select(ActiveProject).filter(
            ActiveProject.id == project_id,
            ActiveProject.user_id == current_user.id
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.delete(project)
    await db.commit()
    return None


# ===================================
# KEY RELATIONSHIPS
# ===================================

@router.get("/key-relationships", response_model=List[KeyRelationshipResponse])
async def get_key_relationships(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all key relationships for user"""
    result = await db.execute(
        select(KeyRelationship)
        .filter(KeyRelationship.user_id == current_user.id)
        .order_by(KeyRelationship.created_at.desc())
    )
    relationships = result.scalars().all()
    return relationships


@router.post("/key-relationships", response_model=KeyRelationshipResponse, status_code=status.HTTP_201_CREATED)
async def create_key_relationship(
    data: KeyRelationshipCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new key relationship"""
    # Ensure work context exists
    result = await db.execute(
        select(WorkContext).filter(WorkContext.user_id == current_user.id)
    )
    work_context = result.scalar_one_or_none()

    if not work_context:
        work_context = WorkContext(user_id=current_user.id)
        db.add(work_context)
        await db.commit()
        await db.refresh(work_context)

    relationship = KeyRelationship(
        **data.model_dump(),
        work_context_id=work_context.id,
        user_id=current_user.id
    )
    db.add(relationship)
    await db.commit()
    await db.refresh(relationship)
    return relationship


@router.put("/key-relationships/{relationship_id}", response_model=KeyRelationshipResponse)
async def update_key_relationship(
    relationship_id: int,
    data: KeyRelationshipUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update key relationship"""
    result = await db.execute(
        select(KeyRelationship).filter(
            KeyRelationship.id == relationship_id,
            KeyRelationship.user_id == current_user.id
        )
    )
    relationship = result.scalar_one_or_none()

    if not relationship:
        raise HTTPException(status_code=404, detail="Relationship not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(relationship, field, value)

    await db.commit()
    await db.refresh(relationship)
    return relationship


@router.delete("/key-relationships/{relationship_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_key_relationship(
    relationship_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete key relationship"""
    result = await db.execute(
        select(KeyRelationship).filter(
            KeyRelationship.id == relationship_id,
            KeyRelationship.user_id == current_user.id
        )
    )
    relationship = result.scalar_one_or_none()

    if not relationship:
        raise HTTPException(status_code=404, detail="Relationship not found")

    await db.delete(relationship)
    await db.commit()
    return None


# ===================================
# PM DECISIONS
# ===================================

@router.get("/pm-decisions", response_model=List[PMDecisionResponse])
async def get_pm_decisions(
    product_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all PM decisions for user (optionally filtered by product)"""
    stmt = select(PMDecision).filter(PMDecision.user_id == current_user.id)

    if product_id is not None:
        stmt = stmt.filter(PMDecision.product_id == product_id)

    stmt = stmt.order_by(PMDecision.decision_date.desc())
    result = await db.execute(stmt)
    decisions = result.scalars().all()
    return decisions


@router.get("/pm-decisions/{decision_id}", response_model=PMDecisionResponse)
async def get_pm_decision(
    decision_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific PM decision"""
    result = await db.execute(
        select(PMDecision).filter(
            PMDecision.id == decision_id,
            PMDecision.user_id == current_user.id
        )
    )
    decision = result.scalar_one_or_none()

    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    return decision


@router.post("/pm-decisions", response_model=PMDecisionResponse, status_code=status.HTTP_201_CREATED)
async def create_pm_decision(
    data: PMDecisionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new PM decision"""
    # Get next decision number for user
    result = await db.execute(
        select(PMDecision)
        .filter(PMDecision.user_id == current_user.id)
        .order_by(PMDecision.decision_number.desc())
    )
    last_decision = result.scalar_one_or_none()

    next_number = 1 if not last_decision else last_decision.decision_number + 1

    decision = PMDecision(
        **data.model_dump(),
        user_id=current_user.id,
        decision_number=next_number
    )
    db.add(decision)
    await db.commit()
    await db.refresh(decision)
    return decision


@router.put("/pm-decisions/{decision_id}", response_model=PMDecisionResponse)
async def update_pm_decision(
    decision_id: int,
    data: PMDecisionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update PM decision"""
    result = await db.execute(
        select(PMDecision).filter(
            PMDecision.id == decision_id,
            PMDecision.user_id == current_user.id
        )
    )
    decision = result.scalar_one_or_none()

    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(decision, field, value)

    await db.commit()
    await db.refresh(decision)
    return decision


@router.delete("/pm-decisions/{decision_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pm_decision(
    decision_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete PM decision"""
    result = await db.execute(
        select(PMDecision).filter(
            PMDecision.id == decision_id,
            PMDecision.user_id == current_user.id
        )
    )
    decision = result.scalar_one_or_none()

    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    await db.delete(decision)
    await db.commit()
    return None


# ===================================
# TASKS
# ===================================

@router.get("/tasks", response_model=List[TaskResponse])
async def get_tasks(
    priority: Optional[TaskPriority] = None,
    status: Optional[TaskStatus] = None,
    product_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all tasks for user (filterable by priority, status, product)"""
    stmt = select(Task).filter(Task.user_id == current_user.id)

    if priority is not None:
        stmt = stmt.filter(Task.priority == priority)

    if status is not None:
        stmt = stmt.filter(Task.status == status)

    if product_id is not None:
        stmt = stmt.filter(Task.product_id == product_id)

    # Order: incomplete tasks first (by priority), then completed tasks
    stmt = stmt.order_by(
        (Task.status == TaskStatus.COMPLETED),
        Task.priority,
        Task.created_at.desc()
    )
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    return tasks


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific task"""
    result = await db.execute(
        select(Task).filter(
            Task.id == task_id,
            Task.user_id == current_user.id
        )
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return task


@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new task"""
    task = Task(
        **data.model_dump(),
        user_id=current_user.id
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    data: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update task"""
    result = await db.execute(
        select(Task).filter(
            Task.id == task_id,
            Task.user_id == current_user.id
        )
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = data.model_dump(exclude_unset=True)

    # Auto-set completed_at when status changes to COMPLETED
    if 'status' in update_data and update_data['status'] == TaskStatus.COMPLETED and task.status != TaskStatus.COMPLETED:
        task.completed_at = datetime.utcnow()

    for field, value in update_data.items():
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete task"""
    result = await db.execute(
        select(Task).filter(
            Task.id == task_id,
            Task.user_id == current_user.id
        )
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(task)
    await db.commit()
    return None


# ===================================
# WEEKLY FOCUS
# ===================================

@router.get("/weekly-focus", response_model=List[WeeklyFocusResponse])
async def get_weekly_focus_list(
    limit: int = Query(default=10, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get recent weekly focus entries"""
    result = await db.execute(
        select(WeeklyFocus)
        .filter(WeeklyFocus.user_id == current_user.id)
        .order_by(WeeklyFocus.week_start_date.desc())
        .limit(limit)
    )
    focuses = result.scalars().all()
    return focuses


@router.get("/weekly-focus/current", response_model=WeeklyFocusResponse)
async def get_current_weekly_focus(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get this week's focus (creates empty one if doesn't exist)"""
    # Get Monday of current week
    today = datetime.utcnow().date()
    days_since_monday = today.weekday()
    week_start = today - timedelta(days=days_since_monday)
    week_start_datetime = datetime.combine(week_start, datetime.min.time())

    result = await db.execute(
        select(WeeklyFocus).filter(
            WeeklyFocus.user_id == current_user.id,
            WeeklyFocus.week_start_date == week_start_datetime
        )
    )
    focus = result.scalar_one_or_none()

    if not focus:
        focus = WeeklyFocus(
            user_id=current_user.id,
            week_start_date=week_start_datetime
        )
        db.add(focus)
        await db.commit()
        await db.refresh(focus)

    return focus


@router.put("/weekly-focus/{focus_id}", response_model=WeeklyFocusResponse)
async def update_weekly_focus(
    focus_id: int,
    data: WeeklyFocusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update weekly focus"""
    result = await db.execute(
        select(WeeklyFocus).filter(
            WeeklyFocus.id == focus_id,
            WeeklyFocus.user_id == current_user.id
        )
    )
    focus = result.scalar_one_or_none()

    if not focus:
        raise HTTPException(status_code=404, detail="Weekly focus not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(focus, field, value)

    await db.commit()
    await db.refresh(focus)
    return focus


# ===================================
# MEETING NOTES
# ===================================

@router.get("/meeting-notes", response_model=List[MeetingNoteResponse])
async def get_meeting_notes(
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get meeting notes for user"""
    result = await db.execute(
        select(MeetingNote)
        .filter(MeetingNote.user_id == current_user.id)
        .order_by(MeetingNote.meeting_date.desc())
        .limit(limit)
    )
    notes = result.scalars().all()
    return notes


@router.get("/meeting-notes/{note_id}", response_model=MeetingNoteResponse)
async def get_meeting_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific meeting note"""
    result = await db.execute(
        select(MeetingNote).filter(
            MeetingNote.id == note_id,
            MeetingNote.user_id == current_user.id
        )
    )
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(status_code=404, detail="Meeting note not found")

    return note


@router.post("/meeting-notes", response_model=MeetingNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting_note(
    data: MeetingNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new meeting note"""
    note = MeetingNote(
        **data.model_dump(),
        user_id=current_user.id
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


@router.put("/meeting-notes/{note_id}", response_model=MeetingNoteResponse)
async def update_meeting_note(
    note_id: int,
    data: MeetingNoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update meeting note"""
    result = await db.execute(
        select(MeetingNote).filter(
            MeetingNote.id == note_id,
            MeetingNote.user_id == current_user.id
        )
    )
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(status_code=404, detail="Meeting note not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(note, field, value)

    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/meeting-notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete meeting note"""
    result = await db.execute(
        select(MeetingNote).filter(
            MeetingNote.id == note_id,
            MeetingNote.user_id == current_user.id
        )
    )
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(status_code=404, detail="Meeting note not found")

    await db.delete(note)
    await db.commit()
    return None
