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


class WorkContextTools:
    """AI tools for managing work context"""

    def __init__(self, db: AsyncSession, user: User):
        self.db = db
        self.user = user

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

        # Check if project exists
        result = await self.db.execute(
            select(ActiveProject).filter(
                ActiveProject.user_id == self.user.id,
                ActiveProject.name == name
            )
        )
        project = result.scalar_one_or_none()

        try:
            if project:
                # Update existing
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
                message = f"Updated project: {name}"
            else:
                # Create new
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
                message = f"Added project: {name}"

            await self.db.commit()

            return {
                "success": True,
                "message": message,
                "data": {"name": name, "status": status, "role": role}
            }
        except ValueError as e:
            return {
                "success": False,
                "error": f"Invalid project data: {str(e)}"
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

        # Check if relationship exists
        result = await self.db.execute(
            select(KeyRelationship).filter(
                KeyRelationship.user_id == self.user.id,
                KeyRelationship.name == name
            )
        )
        relationship = result.scalar_one_or_none()

        if relationship:
            # Update existing
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
            message = f"Updated relationship: {name}"
        else:
            # Create new
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
            message = f"Added relationship: {name}"

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
        product_id: Optional[int] = None
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
            product_id: Associated product (optional)
        """
        try:
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
                product_id=product_id
            )
            self.db.add(task)
            await self.db.commit()

            return {
                "success": True,
                "message": f"Added task: {title}",
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
