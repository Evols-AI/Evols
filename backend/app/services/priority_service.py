"""
Priority Service
RICE formula implementation with persona matching via embeddings

Priority = (Reach × PersonaWeight × Confidence) / Effort

Where:
- Reach = theme.account_count (how many customers affected)
- PersonaWeight = weighted avg of (revenue_contribution × usage_frequency) for matching personas
- Confidence = theme.confidence_score (0-1)
- Effort = {small: 1, medium: 2, large: 4, xlarge: 8}
"""

from typing import List, Dict, Any, Optional, Tuple
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.project import Project, ProjectEffort
from app.models.initiative import Initiative
from app.models.theme import Theme
from app.models.persona import Persona
from app.services.embedding_service import EmbeddingService
from app.services.outcome_learning_service import OutcomeLearningService

logger = logging.getLogger(__name__)


class PriorityService:
    """
    Calculates project priorities using RICE formula with persona weighting
    and outcome learning for confidence adjustment
    """

    # Effort multipliers
    EFFORT_MAP = {
        ProjectEffort.SMALL: 1,
        ProjectEffort.MEDIUM: 2,
        ProjectEffort.LARGE: 4,
        ProjectEffort.XLARGE: 8,
    }

    # Usage frequency weights
    USAGE_WEIGHTS = {
        'daily': 1.0,
        'weekly': 0.7,
        'monthly': 0.4,
        'quarterly': 0.2,
    }

    # Similarity threshold for persona matching
    SIMILARITY_THRESHOLD = 0.6

    def __init__(self, enable_learning: bool = True):
        self.embedder = EmbeddingService()
        self.enable_learning = enable_learning
        if self.enable_learning:
            self.outcome_learner = OutcomeLearningService()
        else:
            self.outcome_learner = None

    async def calculate_priorities_for_tenant(
        self,
        tenant_id: int,
        db: AsyncSession,
    ) -> int:
        """
        Calculate priority scores for all projects in tenant

        Returns:
            Number of projects updated
        """
        logger.info(f"[PriorityService] Calculating priorities for tenant {tenant_id}")

        # Load all projects
        result = await db.execute(
            select(Project).where(Project.tenant_id == tenant_id)
        )
        projects = result.scalars().all()

        if not projects:
            logger.warning(f"[PriorityService] No projects found")
            return 0

        # Load personas for matching (only advisor personas)
        persona_result = await db.execute(
            select(Persona).where(
                Persona.tenant_id == tenant_id,
                Persona.status == 'advisor'
            )
        )
        personas = persona_result.scalars().all()

        logger.info(
            f"[PriorityService] Calculating priorities for {len(projects)} projects "
            f"using {len(personas)} personas"
        )

        # Calculate priority for each project
        updated_count = 0
        for project in projects:
            try:
                await self._calculate_priority_for_project(project, personas, db)
                updated_count += 1
            except Exception as e:
                logger.error(
                    f"[PriorityService] Failed to calculate priority for project {project.id}: {e}",
                    exc_info=True
                )
                continue

        await db.commit()
        logger.info(f"[PriorityService] Updated {updated_count} projects")
        return updated_count

    async def _calculate_priority_for_project(
        self,
        project: Project,
        personas: List[Persona],
        db: AsyncSession,
    ):
        """Calculate RICE priority for a single project"""

        # Get initiative and linked themes
        initiative = await self._load_initiative(project.initiative_id, db)
        if not initiative:
            logger.warning(f"[PriorityService] No initiative found for project {project.id}")
            return

        themes = initiative.themes
        if not themes:
            logger.warning(
                f"[PriorityService] No themes found for initiative {initiative.id}, "
                f"using default values"
            )
            # Use defaults if no themes
            reach = 1
            confidence = 0.5
        else:
            # Calculate RICE components from themes
            reach = self._calculate_reach(themes)
            base_confidence = self._calculate_confidence(themes)

            # Apply outcome learning to adjust confidence (if enabled)
            if self.enable_learning and self.outcome_learner:
                confidence, learning_metadata = await self.outcome_learner.calculate_adjusted_confidence(
                    base_confidence=base_confidence,
                    project_context={
                        'title': project.title,
                        'description': project.description,
                        'themes': [t.title for t in themes],
                    },
                    tenant_id=project.tenant_id,
                    db=db,
                )

                # Store learning metadata in project for transparency
                if project.extra_data is None:
                    project.extra_data = {}
                project.extra_data['learning_metadata'] = learning_metadata
                project.extra_data['base_confidence'] = base_confidence

                logger.debug(
                    f"[PriorityService] Project '{project.title}': "
                    f"Base confidence {base_confidence:.2f} → "
                    f"Learned confidence {confidence:.2f}"
                )
            else:
                confidence = base_confidence

        # Calculate persona weight via matching
        persona_weight = await self._calculate_persona_weight(project, initiative, personas)

        # Get effort score
        effort_score = self.EFFORT_MAP.get(project.effort, 2)

        # RICE formula: (Reach × PersonaWeight × Confidence) / Effort
        if effort_score > 0:
            priority_score = (reach * persona_weight * confidence) / effort_score
        else:
            priority_score = 0.0

        # Update project
        project.reach = reach
        project.persona_weight = persona_weight
        project.confidence = confidence
        project.effort_score = effort_score
        project.priority_score = round(priority_score, 2)

        logger.debug(
            f"[PriorityService] Project '{project.title}': "
            f"R={reach} × PW={persona_weight:.2f} × C={confidence:.2f} / E={effort_score} = {priority_score:.2f}"
        )

    def _calculate_reach(self, themes: List[Theme]) -> int:
        """
        Reach = total unique accounts across all linked themes
        """
        return sum(theme.account_count or 0 for theme in themes)

    async def _calculate_persona_weight(
        self,
        project: Project,
        initiative: Initiative,
        personas: List[Persona],
    ) -> float:
        """
        PersonaWeight = weighted average of (revenue_contribution × usage_frequency)
        for personas matching this project

        Matching algorithm: embedding similarity between project/initiative and persona pain points/priorities
        """
        if not personas:
            return 1.0  # Default weight

        # Match personas to this project
        matched_personas = await self._match_personas_to_project(project, initiative, personas)

        if not matched_personas:
            logger.debug(f"[PriorityService] No personas matched for project '{project.title}'")
            return 1.0  # Default weight

        # Calculate weighted average
        total_weight = 0.0
        total_similarity = 0.0

        for persona, similarity_score in matched_personas:
            # Extract revenue contribution and usage frequency from extra_data
            extra_data = persona.extra_data or {}
            revenue_contribution = extra_data.get('revenue_contribution', 0.5)
            usage_frequency_str = extra_data.get('usage_frequency', 'monthly')

            # Normalize usage frequency string to lowercase
            usage_frequency_str = str(usage_frequency_str).lower()

            # Get usage weight
            usage_weight = self.USAGE_WEIGHTS.get(usage_frequency_str, 0.5)

            # Persona weight = revenue × usage × similarity
            persona_weight = revenue_contribution * usage_weight * similarity_score

            total_weight += persona_weight
            total_similarity += similarity_score

        # Normalize by total similarity
        if total_similarity > 0:
            avg_weight = total_weight / total_similarity
        else:
            avg_weight = 1.0

        # Store matched persona IDs
        project.matched_persona_ids = [p.id for p, _ in matched_personas]

        logger.debug(
            f"[PriorityService] Matched {len(matched_personas)} personas to project '{project.title}', "
            f"weight={avg_weight:.2f}"
        )

        return avg_weight

    async def _match_personas_to_project(
        self,
        project: Project,
        initiative: Initiative,
        personas: List[Persona],
    ) -> List[Tuple[Persona, float]]:
        """
        Match personas to project using embedding similarity

        Returns:
            List of (persona, similarity_score) tuples for personas with similarity > threshold
        """
        # Generate embedding for project + initiative
        project_text = (
            f"{initiative.title} {initiative.description or ''} "
            f"{project.title} {project.description or ''}"
        )
        project_embedding = await self.embedder.embed_text(project_text)

        matched = []

        for persona in personas:
            # Generate embedding for persona pain points + priorities
            pain_points = persona.key_pain_points or []
            priorities = persona.feature_priorities or []
            persona_text = f"{' '.join(pain_points)} {' '.join(priorities)}"

            if not persona_text.strip():
                continue

            try:
                persona_embedding = await self.embedder.embed_text(persona_text)

                # Calculate cosine similarity
                from app.services.embedding_service import cosine_similarity
                similarity = cosine_similarity(project_embedding, persona_embedding)

                # Only include personas with reasonable match (>60% similarity)
                if similarity > self.SIMILARITY_THRESHOLD:
                    matched.append((persona, similarity))
                    logger.debug(
                        f"[PriorityService] Matched persona '{persona.name}' to project "
                        f"'{project.title}' (similarity: {similarity:.2%})"
                    )

            except Exception as e:
                logger.error(
                    f"[PriorityService] Error matching persona {persona.id}: {e}",
                    exc_info=True
                )
                continue

        # Sort by similarity descending
        matched.sort(key=lambda x: x[1], reverse=True)

        # Return top 5 matched personas
        return matched[:5]

    def _calculate_confidence(self, themes: List[Theme]) -> float:
        """
        Confidence = average confidence_score across linked themes
        """
        if not themes:
            return 0.5  # Default confidence

        scores = [theme.confidence_score for theme in themes if theme.confidence_score is not None]
        if not scores:
            return 0.5

        return sum(scores) / len(scores)

    async def _load_initiative(self, initiative_id: int, db: AsyncSession) -> Optional[Initiative]:
        """Load initiative with themes preloaded"""
        result = await db.execute(
            select(Initiative)
            .where(Initiative.id == initiative_id)
            .options(selectinload(Initiative.themes))
        )
        return result.scalar_one_or_none()
