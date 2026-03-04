"""
Theme Service
AI-powered theme generation from clustered feedback, with full citations
Enhanced with capability-aware filtering to avoid duplicate themes
"""

import json
from typing import List, Dict, Any, Optional
from collections import defaultdict
from loguru import logger

from app.services.llm_service import LLMService, get_llm_service, THEME_LABELING_SYSTEM_PROMPT, THEME_SUMMARY_SYSTEM_PROMPT
from app.services.embedding_service import EmbeddingService, get_embedding_service
from app.services.clustering_service import ClusteringService, ClusterResult
from app.core.citations import CitedContent, Citation, CitationSourceType, extract_citations_from_feedback


class ThemeResult:
    """A single generated theme with metadata and citations"""

    def __init__(
        self,
        cluster_id: int,
        title: str,
        description: str,
        summary: CitedContent,
        primary_category: Optional[str],
        feedback_count: int,
        account_count: int,
        total_arr: float,
        urgency_score: float,
        impact_score: float,
        confidence_score: float,
        trend: Optional[str],
        affected_segments: List[str],
        key_quotes: List[Dict[str, Any]],
        suggested_solutions: List[str],
        feedback_ids: List[int],
    ):
        self.cluster_id = cluster_id
        self.title = title
        self.description = description
        self.summary = summary
        self.primary_category = primary_category
        self.feedback_count = feedback_count
        self.account_count = account_count
        self.total_arr = total_arr
        self.urgency_score = urgency_score
        self.impact_score = impact_score
        self.confidence_score = confidence_score
        self.trend = trend
        self.affected_segments = affected_segments
        self.key_quotes = key_quotes
        self.suggested_solutions = suggested_solutions
        self.feedback_ids = feedback_ids


class ThemeService:
    """
    End-to-end service: embed → cluster → label → summarize → score.
    Every AI statement is backed by citations.
    """

    def __init__(
        self,
        llm_service: Optional[LLMService] = None,
        embedding_service: Optional[EmbeddingService] = None,
        tenant_config: Optional[Dict[str, Any]] = None,
    ):
        self.llm = llm_service or get_llm_service(tenant_config=tenant_config)
        self.embedder = embedding_service or get_embedding_service()
        self.clusterer = ClusteringService(embedding_service=self.embedder)
        self.tenant_config = tenant_config

    # ------------------------------------------------------------------ #
    # Capability-aware filtering
    # ------------------------------------------------------------------ #

    async def _filter_feedback_by_capabilities(
        self,
        feedback_items: List[Any],
        capabilities: List[Any],
    ) -> List[Any]:
        """
        Filter feedback against existing product capabilities.

        Logic:
        - If feedback requests a feature that already exists → EXCLUDE (duplicate)
        - If feedback requests an enhancement to existing feature → INCLUDE (valid theme)
        - If feedback requests a completely new feature → INCLUDE (valid theme)

        Args:
            feedback_items: List of Feedback ORM instances
            capabilities: List of Capability ORM instances

        Returns:
            Filtered list of feedback items (excluding duplicates of existing features)
        """
        if not capabilities:
            return feedback_items

        # Build capability context for LLM
        capability_list = []
        for cap in capabilities[:50]:  # Limit to first 50 capabilities to avoid token limits
            capability_list.append(f"- {cap.name}: {cap.description} (Category: {cap.category})")

        capability_context = "\n".join(capability_list)

        filtered_feedback = []

        # Batch process feedback in groups to optimize LLM calls
        batch_size = 10
        for i in range(0, len(feedback_items), batch_size):
            batch = feedback_items[i:i+batch_size]

            # Build feedback batch text
            feedback_texts = []
            for idx, fb in enumerate(batch):
                feedback_texts.append(
                    f"{idx + 1}. [{fb.category.value if fb.category else 'unknown'}] {fb.title}\n"
                    f"   Content: {fb.content[:200] if fb.content else 'No description'}"
                )

            feedback_batch_text = "\n\n".join(feedback_texts)

            # Ask LLM to classify each feedback item
            prompt = f"""You are analyzing customer feedback for a product that has the following existing capabilities:

EXISTING CAPABILITIES:
{capability_context}

CUSTOMER FEEDBACK TO ANALYZE:
{feedback_batch_text}

For each feedback item above, determine:
- "duplicate" - if it requests a feature that ALREADY EXISTS in the capabilities list
- "enhancement" - if it requests an improvement/enhancement to an existing capability
- "new" - if it requests a completely new feature not related to existing capabilities

Return ONLY a JSON array with one entry per feedback item in the same order:
[
  {{"id": 1, "classification": "duplicate", "reason": "Video conferencing already exists"}},
  {{"id": 2, "classification": "enhancement", "reason": "Requests better screen sharing quality"}},
  {{"id": 3, "classification": "new", "reason": "AI transcription is not in capabilities"}}
]

Be strict: only mark as "duplicate" if the feedback is clearly requesting something that already fully exists.
Mark as "enhancement" if improving/extending an existing feature.
Mark as "new" for genuinely new feature requests."""

            try:
                result = await self.llm.generate(
                    prompt=prompt,
                    temperature=0.2,  # Low temperature for consistent classification
                    max_tokens=1000,
                )

                # Parse JSON response
                import re
                json_match = re.search(r'\[.*\]', result.content, re.DOTALL)
                if json_match:
                    classifications = json.loads(json_match.group(0))

                    # Keep feedback that is "enhancement" or "new", exclude "duplicate"
                    for idx, classification in enumerate(classifications):
                        if idx < len(batch):
                            fb = batch[idx]
                            classification_type = classification.get('classification', 'new')
                            reason = classification.get('reason', '')

                            if classification_type in ['enhancement', 'new']:
                                filtered_feedback.append(fb)
                                logger.debug(
                                    f"[ThemeService] KEEPING feedback #{fb.id}: "
                                    f"{classification_type} - {reason}"
                                )
                            else:
                                logger.info(
                                    f"[ThemeService] EXCLUDING feedback #{fb.id}: "
                                    f"duplicate of existing capability - {reason}"
                                )
                else:
                    # If JSON parsing fails, keep all feedback in this batch to be safe
                    logger.warning(
                        f"[ThemeService] Failed to parse classification response, "
                        f"keeping batch {i}-{i+len(batch)}"
                    )
                    filtered_feedback.extend(batch)

            except Exception as e:
                logger.error(f"[ThemeService] Error classifying feedback batch: {e}")
                # On error, keep all feedback in this batch to be safe
                filtered_feedback.extend(batch)

        logger.info(
            f"[ThemeService] Capability filtering: {len(feedback_items)} → {len(filtered_feedback)} "
            f"({len(feedback_items) - len(filtered_feedback)} duplicates removed)"
        )

        return filtered_feedback

    # ------------------------------------------------------------------ #
    # Main pipeline
    # ------------------------------------------------------------------ #

    async def generate_themes(
        self,
        feedback_items: List[Any],
        accounts: Optional[Dict[int, Any]] = None,
        progress_callback=None,
        existing_capabilities: Optional[List[Any]] = None,
    ) -> List[ThemeResult]:
        """
        Full pipeline: embed → filter against capabilities → cluster → label → score.

        Args:
            feedback_items: Feedback ORM instances.
            accounts: {account_id: Account} lookup for ARR calculation.
            progress_callback: async fn(progress: float, message: str) for UI updates.
            existing_capabilities: List of Capability ORM instances from knowledge base.
                If provided, feedback requesting existing features will be filtered out,
                but enhancement requests will be kept.

        Returns:
            List of ThemeResult objects (one per cluster, sorted by total_arr desc).
        """
        accounts = accounts or {}

        async def _progress(p: float, msg: str):
            if progress_callback:
                await progress_callback(p, msg)
            logger.info(f"[ThemeService] {int(p * 100)}% – {msg}")

        # Step 0 – filter feedback against existing capabilities
        if existing_capabilities:
            await _progress(0.02, f"Checking feedback against {len(existing_capabilities)} existing capabilities…")
            feedback_items = await self._filter_feedback_by_capabilities(
                feedback_items, existing_capabilities
            )
            logger.info(f"[ThemeService] After capability filtering: {len(feedback_items)} feedback items remain")

        # Step 1 – embed
        await _progress(0.05, "Generating embeddings…")
        texts = [item.content for item in feedback_items]
        embeddings = await self.embedder.embed_batch(texts)

        # Step 2 – store embeddings back onto items (in-memory only)
        for item, emb in zip(feedback_items, embeddings):
            item._embedding_vector = emb  # transient attribute

        # Step 3 – cluster
        await _progress(0.30, "Clustering feedback into themes…")
        cluster_result: ClusterResult = await self.clusterer.cluster_feedback(
            feedback_items, embeddings=embeddings
        )
        n = cluster_result.n_clusters
        await _progress(0.45, f"Found {n} theme clusters. Labeling with AI…")

        # Step 4 – per-cluster label + summary
        themes: List[ThemeResult] = []
        cluster_ids = [cid for cid in cluster_result.cluster_centers.keys()]

        for idx, cluster_id in enumerate(cluster_ids):
            progress = 0.45 + 0.45 * (idx / max(len(cluster_ids), 1))
            await _progress(progress, f"Analyzing theme {idx + 1}/{len(cluster_ids)}…")

            theme = await self._build_theme(
                cluster_id=cluster_id,
                feedback_items=feedback_items,
                cluster_labels=cluster_result.cluster_labels,
                embeddings=embeddings,
                accounts=accounts,
            )
            if theme:
                themes.append(theme)

        # Sort by revenue impact
        themes.sort(key=lambda t: t.total_arr, reverse=True)

        await _progress(1.0, f"Done – generated {len(themes)} themes.")
        return themes

    # ------------------------------------------------------------------ #
    # Per-cluster helpers
    # ------------------------------------------------------------------ #

    async def _build_theme(
        self,
        cluster_id: int,
        feedback_items: List[Any],
        cluster_labels: List[int],
        embeddings: List[List[float]],
        accounts: Dict[int, Any],
    ) -> Optional[ThemeResult]:
        """Build a single ThemeResult for one cluster."""
        # Items in this cluster
        cluster_items = [
            item for item, label in zip(feedback_items, cluster_labels)
            if label == cluster_id
        ]
        if not cluster_items:
            return None

        # Stats
        stats = self.clusterer.get_cluster_statistics(
            feedback_items, cluster_labels, cluster_id
        )
        total_arr, account_count = self._calc_arr(cluster_items, accounts)

        # Representative quotes
        reps = self.clusterer.get_representative_feedback(
            feedback_items, cluster_labels, embeddings, cluster_id, n_representatives=5
        )
        key_quotes = [
            {
                "text": item.content[:300],
                "feedback_id": item.id,
                "account_name": item.customer_name or "Unknown",
                "segment": item.customer_segment or "Unknown",
            }
            for item in reps
        ]

        # Build citations
        feedback_citations = extract_citations_from_feedback(cluster_items)

        # LLM: label + summary + solutions
        label_data = await self._generate_label(cluster_items, key_quotes)
        title = label_data.get("title", f"Theme #{cluster_id}")
        description = label_data.get("description", "")
        suggested_solutions = label_data.get("suggested_solutions", [])

        summary_text = await self._generate_summary(
            cluster_items, title, key_quotes, stats
        )

        summary_cited = CitedContent(
            content=summary_text,
            citations=feedback_citations,
            confidence_score=min(len(cluster_items) / 10.0, 1.0),
        )

        # Scoring
        urgency = self._score_urgency(cluster_items, stats)
        impact = self._score_impact(total_arr, len(cluster_items))
        confidence = min(len(cluster_items) / 10.0, 1.0)

        return ThemeResult(
            cluster_id=cluster_id,
            title=title,
            description=description,
            summary=summary_cited,
            primary_category=stats.get("primary_category"),
            feedback_count=len(cluster_items),
            account_count=account_count,
            total_arr=total_arr,
            urgency_score=urgency,
            impact_score=impact,
            confidence_score=confidence,
            trend=None,  # Requires time-series data
            affected_segments=list(stats.get("segments", {}).keys()),
            key_quotes=key_quotes,
            suggested_solutions=suggested_solutions,
            feedback_ids=[item.id for item in cluster_items],
        )

    async def _generate_label(
        self,
        cluster_items: List[Any],
        key_quotes: List[Dict],
    ) -> Dict[str, Any]:
        """Generate theme title, description, and solution ideas from an LLM."""
        sample_content = "\n".join(
            f"- [{item.customer_segment or 'Unknown'}] {item.content[:200]}"
            for item in cluster_items[:15]
        )
        quotes_text = "\n".join(
            f'  "{q["text"][:150]}" — {q["account_name"]} ({q["segment"]})'
            for q in key_quotes
        )

        prompt = f"""You are analyzing a cluster of {len(cluster_items)} related customer feedback items.

Sample feedback:
{sample_content}

Most representative quotes:
{quotes_text}

Respond with JSON in exactly this structure:
{{
  "title": "<3-7 word theme label focused on customer problem>",
  "description": "<1-2 sentence description of the core problem>",
  "suggested_solutions": ["<solution idea 1>", "<solution idea 2>", "<solution idea 3>"]
}}"""

        try:
            result = await self.llm.generate_structured(
                prompt=prompt,
                response_format={
                    "title": "string",
                    "description": "string",
                    "suggested_solutions": ["string"],
                },
                system_prompt=THEME_LABELING_SYSTEM_PROMPT,
            )
            return result
        except Exception as e:
            logger.error(f"Theme label generation failed: {e}")
            return {
                "title": f"Feedback Cluster {len(cluster_items)} items",
                "description": "AI label generation failed.",
                "suggested_solutions": [],
            }

    async def _generate_summary(
        self,
        cluster_items: List[Any],
        title: str,
        key_quotes: List[Dict],
        stats: Dict[str, Any],
    ) -> str:
        """Generate a concise narrative summary of the theme."""
        segment_breakdown = ", ".join(
            f"{seg}: {count}" for seg, count in stats.get("segments", {}).items()
        )
        quotes_text = "\n".join(
            f'  "{q["text"][:150]}"' for q in key_quotes[:3]
        )

        prompt = f"""Theme: "{title}"
Total feedback items: {len(cluster_items)}
Affected segments: {segment_breakdown or "N/A"}
Urgency (avg): {stats.get("avg_urgency", "N/A")}

Representative quotes:
{quotes_text}

Write a 2-3 sentence summary of this theme for a senior PM. Focus on:
1. The core customer problem
2. Which segments feel it most
3. The business risk if left unaddressed"""

        try:
            response = await self.llm.generate(
                prompt=prompt,
                system_prompt=THEME_SUMMARY_SYSTEM_PROMPT,
                temperature=0.3,
                max_tokens=300,
            )
            return response.content.strip()
        except Exception as e:
            logger.error(f"Theme summary generation failed: {e}")
            return f"Theme '{title}' contains {len(cluster_items)} related feedback items."

    # ------------------------------------------------------------------ #
    # Scoring helpers
    # ------------------------------------------------------------------ #

    def _score_urgency(self, items: List[Any], stats: Dict) -> float:
        """Derive urgency from avg_urgency scores + complaint/bug ratio."""
        avg = stats.get("avg_urgency")
        if avg is not None:
            return float(avg)

        categories = stats.get("categories", {})
        urgent_count = (
            categories.get("bug", 0)
            + categories.get("complaint", 0)
            + categories.get("tech_debt", 0)
        )
        ratio = urgent_count / max(len(items), 1)
        return min(ratio * 1.5, 1.0)

    def _score_impact(self, total_arr: float, feedback_count: int) -> float:
        """Combine ARR and volume into a 0-1 impact score."""
        arr_score = min(total_arr / 1_000_000, 1.0)       # $1M ARR → 1.0
        volume_score = min(feedback_count / 50.0, 1.0)    # 50 items → 1.0
        return round((arr_score * 0.7 + volume_score * 0.3), 3)

    def _calc_arr(
        self, cluster_items: List[Any], accounts: Dict[int, Any]
    ) -> tuple[float, int]:
        """Sum ARR for unique accounts represented in a cluster."""
        seen_accounts = set()
        total = 0.0
        for item in cluster_items:
            aid = getattr(item, "account_id", None)
            if aid and aid not in seen_accounts and aid in accounts:
                acct = accounts[aid]
                seen_accounts.add(aid)
                arr = getattr(acct, "arr", None) or getattr(acct, "mrr", 0) * 12 or 0
                total += arr
        return total, len(seen_accounts)
