"""
Priority Service
Simplified priority scoring for projects without legacy theme/persona data.
Projects now receive a default priority score; future implementations can
derive reach/confidence from the knowledge graph.
"""

from typing import List, Dict, Any, Optional
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.project import Project, ProjectEffort

logger = logging.getLogger(__name__)


class PriorityService:
    """
    Sets default priority scores for projects.
    The legacy RICE formula (which required Theme + Persona tables) is no longer
    applicable since those tables were removed in migration 026. Priority can be
    manually set by users or derived from the knowledge graph in a future iteration.
    """

    EFFORT_MAP = {
        ProjectEffort.SMALL: 1,
        ProjectEffort.MEDIUM: 2,
        ProjectEffort.LARGE: 4,
        ProjectEffort.XLARGE: 8,
    }

    async def calculate_priorities_for_tenant(
        self,
        tenant_id: int,
        db: AsyncSession,
    ) -> int:
        """
        Set default priority scores for all projects that don't have one.
        Returns number of projects updated.
        """
        logger.info(f"[PriorityService] Setting default priorities for tenant {tenant_id}")

        result = await db.execute(
            select(Project).where(
                Project.tenant_id == tenant_id,
                Project.priority_score.is_(None)
            )
        )
        projects = result.scalars().all()

        if not projects:
            return 0

        for project in projects:
            effort_score = self.EFFORT_MAP.get(project.effort, 2)
            project.effort_score = effort_score
            project.reach = 1
            project.confidence = 0.5
            project.persona_weight = 1.0
            project.priority_score = round(1.0 / effort_score, 2)

        await db.commit()
        logger.info(f"[PriorityService] Set default priority for {len(projects)} projects")
        return len(projects)
