"""
Theme Endpoints
Theme clustering, analysis, and management
Enhanced with capability-aware filtering
"""

from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.core.dependencies import get_current_tenant_id
from app.models.theme import Theme
from app.models.feedback import Feedback, FeedbackCategory
from app.models.knowledge_base import Capability
from app.models.context import ContextSource, ExtractedEntity, ContextProcessingStatus, EntityType
from app.schemas.theme import (
    ThemeCreate,
    ThemeUpdate,
    ThemeResponse,
    ThemeFilter,
    ThemeClusterRequest,
)

router = APIRouter()


@router.post("/", response_model=ThemeResponse, status_code=201)
async def create_theme(
    theme_data: ThemeCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Create a new theme manually"""
    theme = Theme(
        **theme_data.model_dump(),
        tenant_id=tenant_id,
    )
    db.add(theme)
    await db.commit()
    await db.refresh(theme)
    return theme


@router.get("/", response_model=List[ThemeResponse])
async def list_themes(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    product_ids: Optional[str] = Query(None, description="Comma-separated product IDs to filter by"),
    min_arr: Optional[float] = None,
    min_feedback_count: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """List themes with optional filters"""
    query = select(Theme).where(Theme.tenant_id == tenant_id)

    # Filter by product_ids if provided
    if product_ids:
        ids = [int(id.strip()) for id in product_ids.split(',') if id.strip()]
        if ids:
            query = query.where(Theme.product_id.in_(ids))

    if min_arr is not None:
        query = query.where(Theme.total_arr >= min_arr)
    if min_feedback_count is not None:
        query = query.where(Theme.feedback_count >= min_feedback_count)

    query = query.offset(skip).limit(limit).order_by(Theme.total_arr.desc())

    result = await db.execute(query)
    themes = result.scalars().all()
    return themes


@router.get("/{theme_id}", response_model=ThemeResponse)
async def get_theme(
    theme_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Get a specific theme"""
    result = await db.execute(
        select(Theme).where(and_(Theme.id == theme_id, Theme.tenant_id == tenant_id))
    )
    theme = result.scalar_one_or_none()

    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")

    return theme


async def _filter_feedback_by_capabilities(
    feedback_items: List[Any],
    capabilities: List[Any],
    tenant_id: int,
    db: AsyncSession,
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
        tenant_id: Tenant ID for logging

    Returns:
        Filtered list of feedback items (excluding duplicates of existing features)
    """
    if not capabilities:
        return feedback_items

    from app.services.llm_service import get_llm_service_for_tenant
    import json
    import re

    # Get LLM service for tenant (will raise ValueError if not configured)
    try:
        llm_service = await get_llm_service_for_tenant(tenant_id, db)
    except ValueError as e:
        logger.warning(f"[Capability Filter] Cannot filter feedback: {e}. Returning all feedback.")
        return feedback_items  # Return all feedback if no LLM configured

    # Build capability context for LLM
    capability_list = []
    for cap in capabilities[:50]:  # Limit to first 50 to avoid token limits
        capability_list.append(f"- {cap.name}: {cap.description} (Category: {cap.category})")

    capability_context = "\n".join(capability_list)

    filtered_feedback = []

    # Batch process feedback in groups
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
        prompt = f"""You are analyzing customer feedback for a product with these existing capabilities:

EXISTING CAPABILITIES:
{capability_context}

CUSTOMER FEEDBACK TO ANALYZE:
{feedback_batch_text}

For each feedback item, classify as:
- "duplicate" - requests a feature that ALREADY EXISTS
- "enhancement" - requests improvement to an existing capability
- "new" - requests a completely new feature

Return ONLY a JSON array:
[
  {{"id": 1, "classification": "duplicate", "reason": "Video conferencing exists"}},
  {{"id": 2, "classification": "enhancement", "reason": "Better screen sharing quality"}},
  {{"id": 3, "classification": "new", "reason": "AI transcription not in capabilities"}}
]

Be strict: only "duplicate" if feature fully exists. "enhancement" if improving existing. "new" for genuinely new features."""

        try:
            result = await llm_service.generate(
                prompt=prompt,
                temperature=0.2,
                max_tokens=1000,
                use_cheaper_model=True,  # Cost optimization: classification is simple task
            )

            # Parse JSON response
            json_match = re.search(r'\[.*\]', result.content, re.DOTALL)
            if json_match:
                classifications = json.loads(json_match.group(0))

                # Keep "enhancement" and "new", exclude "duplicate"
                for idx, classification in enumerate(classifications):
                    if idx < len(batch):
                        fb = batch[idx]
                        classification_type = classification.get('classification', 'new')
                        reason = classification.get('reason', '')

                        if classification_type in ['enhancement', 'new']:
                            filtered_feedback.append(fb)
                            print(
                                f"[Theme Generation] ✓ KEEPING feedback #{fb.id}: "
                                f"{classification_type} - {reason}"
                            )
                        else:
                            print(
                                f"[Theme Generation] ✗ EXCLUDING feedback #{fb.id}: "
                                f"duplicate - {reason}"
                            )
            else:
                print(f"[Theme Generation] Failed to parse classification, keeping batch {i}-{i+len(batch)}")
                filtered_feedback.extend(batch)

        except Exception as e:
            print(f"[Theme Generation] Error classifying feedback batch: {e}")
            filtered_feedback.extend(batch)

    return filtered_feedback


async def auto_generate_themes(tenant_id: int, db: AsyncSession, last_refresh_timestamp=None):
    """
    Automatically generate/update themes from feedback using semantic clustering.
    Themes represent what feedback is about (e.g., "Mobile Performance", "Authentication"),
    not just the category (bug, feature_request, etc.)

    Enhanced with capability-aware filtering: feedback requesting existing features
    will be filtered out, but enhancement requests will be kept.

    Args:
        tenant_id: The tenant ID
        db: Database session
        last_refresh_timestamp: Optional datetime - if provided, only process feedback created after this time

    Returns:
        dict with 'status' and 'message' keys
    """
    import logging
    from app.services.embedding_service import EmbeddingService, cosine_similarity
    from collections import Counter
    from sqlalchemy import func

    logger = logging.getLogger(__name__)
    logger.info(f"[Theme Generation] Starting theme generation for tenant {tenant_id}")

    # Build queries for both legacy feedback and new context sources
    feedback_query = select(Feedback).where(Feedback.tenant_id == tenant_id)
    context_query = select(ContextSource).where(
        ContextSource.tenant_id == tenant_id,
        ContextSource.status == ContextProcessingStatus.COMPLETED
    )

    # If incremental refresh, only get items created after last refresh
    if last_refresh_timestamp:
        feedback_query = feedback_query.where(Feedback.created_at > last_refresh_timestamp)
        context_query = context_query.where(ContextSource.created_at > last_refresh_timestamp)
        logger.info(f"[Theme Generation] Incremental refresh: processing data after {last_refresh_timestamp}")

        # Check if there's any new data
        feedback_count_result = await db.execute(
            select(func.count(Feedback.id))
            .where(Feedback.tenant_id == tenant_id)
            .where(Feedback.created_at > last_refresh_timestamp)
        )
        context_count_result = await db.execute(
            select(func.count(ContextSource.id))
            .where(ContextSource.tenant_id == tenant_id)
            .where(ContextSource.status == ContextProcessingStatus.COMPLETED)
            .where(ContextSource.created_at > last_refresh_timestamp)
        )
        new_feedback_count = feedback_count_result.scalar()
        new_context_count = context_count_result.scalar()

        if new_feedback_count == 0 and new_context_count == 0:
            logger.info(f"[Theme Generation] No new data since last refresh")
            return {"status": "up_to_date", "message": "No new data to process"}

    # Get feedback and context sources for clustering
    feedback_result = await db.execute(feedback_query)
    all_feedback = list(feedback_result.scalars().all())

    context_result = await db.execute(context_query)
    all_context_sources = list(context_result.scalars().all())

    # Combine feedback from both sources
    combined_items = all_feedback + all_context_sources

    if len(combined_items) < 3:
        logger.warning(f"[Theme Generation] Not enough data ({len(combined_items)}) to generate themes")
        if last_refresh_timestamp:
            return {"status": "up_to_date", "message": "Not enough new data for theme generation"}
        return {"status": "no_data", "message": "Not enough data available"}

    logger.info(f"[Theme Generation] Processing {len(all_feedback)} feedback items + {len(all_context_sources)} context sources")

    # Fetch existing capabilities from knowledge base
    from app.models.knowledge_base import Capability
    capability_result = await db.execute(
        select(Capability).where(Capability.tenant_id == tenant_id)
    )
    existing_capabilities = capability_result.scalars().all()

    if existing_capabilities:
        logger.info(f"[Theme Generation] Found {len(existing_capabilities)} existing capabilities - will filter duplicates")

        # Filter feedback against existing capabilities
        all_feedback = await _filter_feedback_by_capabilities(
            all_feedback, existing_capabilities, tenant_id, db
        )

        logger.info(f"[Theme Generation] After capability filtering: {len(all_feedback)} feedback items remain")

        if len(all_feedback) < 3:
            logger.warning(f"[Theme Generation] Not enough feedback after filtering ({len(all_feedback)})")
            return {"status": "no_data", "message": "Not enough feedback after filtering against existing capabilities"}

    # Generate embeddings for all feedback
    embedding_service = EmbeddingService()
    feedback_embeddings = []
    feedback_items = []

    for fb in all_feedback:
        text = f"{fb.title} {fb.content or ''}"
        try:
            embedding = await embedding_service.embed_text(text)
            feedback_embeddings.append(embedding)
            feedback_items.append(fb)
        except Exception as e:
            print(f"[Theme Generation] Failed to embed feedback {fb.id}: {e}")
            continue

    if len(feedback_embeddings) < 3:
        print(f"[Theme Generation] Not enough valid embeddings ({len(feedback_embeddings)})")
        return

    # Simple clustering: group feedback with >75% similarity
    SIMILARITY_THRESHOLD = 0.75
    clusters = []
    assigned = set()

    for i, fb in enumerate(feedback_items):
        if i in assigned:
            continue

        # Start new cluster
        cluster = [i]
        assigned.add(i)

        # Find similar feedback
        for j in range(i + 1, len(feedback_items)):
            if j in assigned:
                continue

            similarity = cosine_similarity(feedback_embeddings[i], feedback_embeddings[j])
            if similarity >= SIMILARITY_THRESHOLD:
                cluster.append(j)
                assigned.add(j)

        # Only keep clusters with at least 2 items
        if len(cluster) >= 2:
            clusters.append(cluster)

    print(f"[Theme Generation] Found {len(clusters)} clusters")

    # Get existing themes for similarity matching (when doing incremental refresh)
    existing_themes = []
    existing_theme_embeddings = []
    if last_refresh_timestamp:
        # Don't delete themes during incremental refresh - we'll update them
        theme_result = await db.execute(
            select(Theme).where(Theme.tenant_id == tenant_id)
        )
        existing_themes = theme_result.scalars().all()

        # Generate embeddings for existing themes to check similarity
        embedding_service_for_themes = EmbeddingService()
        for theme in existing_themes:
            theme_text = f"{theme.title} {theme.summary or ''}"
            try:
                theme_embedding = await embedding_service_for_themes.embed_text(theme_text)
                existing_theme_embeddings.append(theme_embedding)
            except Exception as e:
                print(f"[Theme Generation] Failed to embed existing theme {theme.id}: {e}")
                existing_theme_embeddings.append(None)

        print(f"[Theme Generation] Will check against {len(existing_themes)} existing themes")
    else:
        # Full regeneration - delete old themes
        delete_result = await db.execute(
            select(Theme).where(Theme.tenant_id == tenant_id)
        )
        old_themes = delete_result.scalars().all()
        for theme in old_themes:
            await db.delete(theme)
        await db.commit()
        print(f"[Theme Generation] Deleted {len(old_themes)} old themes (full regeneration)")

    # Generate theme for each cluster
    from app.services.llm_service import get_llm_service_for_tenant

    # Get LLM service for tenant (will raise ValueError if not configured)
    try:
        llm_service = await get_llm_service_for_tenant(tenant_id, db)
    except ValueError as e:
        logger.error(f"[Theme Generation] Cannot generate themes: {e}")
        return {
            "status": "no_llm_config",
            "message": str(e),
            "themes_created": 0,
            "themes_updated": 0,
            "themes_deleted": 0
        }

    themes_created = 0
    themes_updated = 0
    THEME_SIMILARITY_THRESHOLD = 0.85  # High threshold for matching themes

    for cluster_idx, cluster_indices in enumerate(clusters):
        cluster_feedback = [feedback_items[i] for i in cluster_indices]

        # Collect feedback titles and content
        feedback_texts = []
        for fb in cluster_feedback:
            text = f"- {fb.title}"
            if fb.content:
                text += f": {fb.content[:100]}"  # Truncate long content
            feedback_texts.append(text)

        # Extract category distribution
        category_counts = Counter([fb.category.value if fb.category else 'unknown' for fb in cluster_feedback])
        primary_category = category_counts.most_common(1)[0][0] if category_counts else 'unknown'

        # Count unique accounts and calculate total ARR
        unique_account_ids = set(fb.account_id for fb in cluster_feedback if fb.account_id)
        unique_accounts = len(unique_account_ids)

        # Calculate total ARR from linked accounts
        total_arr = 0.0
        if unique_account_ids:
            from app.models.account import Account
            accounts_result = await db.execute(
                select(Account).where(Account.id.in_(unique_account_ids))
            )
            accounts = accounts_result.scalars().all()
            total_arr = sum(acc.arr for acc in accounts if acc.arr)

        # Calculate urgency score based on category distribution
        # Bugs and complaints are more urgent than feature requests
        urgency_weights = {'bug': 1.0, 'complaint': 0.9, 'feature_request': 0.6, 'question': 0.4, 'unknown': 0.5}
        total_weight = sum(urgency_weights.get(cat, 0.5) * count for cat, count in category_counts.items())
        urgency_score = min(total_weight / len(cluster_feedback), 1.0)

        # Calculate impact score based on number of accounts and feedback volume
        # More accounts + more feedback = higher impact
        impact_from_accounts = min(unique_accounts / 10.0, 0.6)  # Up to 0.6 from account count
        impact_from_volume = min(len(cluster_feedback) / 20.0, 0.4)  # Up to 0.4 from feedback count
        impact_score = min(impact_from_accounts + impact_from_volume, 1.0)

        # Generate theme title and summary using LLM
        prompt = f"""Analyze this cluster of related customer feedback and generate a concise theme.

Feedback items ({len(cluster_feedback)} total):
{chr(10).join(feedback_texts[:10])}

Generate:
1. A short theme title (2-4 words, e.g., "Mobile Performance", "Authentication Issues", "Pricing Concerns")
2. A one-sentence summary describing what customers want

Response format (JSON):
{{"title": "Theme Title", "summary": "One sentence summary of what customers need"}}"""

        try:
            llm_response = await llm_service.generate(
                prompt=prompt,
                temperature=0.3,
                max_tokens=200,
                use_cheaper_model=True,  # Cost optimization: theme labeling is simple task
            )
            response = llm_response.content

            # Parse JSON response
            import json
            import re
            print(f"[Theme Generation] LLM response: {response[:200]}")
            json_match = re.search(r'\{[^}]+\}', response)
            if json_match:
                theme_data = json.loads(json_match.group())
                title = theme_data.get('title', f'Theme {cluster_idx + 1}')
                summary = theme_data.get('summary', f'Cluster of {len(cluster_feedback)} related feedback items')
                print(f"[Theme Generation] Parsed theme: {title}")
            else:
                print(f"[Theme Generation] No JSON found in response, using defaults")
                title = f'Theme {cluster_idx + 1}'
                summary = f'Cluster of {len(cluster_feedback)} related feedback items'
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[Theme Generation] LLM generation failed: {e}, using defaults")
            title = f'Theme {cluster_idx + 1}'
            summary = f'Cluster of {len(cluster_feedback)} related feedback items'

        # Check if this cluster matches an existing theme (during incremental refresh)
        matched_existing_theme = None
        if last_refresh_timestamp and existing_themes:
            # Generate embedding for new cluster's theme
            cluster_theme_text = f"{title} {summary}"
            try:
                cluster_embedding = await embedding_service.embed_text(cluster_theme_text)

                # Check similarity against existing themes
                for idx, existing_theme in enumerate(existing_themes):
                    if existing_theme_embeddings[idx] is None:
                        continue

                    similarity = cosine_similarity(cluster_embedding, existing_theme_embeddings[idx])
                    if similarity >= THEME_SIMILARITY_THRESHOLD:
                        matched_existing_theme = existing_theme
                        print(f"[Theme Generation] Matched to existing theme '{existing_theme.title}' (similarity: {similarity:.2%})")
                        break
            except Exception as e:
                print(f"[Theme Generation] Failed to check theme similarity: {e}")

        if matched_existing_theme:
            # Update existing theme with new feedback data
            old_count = matched_existing_theme.feedback_count or 0
            new_total = old_count + len(cluster_feedback)

            matched_existing_theme.feedback_count = new_total
            matched_existing_theme.account_count = matched_existing_theme.account_count or 0 + unique_accounts
            matched_existing_theme.total_arr = (matched_existing_theme.total_arr or 0.0) + total_arr

            # Recalculate scores with weighted average (existing weight + new weight)
            existing_weight = old_count / (old_count + len(cluster_feedback))
            new_weight = len(cluster_feedback) / (old_count + len(cluster_feedback))

            matched_existing_theme.urgency_score = (
                (matched_existing_theme.urgency_score or 0) * existing_weight +
                urgency_score * new_weight
            )
            matched_existing_theme.impact_score = (
                (matched_existing_theme.impact_score or 0) * existing_weight +
                impact_score * new_weight
            )
            matched_existing_theme.confidence_score = min(0.5 + (new_total / 20), 0.95)

            # Append to summary
            if matched_existing_theme.summary:
                matched_existing_theme.summary = matched_existing_theme.summary + f" Updated with {len(cluster_feedback)} new feedback items."
            else:
                matched_existing_theme.summary = summary

            # Link feedback to this theme
            for fb in cluster_feedback:
                fb.theme_id = matched_existing_theme.id

            themes_updated += 1
            print(f"[Theme Generation] Updated theme: '{matched_existing_theme.title}' ({old_count} -> {new_total} feedback items, ${matched_existing_theme.total_arr:,.0f} ARR)")
        else:
            # Create new theme
            theme = Theme(
                tenant_id=tenant_id,
                title=title,
                description=summary,
                summary=summary,
                primary_category=primary_category,
                feedback_count=len(cluster_feedback),
                account_count=unique_accounts,
                total_arr=total_arr,
                urgency_score=urgency_score,
                impact_score=impact_score,
                confidence_score=min(0.5 + (len(cluster_feedback) / 20), 0.95),
            )
            db.add(theme)
            await db.flush()  # Flush to get theme.id before linking feedback

            # Link feedback to this theme
            for fb in cluster_feedback:
                fb.theme_id = theme.id

            themes_created += 1
            print(f"[Theme Generation] Created new theme: '{title}' ({len(cluster_feedback)} feedback items, ${total_arr:,.0f} ARR)")

    await db.commit()
    print(f"[Theme Generation] Theme generation complete: {themes_created} created, {themes_updated} updated")

    return {
        "status": "success",
        "message": f"Generated {themes_created} new themes, updated {themes_updated} existing themes from {len(clusters)} clusters",
        "themes_created": themes_created,
        "themes_updated": themes_updated,
        "clusters_processed": len(clusters),
        "feedback_processed": len(all_feedback)
    }


def _build_persona_context(personas: List[Any]) -> str:
    """Build persona context string for LLM prompt"""
    if not personas:
        return "No active personas defined (consider all user segments equally)"

    lines = []
    for persona in personas[:10]:  # Limit to 10 most important
        pain_points = persona.key_pain_points or []
        priorities = persona.feature_priorities or []
        lines.append(
            f"- {persona.name} ({persona.segment})\n"
            f"  Pain points: {', '.join(pain_points[:3]) if pain_points else 'None'}\n"
            f"  Priorities: {', '.join(priorities[:3]) if priorities else 'None'}"
        )
    return "\n".join(lines)


def _build_capability_context(capabilities: List[Any]) -> str:
    """Build capability context string for LLM prompt"""
    if not capabilities:
        return "No capabilities documented yet (all features are new)"

    lines = []
    for cap in capabilities[:30]:  # Limit to 30 most relevant
        description = cap.description[:100] if cap.description else "No description"
        category = f" [{cap.category}]" if cap.category else ""
        lines.append(f"- {cap.name}{category}: {description}")

    if len(capabilities) > 30:
        lines.append(f"... and {len(capabilities) - 30} more capabilities")

    return "\n".join(lines)


async def auto_generate_initiatives(tenant_id: int, db: AsyncSession):
    """
    Generate specific initiatives from themes.
    Breaks down each theme into 2-4 actionable initiatives.
    Context-aware: considers existing product capabilities and active personas.
    Returns dict with initiatives_created and initiatives_failed counts.
    """
    import logging
    from app.models.initiative import Initiative, InitiativeStatus, InitiativeEffort
    from app.models.persona import Persona
    from app.models.knowledge_base import Capability

    logger = logging.getLogger(__name__)
    logger.info(f"[Initiative Generation] Starting initiative generation for tenant {tenant_id}")

    # Track statistics
    initiatives_created = 0
    initiatives_failed = 0

    # Get all themes
    result = await db.execute(
        select(Theme).where(Theme.tenant_id == tenant_id)
    )
    themes = result.scalars().all()

    if not themes:
        logger.warning(f"[Initiative Generation] No themes found for tenant {tenant_id}")
        return {"initiatives_created": 0, "initiatives_failed": 0, "themes_processed": 0}

    logger.info(f"[Initiative Generation] Processing {len(themes)} themes")

    # Load active personas for context
    persona_result = await db.execute(
        select(Persona).where(
            Persona.tenant_id == tenant_id,
            Persona.status == 'active'  # Only active/prioritized personas
        )
    )
    active_personas = persona_result.scalars().all()
    logger.info(f"[Initiative Generation] Found {len(active_personas)} active personas")

    # Load existing product capabilities to avoid duplicates
    capability_result = await db.execute(
        select(Capability).where(Capability.tenant_id == tenant_id)
    )
    existing_capabilities = capability_result.scalars().all()
    logger.info(f"[Initiative Generation] Found {len(existing_capabilities)} existing capabilities")

    # Build context strings for LLM
    persona_context = _build_persona_context(active_personas)
    capability_context = _build_capability_context(existing_capabilities)

    logger.debug(f"[Initiative Generation] Persona context: {persona_context[:200]}...")
    logger.debug(f"[Initiative Generation] Capability context: {capability_context[:200]}...")

    # Delete old auto-generated initiatives (those in 'idea' status)
    delete_result = await db.execute(
        select(Initiative).where(
            and_(
                Initiative.tenant_id == tenant_id,
                Initiative.status == InitiativeStatus.IDEA
            )
        )
    )
    old_initiatives = delete_result.scalars().all()
    for init in old_initiatives:
        await db.delete(init)
    await db.commit()
    logger.info(f"[Initiative Generation] Deleted {len(old_initiatives)} old initiatives")

    from app.services.llm_service import get_llm_service_for_tenant

    # Get LLM service for tenant (will raise ValueError if not configured)
    try:
        llm_service = await get_llm_service_for_tenant(tenant_id, db)
    except ValueError as e:
        logger.error(f"[Initiative Generation] Cannot generate initiatives: {e}")
        return {
            "initiatives_created": 0,
            "initiatives_failed": len(themes),
            "error": str(e)
        }

    for theme in themes:
        # Generate initiatives for this theme using LLM
        prompt = f"""Break down this customer feedback theme into 2-4 specific, actionable product initiatives.

IMPORTANT: Thoughtfully analyze each initiative's PRIMARY business impact. Don't default to retention just because customers requested it - consider whether it truly prevents churn (retention), drives new revenue (growth), or has no direct user benefit (infrastructure).

Theme: {theme.title}
Description: {theme.description}
Based on: {theme.feedback_count} feedback items from {theme.account_count} customers
Urgency: {theme.urgency_score:.0%}, Impact: {theme.impact_score:.0%}

IMPORTANT CONTEXT:

Active Personas (prioritized user segments):
{persona_context}

Existing Product Capabilities (already released):
{capability_context}

INSTRUCTIONS:
- Do NOT generate initiatives for features that already exist in the capabilities list above
- If a requested feature already exists, you can suggest enhancements/improvements instead
- Prioritize initiatives that serve active personas listed above
- If an initiative would primarily benefit deactivated personas, set lower priority (backlog)
- If a capability matching this theme was recently released, consider marking status as "launched" instead of creating new initiatives

Generate 2-4 specific initiatives that address this theme. For EACH initiative, analyze:

1. **Status**: Based on urgency, existing capabilities, and business context, classify as:
   - "launched" - Feature already exists in capabilities list (check before creating new initiatives)
   - "in_progress" - Critical/urgent (urgency > 70%), should start immediately
   - "planned" - Important (urgency 40-70%), should be next quarter
   - "backlog" - Lower priority (urgency < 40%), future consideration
   - "cancelled" - If this addresses deactivated personas only or is no longer relevant

2. **Expected Outcomes**: Analyze the PRIMARY business impact carefully and choose the MOST APPROPRIATE category:

   A) **Retention Focus** - Set expected_retention_impact (0.01-0.20):
      - Fixes EXISTING customer pain points that cause churn
      - Improves satisfaction/stickiness for CURRENT users
      - Addresses complaints from users who already bought
      - Reduces frustration with existing workflows
      - Examples: Bug fixes, UX improvements, performance issues, missing features current users need
      - Values: 0.03-0.05 (small), 0.05-0.10 (medium), 0.10-0.20 (high)

   B) **Growth Focus** - Set expected_arr_impact (dollar estimate):
      - Unlocks NEW customer segments or markets (not existing users)
      - Enables enterprise deals or upsells
      - Drives new customer acquisition
      - Expansion revenue (premium tiers, add-ons)
      - Examples: Enterprise SSO, API access, white-labeling, integrations with popular platforms
      - Values: 25000-50000 (small), 50000-150000 (medium), 150000+ (large)

   C) **Infrastructure** - Set both to null:
      - Pure technical debt with NO direct user benefit
      - Backend optimizations that users don't notice
      - Developer tooling, CI/CD improvements
      - Database migrations, code refactoring
      - Examples: Test coverage, build system, code cleanup

   **DECISION RULES:**
   - Existing customers frustrated and might leave → RETENTION
   - Feature unlocks revenue from NEW customers → GROWTH
   - No direct user-facing benefit → INFRASTRUCTURE
   - Ask: "Who benefits most - existing users (retention) or new/upgrading customers (growth)?"
   - Don't default to retention just because customers requested it - consider if it's truly about keeping them vs acquiring new ones

Response format (JSON array):
[
  {{
    "title": "Initiative title (5-8 words)",
    "description": "What will be built and why (1-2 sentences)",
    "effort": "small|medium|large",
    "status": "launched|in_progress|planned|backlog|cancelled",
    "expected_retention_impact": 0.0-1.0 or null,
    "expected_arr_impact": estimated_dollars or null,
    "reasoning": "Brief explanation of status and outcome classification"
  }}
]

Examples:

RETENTION EXAMPLE:
{{
  "title": "Implement Advanced Search Filters",
  "description": "Add filtering by date, category, and status to improve user productivity.",
  "effort": "medium",
  "status": "planned",
  "expected_retention_impact": 0.08,
  "expected_arr_impact": null,
  "reasoning": "Retention focus: users frustrated by lack of search. 8% retention improvement expected."
}}

GROWTH EXAMPLE:
{{
  "title": "Enterprise SSO Integration",
  "description": "Add SAML/OAuth support for enterprise authentication.",
  "effort": "large",
  "status": "planned",
  "expected_retention_impact": null,
  "expected_arr_impact": 150000,
  "reasoning": "Growth focus: unlocks enterprise segment. $150k ARR from enterprise deals."
}}

INFRASTRUCTURE EXAMPLE:
{{
  "title": "Migrate to Microservices Architecture",
  "description": "Refactor monolith into microservices for better scalability.",
  "effort": "xlarge",
  "status": "backlog",
  "expected_retention_impact": null,
  "expected_arr_impact": null,
  "reasoning": "Infrastructure: technical architecture improvement with no immediate user benefit."
}}

MIXED EXAMPLE (appears to be retention but is actually growth):
{{
  "title": "Advanced Analytics Dashboard",
  "description": "Add custom reports and data export for power users.",
  "effort": "large",
  "status": "planned",
  "expected_retention_impact": null,
  "expected_arr_impact": 75000,
  "reasoning": "Growth focus: enterprise-requested feature that unlocks $75k in pending deals. While existing customers want it, primary benefit is closing new enterprise sales."
}}

IMPORTANT: Return empty array [] if all requested features already exist in capabilities.
Be thoughtful about retention vs growth - don't automatically default to retention!
"""

        try:
            llm_response = await llm_service.generate(
                prompt=prompt,
                temperature=0.4,
                max_tokens=1000,  # Increased for full JSON with reasoning
                use_cheaper_model=True,  # Cost optimization: initiative generation is structured task
            )
            response = llm_response.content

            logger.debug(f"[Initiative Generation] LLM raw response for theme '{theme.title}': {response[:500]}...")

            # Parse JSON response
            import json
            import re
            json_match = re.search(r'\[[\s\S]*\]', response)
            if json_match:
                initiatives_data = json.loads(json_match.group())
                logger.info(
                    f"[Initiative Generation] Parsed {len(initiatives_data)} initiatives "
                    f"from LLM for theme '{theme.title}'"
                )

                for init_data in initiatives_data[:4]:  # Limit to 4 initiatives per theme
                    title = init_data.get('title', f'Initiative for {theme.title}')
                    description = init_data.get('description', '')
                    effort_str = init_data.get('effort', 'medium').lower()

                    # Map effort string to enum
                    effort_map = {
                        'small': InitiativeEffort.SMALL,
                        'medium': InitiativeEffort.MEDIUM,
                        'large': InitiativeEffort.LARGE,
                        'xlarge': InitiativeEffort.XLARGE
                    }
                    effort = effort_map.get(effort_str, InitiativeEffort.MEDIUM)

                    # Map status string to enum (with fallback based on urgency)
                    status_str = init_data.get('status', '').lower()
                    status_map = {
                        'launched': InitiativeStatus.LAUNCHED,
                        'in_progress': InitiativeStatus.IN_PROGRESS,
                        'planned': InitiativeStatus.PLANNED,
                        'backlog': InitiativeStatus.BACKLOG,
                        'idea': InitiativeStatus.IDEA,
                        'cancelled': InitiativeStatus.CANCELLED,
                        'paused': InitiativeStatus.PAUSED,
                    }

                    # Default status based on theme urgency if not provided
                    if status_str in status_map:
                        status = status_map[status_str]
                    else:
                        urgency = theme.urgency_score or 0
                        if urgency > 0.7:
                            status = InitiativeStatus.IN_PROGRESS
                        elif urgency > 0.4:
                            status = InitiativeStatus.PLANNED
                        else:
                            status = InitiativeStatus.BACKLOG

                    # Skip creating initiatives that are already launched or cancelled
                    if status in [InitiativeStatus.LAUNCHED, InitiativeStatus.CANCELLED]:
                        logger.info(
                            f"[Initiative Generation] Skipping '{title}' - status={status.value} "
                            f"(feature exists or not relevant)"
                        )
                        continue

                    # Parse expected outcomes
                    expected_retention_impact = init_data.get('expected_retention_impact')
                    expected_arr_impact = init_data.get('expected_arr_impact')

                    # Log the AI reasoning for debugging
                    reasoning = init_data.get('reasoning', 'No reasoning provided')
                    logger.info(
                        f"[Initiative Generation] Creating '{title}' - "
                        f"Status: {status.value}, "
                        f"Retention: {expected_retention_impact}, "
                        f"ARR: {expected_arr_impact}, "
                        f"Reasoning: {reasoning}"
                    )

                    # Create initiative
                    initiative = Initiative(
                        tenant_id=tenant_id,
                        title=title,
                        description=description,
                        status=status,
                        effort=effort,
                        estimated_impact_score=theme.impact_score,
                        priority_score=theme.urgency_score * 100 if theme.urgency_score else 50,
                        expected_retention_impact=expected_retention_impact,
                        expected_arr_impact=expected_arr_impact,
                    )
                    db.add(initiative)

                    # Link initiative to theme
                    initiative.themes.append(theme)
                    initiatives_created += 1

                    logger.debug(f"[Initiative Generation] Created initiative: '{title}' for theme '{theme.title}'")

            else:
                logger.warning(
                    f"[Initiative Generation] No JSON found in LLM response for theme '{theme.title}'. "
                    f"Response was: {response[:300]}"
                )
                initiatives_failed += 1

        except json.JSONDecodeError as e:
            logger.error(
                f"[Initiative Generation] JSON parsing failed for theme '{theme.title}': {e}. "
                f"Raw response: {response[:500]}"
            )
            initiatives_failed += 1
            continue
        except Exception as e:
            logger.error(f"[Initiative Generation] Failed to generate initiatives for theme '{theme.title}': {e}", exc_info=True)
            initiatives_failed += 1
            continue

    await db.commit()

    logger.info(
        f"[Initiative Generation] Complete: {initiatives_created} created, "
        f"{initiatives_failed} failed out of {len(themes)} themes"
    )

    return {
        "initiatives_created": initiatives_created,
        "initiatives_failed": initiatives_failed,
        "themes_processed": len(themes)
    }


@router.get("/initiative-context-preview")
async def preview_initiative_context(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Preview the context that will be used for initiative generation.
    Useful for debugging why initiatives aren't being generated correctly.
    """
    from app.models.persona import Persona
    from app.models.knowledge_base import Capability

    # Load active personas
    persona_result = await db.execute(
        select(Persona).where(
            Persona.tenant_id == tenant_id,
            Persona.status == 'active'
        )
    )
    active_personas = persona_result.scalars().all()

    # Load existing capabilities
    capability_result = await db.execute(
        select(Capability).where(Capability.tenant_id == tenant_id)
    )
    existing_capabilities = capability_result.scalars().all()

    persona_context = _build_persona_context(active_personas)
    capability_context = _build_capability_context(existing_capabilities)

    return {
        "active_personas_count": len(active_personas),
        "capabilities_count": len(existing_capabilities),
        "persona_context": persona_context,
        "capability_context": capability_context,
        "personas": [
            {
                "id": p.id,
                "name": p.name,
                "segment": p.segment,
                "status": p.status,
            }
            for p in active_personas
        ],
        "capabilities": [
            {
                "id": c.id,
                "name": c.name,
                "category": c.category,
            }
            for c in existing_capabilities
        ],
    }


@router.post("/cluster")
async def cluster_feedback(
    request: ThemeClusterRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Trigger theme generation from feedback
    Automatically groups feedback by category
    """
    try:
        await auto_generate_themes(tenant_id, db)

        # Update last refresh timestamp
        from app.models.tenant import Tenant
        from sqlalchemy.orm import attributes
        from datetime import datetime

        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()

        if tenant:
            settings = tenant.settings or {}
            settings['theme_last_refresh_date'] = datetime.utcnow().isoformat() + 'Z'
            tenant.settings = settings
            attributes.flag_modified(tenant, 'settings')
            await db.commit()

        return {
            "success": True,
            "message": "Themes generated successfully from feedback",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clustering failed: {str(e)}")


@router.post("/refresh")
async def refresh_themes(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Refresh themes by regenerating from latest feedback (incremental refresh supported)
    Only processes new feedback since last refresh to optimize performance.
    """
    try:
        from app.models.tenant import Tenant
        from sqlalchemy.orm import attributes
        from datetime import datetime

        # Get tenant settings to check last refresh timestamp
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()

        last_refresh_timestamp = None
        if tenant and tenant.settings:
            last_refresh_str = tenant.settings.get('theme_last_refresh_date')
            if last_refresh_str:
                try:
                    # Parse ISO format timestamp and convert to naive datetime
                    # (database column is TIMESTAMP WITHOUT TIME ZONE)
                    last_refresh_timestamp = datetime.fromisoformat(last_refresh_str.replace('Z', '+00:00')).replace(tzinfo=None)
                    print(f"[Theme Refresh] Using incremental refresh from {last_refresh_timestamp}")
                except Exception as e:
                    print(f"[Theme Refresh] Could not parse last refresh timestamp: {e}")

        # Regenerate themes from feedback (incremental refresh)
        theme_result = await auto_generate_themes(tenant_id, db, last_refresh_timestamp)

        # Check if there was new data to process
        themes_up_to_date = theme_result.get("status") == "up_to_date"

        if theme_result.get("status") == "no_data":
            return {
                "success": False,
                "status": "no_data",
                "message": theme_result.get("message", "Not enough feedback data"),
            }

        # Always regenerate initiatives from themes (even if themes are up-to-date)
        # This ensures improvements to initiative generation logic are applied
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[Theme Refresh] Regenerating initiatives for tenant {tenant_id}")
        await auto_generate_initiatives(tenant_id, db)

        # Generate projects from initiatives
        logger.info(f"[Theme Refresh] Generating projects for tenant {tenant_id}")

        try:
            from app.services.project_service import ProjectService
            from app.services.priority_service import PriorityService

            project_service = ProjectService()
            priority_service = PriorityService()

            # Generate projects
            project_result = await project_service.generate_projects_for_initiatives(
                tenant_id=tenant_id,
                db=db,
            )

            # Calculate priorities
            await priority_service.calculate_priorities_for_tenant(tenant_id, db)

            logger.info(
                f"[Theme Refresh] Generated {project_result['projects_created']} projects "
                f"for {project_result['initiatives_processed']} initiatives"
            )
        except Exception as e:
            logger.error(f"[Theme Refresh] Project generation failed: {e}", exc_info=True)
            # Don't fail the whole refresh if project generation fails

        # Update last refresh timestamp (only if themes were actually updated)
        if tenant and not themes_up_to_date:
            settings = tenant.settings or {}
            settings['theme_last_refresh_date'] = datetime.utcnow().isoformat() + 'Z'
            tenant.settings = settings
            attributes.flag_modified(tenant, 'settings')
            await db.commit()

        # Prepare response message
        if themes_up_to_date:
            message = "Themes are up to date. Initiatives and projects regenerated with latest AI improvements."
        else:
            message = theme_result.get("message", "Themes, initiatives, and projects refreshed successfully")

        return {
            "success": True,
            "status": "refreshed",
            "message": message,
            "themes_created": theme_result.get("themes_created", 0),
            "themes_updated": theme_result.get("themes_updated", 0),
            "feedback_processed": theme_result.get("feedback_processed", 0),
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[Theme Refresh Error] {str(e)}")
        raise HTTPException(status_code=500, detail=f"Theme refresh failed: {str(e)}")


@router.post("/refresh-async")
async def refresh_themes_async(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Refresh themes asynchronously - returns immediately with job_id

    This endpoint starts a background job for theme refresh and returns
    immediately. Use GET /api/v1/jobs/{job_id} to check status.

    Suitable for large datasets (100s-1000s of feedback items) that
    may take minutes to process.
    """
    import logging
    from app.models.job import JobType
    from app.services.background_task_service import BackgroundTaskService
    from app.core.config import settings

    logger = logging.getLogger(__name__)

    try:
        # Create background job
        job = await BackgroundTaskService.create_job(
            tenant_id=tenant_id,
            user_id=None,  # Could get from JWT if available
            job_type=JobType.THEME_REFRESH,
            input_params={},
            db=db
        )

        logger.info(f"[Themes API] Created async refresh job {job.job_uuid} for tenant {tenant_id}")

        # Choose task queue based on configuration
        if settings.USE_CELERY:
            # Production: Use Celery (durable, survives restarts)
            from app.workers.theme_tasks import refresh_themes_task
            refresh_themes_task.delay(str(job.job_uuid), tenant_id)
            logger.info(f"[Themes API] Dispatched to Celery: {job.job_uuid}")
        else:
            # Development: Use asyncio (non-durable, simpler)
            from app.workers.theme_worker import refresh_themes_background
            BackgroundTaskService.run_in_background(
                refresh_themes_background(str(job.job_uuid), tenant_id)
            )
            logger.info(f"[Themes API] Running with asyncio (dev mode): {job.job_uuid}")

        return {
            "success": True,
            "job_id": str(job.job_uuid),
            "message": "Theme refresh started in background. Use GET /api/v1/jobs/{job_id} to check status.",
        }

    except Exception as e:
        logger.error(f"[Themes API] Failed to start async refresh: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start theme refresh: {str(e)}"
        )
