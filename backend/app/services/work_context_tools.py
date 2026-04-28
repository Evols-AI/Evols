"""
Work Context AI Tools
Auto-populate work context from conversations
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.work_context import (
    WorkContext, ActiveProject, KeyRelationship,
    PMDecision, Task, WeeklyFocus, MeetingNote,
    CapacityStatus, ProjectStatus, ProjectRole,
    TaskPriority, TaskStatus, DecisionCategory
)
from app.models.user import User
from app.services.pm_deduplication import PMDeduplicationService


class WorkContextTools:
    """AI tools for managing work context"""

    def __init__(self, db: AsyncSession, user: User):
        self.db = db
        self.user = user
        self.pm_dedup_service = PMDeduplicationService(db)

    async def _get_or_create_work_context(self) -> WorkContext:
        """Get or create work context for user"""
        result = await self.db.execute(
            select(WorkContext).filter(WorkContext.user_id == self.user.id)
        )
        work_context = result.scalar_one_or_none()

        if not work_context:
            work_context = WorkContext(user_id=self.user.id)
            self.db.add(work_context)
            await self.db.commit()
            await self.db.refresh(work_context)

        return work_context

    async def update_role_info(
        self,
        title: Optional[str] = None,
        team: Optional[str] = None,
        team_description: Optional[str] = None,
        manager_name: Optional[str] = None,
        manager_title: Optional[str] = None,
        team_size: Optional[int] = None,
        team_composition: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update role and team information

        Use this when you learn about the user's:
        - Job title or role
        - Team name or structure
        - Manager
        - Team size or composition
        """
        work_context = await self._get_or_create_work_context()

        if title:
            work_context.title = title
        if team:
            work_context.team = team
        if team_description:
            work_context.team_description = team_description
        if manager_name:
            work_context.manager_name = manager_name
        if manager_title:
            work_context.manager_title = manager_title
        if team_size:
            work_context.team_size = team_size
        if team_composition:
            work_context.team_composition = team_composition

        await self.db.commit()

        return {
            "success": True,
            "message": "Updated role and team information",
            "data": {
                "title": work_context.title,
                "team": work_context.team,
                "manager": work_context.manager_name
            }
        }

    async def update_working_model(
        self,
        working_hours: Optional[str] = None,
        communication_style: Optional[str] = None,
        biggest_time_sink: Optional[str] = None,
        protected_time: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update working model and preferences

        Use this when you learn how the user works:
        - Working hours
        - Communication preferences
        - Time management challenges
        """
        work_context = await self._get_or_create_work_context()

        if working_hours:
            work_context.working_hours = working_hours
        if communication_style:
            work_context.communication_style = communication_style
        if biggest_time_sink:
            work_context.biggest_time_sink = biggest_time_sink
        if protected_time:
            work_context.protected_time = protected_time

        await self.db.commit()

        return {
            "success": True,
            "message": "Updated working model"
        }

    async def update_capacity(
        self,
        status: str,
        factors: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update capacity assessment

        Use this when you detect capacity signals:
        - sustainable: Comfortable workload
        - stretched: Working hard but manageable
        - overloaded: Too much on plate
        - unsustainable: Burning out

        Args:
            status: One of: sustainable, stretched, overloaded, unsustainable
            factors: Description of what's driving the capacity state
        """
        work_context = await self._get_or_create_work_context()

        try:
            work_context.capacity_status = CapacityStatus(status)
            if factors:
                work_context.capacity_factors = factors

            await self.db.commit()

            return {
                "success": True,
                "message": f"Updated capacity to {status}",
                "data": {"status": status, "factors": factors}
            }
        except ValueError:
            return {
                "success": False,
                "error": f"Invalid capacity status: {status}. Must be one of: sustainable, stretched, overloaded, unsustainable"
            }

    async def add_or_update_project(
        self,
        name: str,
        status: str,
        role: str,
        next_milestone: Optional[str] = None,
        next_milestone_date: Optional[datetime] = None,
        key_stakeholders: Optional[List[str]] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Add or update an active project

        Use this when you learn about a project the user is working on.

        Args:
            name: Project name
            status: One of: green, yellow, red, completed, paused
            role: One of: owner, contributor, advisor
            next_milestone: Description of next milestone
            next_milestone_date: When next milestone is due
            key_stakeholders: List of stakeholder names
            notes: Additional context
        """
        work_context = await self._get_or_create_work_context()

        # Normalize status to valid enum value - handle complex strings like "In progress (40% complete)"
        from loguru import logger
        original_status = status
        status_lower = status.lower().strip()

        # First check if already valid
        if status_lower in ['green', 'yellow', 'red', 'completed', 'paused']:
            status = status_lower
        else:
            # Extract keywords from complex strings using keyword detection
            # Check for keywords in order of specificity
            if 'block' in status_lower or 'stuck' in status_lower or 'delay' in status_lower or 'red' in status_lower:
                status = 'red'
            elif 'complet' in status_lower or 'done' in status_lower or 'finish' in status_lower:
                status = 'completed'
            elif 'pause' in status_lower or 'hold' in status_lower or 'cancel' in status_lower or 'stop' in status_lower:
                status = 'paused'
            elif 'risk' in status_lower or 'yellow' in status_lower or 'plan' in status_lower:
                status = 'yellow'
            elif 'progress' in status_lower or 'active' in status_lower or 'track' in status_lower or 'health' in status_lower or 'green' in status_lower or 'good' in status_lower:
                status = 'green'
            else:
                # Default unknown statuses to green (assume healthy unless told otherwise)
                status = 'green'

        logger.info(f"[WorkContext.add_or_update_project] Status mapping: '{original_status}' -> '{status}'")

        # Check for duplicate projects using semantic similarity
        candidate = {
            'name': name,
            'status': status,
            'role': role,
            'notes': notes or ''
        }

        duplicates = await self.pm_dedup_service.find_duplicate_projects(candidate, self.user.id)

        try:
            if duplicates:
                # Update most similar existing project
                project, similarity = duplicates[0]
                project.status = ProjectStatus(status)
                project.role = ProjectRole(role)
                if next_milestone:
                    project.next_milestone = next_milestone
                if next_milestone_date:
                    project.next_milestone_date = next_milestone_date
                if key_stakeholders:
                    project.key_stakeholders = key_stakeholders
                if notes:
                    project.notes = notes
                message = f"Updated existing project: {project.name} (matched '{name}' at {similarity:.1%} similarity)"
                logger.info(f"[WorkContext] Updated duplicate project: {project.name} (similarity: {similarity:.2%})")
            else:
                # No duplicates found - create new project
                project = ActiveProject(
                    work_context_id=work_context.id,
                    user_id=self.user.id,
                    name=name,
                    status=ProjectStatus(status),
                    role=ProjectRole(role),
                    next_milestone=next_milestone,
                    next_milestone_date=next_milestone_date,
                    key_stakeholders=key_stakeholders,
                    notes=notes
                )
                self.db.add(project)
                message = f"Added new project: {name}"
                logger.info(f"[WorkContext] Created new project: {name}")

            await self.db.commit()

            return {
                "success": True,
                "message": message,
                "data": {"name": name, "status": status, "role": role}
            }
        except ValueError as e:
            from loguru import logger
            logger.error(f"[WorkContext] Failed to save project '{name}': {str(e)}")
            return {
                "success": False,
                "error": f"Invalid project data: {str(e)}"
            }
        except Exception as e:
            from loguru import logger
            logger.error(f"[WorkContext] Unexpected error saving project '{name}': {str(e)}")
            return {
                "success": False,
                "error": f"Failed to save project: {str(e)}"
            }

    async def add_or_update_relationship(
        self,
        name: str,
        role: Optional[str] = None,
        relationship_type: Optional[str] = None,
        cares_about: Optional[str] = None,
        current_dynamic: Optional[str] = None,
        communication_preference: Optional[str] = None,
        investment_needed: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Add or update a key relationship

        Use this when you learn about an important stakeholder.

        Args:
            name: Person's name
            role: Their job title/role
            relationship_type: manager, peer, stakeholder, direct_report, etc.
            cares_about: What motivates them
            current_dynamic: Current relationship state
            communication_preference: How they prefer to communicate
            investment_needed: Actions to build the relationship
        """
        work_context = await self._get_or_create_work_context()

        # Check for duplicate relationships using semantic similarity
        candidate = {
            'name': name,
            'role': role or '',
            'relationship_type': relationship_type or '',
            'current_dynamic': current_dynamic or ''
        }

        duplicates = await self.pm_dedup_service.find_duplicate_relationships(candidate, self.user.id)

        if duplicates:
            # Update most similar existing relationship
            relationship, similarity = duplicates[0]
            if role:
                relationship.role = role
            if relationship_type:
                relationship.relationship_type = relationship_type
            if cares_about:
                relationship.cares_about = cares_about
            if current_dynamic:
                relationship.current_dynamic = current_dynamic
            if communication_preference:
                relationship.communication_preference = communication_preference
            if investment_needed:
                relationship.investment_needed = investment_needed
            message = f"Updated existing relationship: {relationship.name} (matched '{name}' at {similarity:.1%} similarity)"
            from loguru import logger
            logger.info(f"[WorkContext] Updated duplicate relationship: {relationship.name} (similarity: {similarity:.2%})")
        else:
            # No duplicates found - create new relationship
            relationship = KeyRelationship(
                work_context_id=work_context.id,
                user_id=self.user.id,
                name=name,
                role=role,
                relationship_type=relationship_type,
                cares_about=cares_about,
                current_dynamic=current_dynamic,
                communication_preference=communication_preference,
                investment_needed=investment_needed
            )
            self.db.add(relationship)
            message = f"Added new relationship: {name}"
            from loguru import logger
            logger.info(f"[WorkContext] Created new relationship: {name}")

        await self.db.commit()

        return {
            "success": True,
            "message": message,
            "data": {"name": name, "relationship_type": relationship_type}
        }

    async def add_task(
        self,
        title: str,
        priority: str,
        description: Optional[str] = None,
        deadline: Optional[datetime] = None,
        why_critical: Optional[str] = None,
        impact: Optional[str] = None,
        stakeholder_name: Optional[str] = None,
        stakeholder_reason: Optional[str] = None,
        source: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Add a task to the user's task board

        Use this when action items come up in conversation.

        Args:
            title: Task description (start with verb)
            priority: critical, high_leverage, stakeholder, sweep, backlog
            description: Additional details
            deadline: When it's due
            why_critical: Why critical (for critical tasks)
            impact: Expected impact (for high_leverage tasks)
            stakeholder_name: Who it's for (for stakeholder tasks)
            stakeholder_reason: Why it matters to them
            source: Where this task came from
        """
        try:
            # Check for duplicate tasks using semantic similarity
            candidate = {
                'title': title,
                'priority': priority,
                'description': description or ''
            }

            try:
                duplicates = await self.pm_dedup_service.find_duplicate_tasks(candidate, self.user.id)
            except Exception as dedup_error:
                # If deduplication fails, log error but continue with task creation
                # This prevents losing tasks due to embedding service issues
                from loguru import logger
                logger.warning(f"[WorkContext] Deduplication failed for task '{title}': {dedup_error}. Creating task anyway.")
                duplicates = []

            if duplicates:
                # Similar task already exists - skip creation
                existing_task, similarity = duplicates[0]
                from loguru import logger
                logger.info(f"[WorkContext] Skipped duplicate task: {existing_task.title} (similarity: {similarity:.2%})")
                return {
                    "success": True,
                    "message": f"Similar task already exists: {existing_task.title} (matched '{title}' at {similarity:.1%} similarity)",
                    "data": {"title": existing_task.title, "priority": existing_task.priority.value},
                    "skipped_duplicate": True,
                    "existing_task_id": existing_task.id
                }
            else:
                # No duplicates found - double-check right before creation to prevent race conditions
                final_check = await self.pm_dedup_service.find_duplicate_tasks(candidate, self.user.id)
                if final_check:
                    # Another conversation created this task between our checks
                    existing_task, similarity = final_check[0]
                    from loguru import logger
                    logger.info(f"[WorkContext] Race condition detected - task created by another conversation: {existing_task.title}")
                    return {
                        "success": True,
                        "message": f"Similar task already exists: {existing_task.title} (detected during race condition check)",
                        "data": {"title": existing_task.title, "priority": existing_task.priority.value},
                        "skipped_duplicate": True,
                        "existing_task_id": existing_task.id
                    }

                # Still no duplicates - safe to create
                task = Task(
                    user_id=self.user.id,
                    title=title,
                    priority=TaskPriority(priority),
                    status=TaskStatus.TODO,
                    description=description,
                    deadline=deadline,
                    why_critical=why_critical,
                    impact=impact,
                    stakeholder_name=stakeholder_name,
                    stakeholder_reason=stakeholder_reason,
                    source=source,
                )
                self.db.add(task)
                await self.db.commit()

                from loguru import logger
                logger.info(f"[WorkContext] Created new task: {title}")
                return {
                    "success": True,
                    "message": f"Added new task: {title}",
                    "data": {"title": title, "priority": priority}
                }
        except ValueError as e:
            return {
                "success": False,
                "error": f"Invalid task data: {str(e)}"
            }

    async def update_career_narrative(
        self,
        career_story: Optional[str] = None,
        impact_moments: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Update career narrative and impact moments

        Use this when you learn about:
        - The story the user wants leadership to tell
        - Key impact moments they've delivered
        """
        work_context = await self._get_or_create_work_context()

        if career_story:
            work_context.career_story = career_story
        if impact_moments:
            work_context.impact_moments = impact_moments

        await self.db.commit()

        return {
            "success": True,
            "message": "Updated career narrative"
        }

    async def get_work_context_summary(self) -> Dict[str, Any]:
        """
        Get current work context summary

        Use this to understand what you already know about the user.
        """
        work_context = await self._get_or_create_work_context()

        # Get counts
        projects_result = await self.db.execute(
            select(ActiveProject).filter(ActiveProject.user_id == self.user.id)
        )
        projects = projects_result.scalars().all()

        relationships_result = await self.db.execute(
            select(KeyRelationship).filter(KeyRelationship.user_id == self.user.id)
        )
        relationships = relationships_result.scalars().all()

        tasks_result = await self.db.execute(
            select(Task).filter(
                Task.user_id == self.user.id,
                Task.status != TaskStatus.COMPLETED
            )
        )
        tasks = tasks_result.scalars().all()

        return {
            "role": {
                "title": work_context.title,
                "team": work_context.team,
                "manager": work_context.manager_name
            },
            "capacity": {
                "status": work_context.capacity_status.value if work_context.capacity_status else None,
                "factors": work_context.capacity_factors
            },
            "active_projects": [
                {
                    "name": p.name,
                    "status": p.status.value,
                    "role": p.role.value
                }
                for p in projects
            ],
            "key_relationships": [
                {
                    "name": r.name,
                    "role": r.role,
                    "type": r.relationship_type
                }
                for r in relationships
            ],
            "active_tasks": len(tasks),
            "has_context": bool(work_context.title or work_context.team or len(projects) > 0)
        }


def get_work_context_tool_schemas():
    """Get tool schemas for AI function calling"""
    return [
        {
            "type": "function",
            "function": {
                "name": "update_role_info",
                "description": "Update user's role, team, and manager information when you learn about it in conversation",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Job title or role"},
                        "team": {"type": "string", "description": "Team name"},
                        "team_description": {"type": "string", "description": "What the team does"},
                        "manager_name": {"type": "string", "description": "Manager's name"},
                        "manager_title": {"type": "string", "description": "Manager's title"},
                        "team_size": {"type": "integer", "description": "Number of people on team"},
                        "team_composition": {"type": "string", "description": "Team makeup (e.g., '5 engineers, 2 designers')"}
                    }
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "update_capacity",
                "description": "Update user's capacity assessment when you detect capacity signals",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "status": {
                            "type": "string",
                            "enum": ["sustainable", "stretched", "overloaded", "unsustainable"],
                            "description": "Current capacity state"
                        },
                        "factors": {"type": "string", "description": "What's driving the capacity state"}
                    },
                    "required": ["status"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "add_or_update_project",
                "description": "Add or update an active project when mentioned in conversation",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Project name"},
                        "status": {
                            "type": "string",
                            "enum": ["green", "yellow", "red", "completed", "paused"],
                            "description": "Project status (RAG)"
                        },
                        "role": {
                            "type": "string",
                            "enum": ["owner", "contributor", "advisor"],
                            "description": "User's role in project"
                        },
                        "next_milestone": {"type": "string", "description": "Next milestone description"},
                        "key_stakeholders": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of stakeholder names"
                        },
                        "notes": {"type": "string", "description": "Additional context"}
                    },
                    "required": ["name", "status", "role"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "add_or_update_relationship",
                "description": "Add or update a key stakeholder/relationship when mentioned",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Person's name"},
                        "role": {"type": "string", "description": "Their job title"},
                        "relationship_type": {"type": "string", "description": "Type: manager, peer, stakeholder, direct_report"},
                        "cares_about": {"type": "string", "description": "What motivates them"},
                        "current_dynamic": {"type": "string", "description": "Current relationship state"},
                        "communication_preference": {"type": "string", "description": "How they prefer to communicate"}
                    },
                    "required": ["name"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "add_task",
                "description": "Add a task when action items come up in conversation",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Task description (start with verb)"},
                        "priority": {
                            "type": "string",
                            "enum": ["critical", "high_leverage", "stakeholder", "sweep", "backlog"],
                            "description": "Task priority tier"
                        },
                        "description": {"type": "string", "description": "Additional details"},
                        "deadline": {"type": "string", "format": "date-time", "description": "When it's due"},
                        "why_critical": {"type": "string", "description": "Why critical (for critical tasks)"},
                        "impact": {"type": "string", "description": "Expected impact (for high_leverage tasks)"},
                        "stakeholder_name": {"type": "string", "description": "Who it's for (for stakeholder tasks)"},
                        "source": {"type": "string", "description": "Where this task came from"}
                    },
                    "required": ["title", "priority"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_work_context_summary",
                "description": "Get summary of what you know about the user's work context",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        }
    ]
