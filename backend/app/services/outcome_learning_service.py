"""
Outcome Learning Service
Learn from past outcomes to improve future predictions (Bayesian learning loop)

This closes the feedback loop by using actual outcomes to adjust confidence scores
"""

from typing import List, Dict, Any, Optional, Tuple
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.decision import Decision, DecisionStatus
from app.models.project import Project
from app.services.embedding_service import EmbeddingService, cosine_similarity

logger = logging.getLogger(__name__)


class OutcomeLearningService:
    """
    Learn from past outcomes to improve future predictions

    Uses historical data to adjust confidence scores based on prediction accuracy
    """

    # Similarity threshold for finding similar past decisions
    SIMILARITY_THRESHOLD = 0.6

    # Maximum number of similar decisions to consider
    MAX_SIMILAR_DECISIONS = 10

    # Bayesian adjustment parameters
    # adjusted_confidence = base_confidence * (BASE_WEIGHT + LEARNING_WEIGHT * historical_accuracy)
    BASE_WEIGHT = 0.3  # Minimum confidence multiplier (30%)
    LEARNING_WEIGHT = 0.7  # Weight given to historical accuracy (70%)

    def __init__(self):
        self.embedder = EmbeddingService()

    async def calculate_adjusted_confidence(
        self,
        base_confidence: float,
        project_context: Dict[str, Any],
        tenant_id: int,
        db: AsyncSession,
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Adjust confidence based on historical accuracy

        Algorithm:
        1. Find similar past decisions (embedding similarity)
        2. Check actual_arr_impact vs estimated_arr_impact
        3. Calculate prediction accuracy rate
        4. Apply Bayesian adjustment to confidence

        Args:
            base_confidence: Initial confidence score (0-1)
            project_context: Context about current project (title, description, themes)
            tenant_id: Tenant ID
            db: Database session

        Returns:
            Tuple of (adjusted_confidence, learning_metadata)
        """
        logger.info(
            f"[OutcomeLearning] Calculating adjusted confidence for project: "
            f"'{project_context.get('title', 'unknown')}'"
        )

        # Find similar past decisions
        similar_decisions = await self._find_similar_decisions(
            project_context,
            tenant_id,
            db
        )

        if not similar_decisions:
            logger.info(
                f"[OutcomeLearning] No historical data found, using base confidence: "
                f"{base_confidence:.2f}"
            )
            return base_confidence, {
                "similar_decisions_count": 0,
                "historical_accuracy": None,
                "adjustment_applied": False,
            }

        # Calculate historical accuracy
        accuracy_scores = []
        decision_details = []

        for decision, similarity in similar_decisions:
            if decision.actual_arr_impact is not None and decision.estimated_arr_impact:
                # Calculate prediction error
                error_ratio = abs(
                    decision.actual_arr_impact - decision.estimated_arr_impact
                ) / max(decision.estimated_arr_impact, 1)

                # Convert error to accuracy (lower error = higher accuracy)
                accuracy = 1.0 - min(error_ratio, 1.0)
                accuracy_scores.append(accuracy)

                decision_details.append({
                    "decision_id": decision.id,
                    "title": decision.title,
                    "similarity": similarity,
                    "estimated_arr": decision.estimated_arr_impact,
                    "actual_arr": decision.actual_arr_impact,
                    "error_ratio": error_ratio,
                    "accuracy": accuracy,
                })

                logger.debug(
                    f"[OutcomeLearning] Similar decision: '{decision.title}' "
                    f"(similarity: {similarity:.2%}, accuracy: {accuracy:.2%})"
                )

        if not accuracy_scores:
            logger.info(
                f"[OutcomeLearning] No outcome data available in similar decisions, "
                f"using base confidence: {base_confidence:.2f}"
            )
            return base_confidence, {
                "similar_decisions_count": len(similar_decisions),
                "historical_accuracy": None,
                "adjustment_applied": False,
            }

        # Calculate average historical accuracy
        avg_accuracy = sum(accuracy_scores) / len(accuracy_scores)

        # Bayesian adjustment: weight base confidence by historical accuracy
        # Formula: adjusted = base * (BASE_WEIGHT + LEARNING_WEIGHT * accuracy)
        # - If historically 100% accurate: multiplier = 1.0 (no change)
        # - If historically 50% accurate: multiplier = 0.65 (reduce confidence)
        # - If historically 0% accurate: multiplier = 0.3 (significant reduction)
        adjustment_multiplier = self.BASE_WEIGHT + (self.LEARNING_WEIGHT * avg_accuracy)
        adjusted_confidence = base_confidence * adjustment_multiplier

        # Clamp to valid range [0, 1]
        adjusted_confidence = max(0.0, min(1.0, adjusted_confidence))

        logger.info(
            f"[OutcomeLearning] Adjusted confidence: {base_confidence:.2f} → "
            f"{adjusted_confidence:.2f} (historical accuracy: {avg_accuracy:.2%}, "
            f"multiplier: {adjustment_multiplier:.2f})"
        )

        return adjusted_confidence, {
            "similar_decisions_count": len(similar_decisions),
            "decisions_with_outcomes": len(accuracy_scores),
            "historical_accuracy": avg_accuracy,
            "adjustment_multiplier": adjustment_multiplier,
            "adjustment_applied": True,
            "decision_details": decision_details,
        }

    async def _find_similar_decisions(
        self,
        project_context: Dict[str, Any],
        tenant_id: int,
        db: AsyncSession,
    ) -> List[Tuple[Decision, float]]:
        """
        Find past decisions similar to current project context

        Args:
            project_context: Dict with 'title', 'description', 'themes'
            tenant_id: Tenant ID
            db: Database session

        Returns:
            List of (Decision, similarity_score) tuples sorted by similarity
        """
        # Generate embedding for current project
        project_text = self._build_context_text(project_context)

        try:
            project_embedding = await self.embedder.embed_text(project_text)
        except Exception as e:
            logger.error(f"[OutcomeLearning] Error generating embedding: {e}", exc_info=True)
            return []

        # Query past IMPLEMENTED decisions with outcomes
        query = select(Decision).where(
            Decision.tenant_id == tenant_id,
            Decision.status == DecisionStatus.IMPLEMENTED,
            # Must have outcome data
            Decision.actual_arr_impact.isnot(None),
        )

        result = await db.execute(query)
        decisions = result.scalars().all()

        if not decisions:
            logger.debug(f"[OutcomeLearning] No implemented decisions with outcomes found")
            return []

        logger.debug(
            f"[OutcomeLearning] Found {len(decisions)} implemented decisions with outcomes"
        )

        # Calculate similarity for each decision
        similar = []

        for decision in decisions:
            decision_text = self._build_decision_text(decision)

            if not decision_text.strip():
                continue

            try:
                decision_embedding = await self.embedder.embed_text(decision_text)

                # Calculate cosine similarity
                similarity = cosine_similarity(project_embedding, decision_embedding)

                # Only consider decisions above similarity threshold
                if similarity > self.SIMILARITY_THRESHOLD:
                    similar.append((decision, similarity))

            except Exception as e:
                logger.error(
                    f"[OutcomeLearning] Error calculating similarity for decision {decision.id}: {e}",
                    exc_info=True
                )
                continue

        # Sort by similarity descending
        similar.sort(key=lambda x: x[1], reverse=True)

        # Return top N most similar
        top_similar = similar[:self.MAX_SIMILAR_DECISIONS]

        logger.info(
            f"[OutcomeLearning] Found {len(top_similar)} similar past decisions "
            f"(threshold: {self.SIMILARITY_THRESHOLD:.0%})"
        )

        return top_similar

    def _build_context_text(self, project_context: Dict[str, Any]) -> str:
        """Build text representation of project context for embedding"""
        parts = []

        if project_context.get("title"):
            parts.append(project_context["title"])

        if project_context.get("description"):
            parts.append(project_context["description"])

        if project_context.get("themes"):
            themes = project_context["themes"]
            if isinstance(themes, list):
                parts.extend(themes)

        return " ".join(parts)

    def _build_decision_text(self, decision: Decision) -> str:
        """Build text representation of decision for embedding"""
        parts = []

        if decision.title:
            parts.append(decision.title)

        if decision.description:
            parts.append(decision.description)

        if decision.problem_statement:
            parts.append(decision.problem_statement)

        if decision.objective:
            parts.append(decision.objective)

        return " ".join(parts)

    async def track_outcome(
        self,
        decision_id: int,
        actual_arr_impact: float,
        actual_retention_impact: Optional[float] = None,
        outcome_notes: Optional[str] = None,
        db: AsyncSession = None,
    ):
        """
        Track actual outcome for a decision (for future learning)

        Args:
            decision_id: Decision ID
            actual_arr_impact: Actual ARR impact (measured)
            actual_retention_impact: Actual retention impact (optional)
            outcome_notes: Notes about the outcome
            db: Database session
        """
        decision = await db.get(Decision, decision_id)

        if not decision:
            logger.error(f"[OutcomeLearning] Decision {decision_id} not found")
            return

        # Update decision with outcome data
        decision.actual_arr_impact = actual_arr_impact
        decision.actual_retention_impact = actual_retention_impact
        decision.outcome_notes = outcome_notes
        decision.status = DecisionStatus.IMPLEMENTED

        await db.commit()

        # Calculate accuracy of original estimate
        if decision.estimated_arr_impact:
            error_ratio = abs(
                actual_arr_impact - decision.estimated_arr_impact
            ) / max(decision.estimated_arr_impact, 1)
            accuracy = (1.0 - min(error_ratio, 1.0)) * 100

            logger.info(
                f"[OutcomeLearning] Outcome tracked for decision '{decision.title}': "
                f"Estimated ${decision.estimated_arr_impact:,.0f} → "
                f"Actual ${actual_arr_impact:,.0f} "
                f"(Accuracy: {accuracy:.1f}%)"
            )
        else:
            logger.info(
                f"[OutcomeLearning] Outcome tracked for decision '{decision.title}': "
                f"Actual ARR impact: ${actual_arr_impact:,.0f}"
            )

    async def get_learning_stats(
        self,
        tenant_id: int,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """
        Get learning statistics for a tenant

        Returns stats about historical prediction accuracy
        """
        # Get all decisions with outcomes
        query = select(Decision).where(
            Decision.tenant_id == tenant_id,
            Decision.status == DecisionStatus.IMPLEMENTED,
            Decision.actual_arr_impact.isnot(None),
            Decision.estimated_arr_impact.isnot(None),
        )

        result = await db.execute(query)
        decisions = result.scalars().all()

        if not decisions:
            return {
                "total_decisions": 0,
                "avg_accuracy": None,
                "total_estimated_arr": 0,
                "total_actual_arr": 0,
            }

        # Calculate accuracy for each decision
        accuracy_scores = []
        total_estimated = 0
        total_actual = 0

        for decision in decisions:
            error_ratio = abs(
                decision.actual_arr_impact - decision.estimated_arr_impact
            ) / max(decision.estimated_arr_impact, 1)

            accuracy = 1.0 - min(error_ratio, 1.0)
            accuracy_scores.append(accuracy)

            total_estimated += decision.estimated_arr_impact
            total_actual += decision.actual_arr_impact

        avg_accuracy = sum(accuracy_scores) / len(accuracy_scores)

        logger.info(
            f"[OutcomeLearning] Learning stats for tenant {tenant_id}: "
            f"{len(decisions)} decisions, {avg_accuracy:.2%} avg accuracy"
        )

        return {
            "total_decisions": len(decisions),
            "avg_accuracy": avg_accuracy,
            "total_estimated_arr": total_estimated,
            "total_actual_arr": total_actual,
            "accuracy_by_decision": [
                {
                    "decision_id": d.id,
                    "title": d.title,
                    "estimated": d.estimated_arr_impact,
                    "actual": d.actual_arr_impact,
                    "accuracy": acc,
                }
                for d, acc in zip(decisions, accuracy_scores)
            ],
        }
