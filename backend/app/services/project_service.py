"""
Project Service
AI-powered project generation from initiatives
"""

import json
import re
from typing import List, Dict, Any, Optional
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.services.llm_service import LLMService, get_llm_service
from app.models.project import Project, ProjectEffort, ProjectStatus
from app.models.initiative import Initiative
from app.models.theme import Theme
from app.models.persona import Persona
from app.models.knowledge_base import Capability

logger = logging.getLogger(__name__)

PROJECT_GENERATION_SYSTEM_PROMPT = """You are an expert product manager breaking down strategic initiatives into concrete work items.

Your task is to generate specific, actionable projects that:
- Are clearly scoped (boulders for larger work, pebbles for smaller tasks)
- Have clear acceptance criteria
- Consider technical feasibility and dependencies
- Align with user needs and pain points

For each project, specify:
- Title (clear, action-oriented, 5-8 words)
- Description (what will be built and why, 2-3 sentences)
- Effort (small/medium/large/xlarge)
- Is_boulder (true for larger projects, false for quick wins/pebbles)
- Acceptance criteria (3-5 concrete success metrics)

Always ground your recommendations in the provided context: themes, personas, and existing capabilities."""


class ProjectService:
    """
    Generates projects from initiatives using LLM with full context
    """

    def __init__(self, llm_service: Optional[LLMService] = None):
        self.llm = llm_service or get_llm_service()

    async def generate_projects_for_initiatives(
        self,
        tenant_id: int,
        db: AsyncSession,
        initiative_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """
        Generate projects for initiatives

        Args:
            tenant_id: Tenant ID
            db: Database session
            initiative_ids: Optional list of initiative IDs (if None, process all)

        Returns:
            Dict with projects_created and initiatives_processed counts
        """
        logger.info(f"[ProjectService] Starting project generation for tenant {tenant_id}")

        # Get initiatives with themes preloaded
        query = (
            select(Initiative)
            .where(Initiative.tenant_id == tenant_id)
            .options(selectinload(Initiative.themes))
        )

        if initiative_ids:
            query = query.where(Initiative.id.in_(initiative_ids))

        result = await db.execute(query)
        initiatives = result.scalars().all()

        if not initiatives:
            logger.warning(f"[ProjectService] No initiatives found for tenant {tenant_id}")
            return {"projects_created": 0, "initiatives_processed": 0}

        logger.info(f"[ProjectService] Found {len(initiatives)} initiatives to process")

        # Log initiative details
        for init in initiatives:
            logger.debug(
                f"[ProjectService] Initiative: '{init.title}' "
                f"(ID: {init.id}, Themes: {len(init.themes)})"
            )

        # Load context data once (shared across all initiatives)
        personas = await self._load_personas(tenant_id, db)
        capabilities = await self._load_capabilities(tenant_id, db)

        projects_created = 0

        for initiative in initiatives:
            try:
                # Generate projects for this initiative
                generated_projects = await self._generate_projects_for_initiative(
                    initiative=initiative,
                    personas=personas,
                    capabilities=capabilities,
                    db=db,
                )

                projects_created += len(generated_projects)
                logger.debug(
                    f"[ProjectService] Generated {len(generated_projects)} projects "
                    f"for initiative '{initiative.title}'"
                )

            except Exception as e:
                logger.error(
                    f"[ProjectService] Failed to generate projects for initiative {initiative.id}: {e}",
                    exc_info=True
                )
                continue

        await db.commit()
        logger.info(
            f"[ProjectService] Complete: {projects_created} projects created "
            f"for {len(initiatives)} initiatives"
        )

        return {
            "projects_created": projects_created,
            "initiatives_processed": len(initiatives),
        }

    async def _generate_projects_for_initiative(
        self,
        initiative: Initiative,
        personas: List[Persona],
        capabilities: List[Capability],
        db: AsyncSession,
    ) -> List[Project]:
        """Generate projects for a single initiative using LLM"""

        # Build context for LLM
        theme_context = self._build_theme_context(initiative.themes)
        persona_context = self._build_persona_context(personas)
        capability_context = self._build_capability_context(capabilities)

        prompt = f"""Break down this initiative into 3-8 concrete projects (mix of boulders and pebbles).

INITIATIVE:
Title: {initiative.title}
Description: {initiative.description or 'No description provided'}
Effort: {initiative.effort.value if initiative.effort else 'unknown'}
Target Segments: {', '.join(initiative.target_segments or ['All segments'])}

CONTEXT:

Linked Themes (customer problems):
{theme_context}

Key Personas (who will use this):
{persona_context}

Existing Capabilities (avoid duplicating these):
{capability_context}

Generate 3-8 projects that:
1. Address the initiative goal
2. Consider persona pain points and priorities
3. Don't duplicate existing capabilities (but can enhance them)
4. Mix of boulders (large/xlarge effort) and pebbles (small/medium effort - quick wins)
5. Have clear, measurable acceptance criteria

Respond with JSON array:
[
  {{
    "title": "Project title (5-8 words, action-oriented)",
    "description": "What will be built and why (2-3 sentences)",
    "effort": "small|medium|large|xlarge",
    "is_boulder": true|false,
    "acceptance_criteria": ["Criterion 1", "Criterion 2", "Criterion 3"]
  }}
]"""

        try:
            logger.debug(
                f"[ProjectService] Calling LLM for initiative '{initiative.title}' "
                f"(themes: {len(initiative.themes)}, personas: {len(personas)}, "
                f"capabilities: {len(capabilities)})"
            )

            response = await self.llm.generate(
                prompt=prompt,
                system_prompt=PROJECT_GENERATION_SYSTEM_PROMPT,
                temperature=0.4,
                max_tokens=2500,
            )

            logger.debug(f"[ProjectService] LLM response length: {len(response.content)} chars")
            logger.debug(f"[ProjectService] LLM response: {response.content[:500]}...")

            # Parse JSON response
            json_match = re.search(r'\[[\s\S]*\]', response.content)
            if not json_match:
                logger.error(
                    f"[ProjectService] No JSON array found in LLM response. "
                    f"Response: {response.content[:500]}"
                )
                return []

            projects_data = json.loads(json_match.group())
            logger.debug(f"[ProjectService] Parsed {len(projects_data)} projects from LLM")

            # Create Project instances
            projects = []
            for proj_data in projects_data[:8]:  # Limit to 8 projects max
                effort_str = proj_data.get('effort', 'medium').lower()
                effort_map = {
                    'small': ProjectEffort.SMALL,
                    'medium': ProjectEffort.MEDIUM,
                    'large': ProjectEffort.LARGE,
                    'xlarge': ProjectEffort.XLARGE,
                }
                effort = effort_map.get(effort_str, ProjectEffort.MEDIUM)

                # Determine is_boulder from effort if not explicitly set
                is_boulder = proj_data.get('is_boulder')
                if is_boulder is None:
                    is_boulder = effort in [ProjectEffort.LARGE, ProjectEffort.XLARGE]

                project = Project(
                    tenant_id=initiative.tenant_id,
                    initiative_id=initiative.id,
                    title=proj_data.get('title', 'Untitled Project'),
                    description=proj_data.get('description', ''),
                    effort=effort,
                    is_boulder=is_boulder,
                    status=ProjectStatus.BACKLOG,
                    acceptance_criteria=proj_data.get('acceptance_criteria', []),
                )

                db.add(project)
                projects.append(project)

            return projects

        except json.JSONDecodeError as e:
            logger.error(f"[ProjectService] Failed to parse JSON: {e}")
            return []
        except Exception as e:
            logger.error(f"[ProjectService] LLM generation failed: {e}", exc_info=True)
            return []

    async def _load_personas(self, tenant_id: int, db: AsyncSession) -> List[Persona]:
        """Load personas for context (only active personas)"""
        result = await db.execute(
            select(Persona).where(
                Persona.tenant_id == tenant_id,
                Persona.status == 'active'  # Only use active personas
            )
        )
        return result.scalars().all()

    async def _load_capabilities(self, tenant_id: int, db: AsyncSession) -> List[Capability]:
        """Load capabilities for filtering"""
        result = await db.execute(
            select(Capability).where(Capability.tenant_id == tenant_id)
        )
        return result.scalars().all()

    def _build_theme_context(self, themes: List[Theme]) -> str:
        """Build theme context for LLM prompt"""
        if not themes:
            logger.warning("[ProjectService] No themes linked to this initiative")
            return "No linked themes (Note: Initiative was created without theme linkage)"

        lines = []
        for theme in themes[:5]:  # Limit to 5 themes
            lines.append(
                f"- {theme.title}: {theme.summary or theme.description or 'No description'}\n"
                f"  ({theme.feedback_count} feedback items, {theme.account_count} accounts, "
                f"urgency: {theme.urgency_score:.0%}, impact: {theme.impact_score:.0%})"
            )
        return "\n".join(lines)

    def _build_persona_context(self, personas: List[Persona]) -> str:
        """Build persona context for LLM prompt"""
        if not personas:
            return "No personas defined"

        lines = []
        for persona in personas[:5]:  # Limit to 5 personas
            pain_points = persona.key_pain_points or []
            priorities = persona.feature_priorities or []
            lines.append(
                f"- {persona.name} ({persona.segment})\n"
                f"  Pain points: {', '.join(pain_points[:3]) if pain_points else 'None'}\n"
                f"  Priorities: {', '.join(priorities[:3]) if priorities else 'None'}"
            )
        return "\n".join(lines)

    def _build_capability_context(self, capabilities: List[Capability]) -> str:
        """Build capability context for LLM prompt"""
        if not capabilities:
            return "No existing capabilities documented"

        lines = []
        for cap in capabilities[:20]:  # Limit to 20
            description = cap.description[:100] if cap.description else "No description"
            lines.append(f"- {cap.name}: {description}")
        return "\n".join(lines)
