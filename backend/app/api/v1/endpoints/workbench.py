"""
Workbench Endpoints
Powers the Decision Workbench 3-pane experience:
- Context pull (themes + feedback relevant to objective)
- Option generation (AI-proposed roadmap options)
- Persona votes (digital twins vote on options)
- Copilot chat (RAG-backed Q&A with citations)
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from loguru import logger

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_tenant_id, get_tenant_llm_config
from app.models.feedback import Feedback
from app.models.theme import Theme
from app.models.persona import Persona
from app.services.llm_service import get_llm_service, DECISION_OPTIONS_SYSTEM_PROMPT
from app.services.persona_service import PersonaService
from app.core.citations import CitationSourceType, Citation

router = APIRouter()


# ── Request / Response schemas ─────────────────────────────────────────────

class ContextRequest(BaseModel):
    objective: str
    segments: List[str] = []
    time_horizon: str = ""


class GenerateOptionsRequest(BaseModel):
    objective: str
    segments: List[str] = []
    time_horizon: str = ""
    constraints: str = ""
    theme_ids: List[int] = []


class PersonaVotesRequest(BaseModel):
    options: List[Dict[str, Any]]  # [{id, title, description}]


class ChatRequest(BaseModel):
    message: str
    context: Dict[str, Any] = {}


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.post("/context")
async def get_workbench_context(
    req: ContextRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Auto-pull themes and top feedback relevant to the PM's stated objective.
    This is Step 2 of the workbench flow.
    """
    # Fetch all themes for this tenant
    theme_query = select(Theme).where(Theme.tenant_id == tenant_id)
    if req.segments:
        # Filter themes that affect requested segments (using JSON overlap)
        pass  # TODO: add segment filter on affected_segments array column

    theme_result = await db.execute(
        theme_query.order_by(Theme.total_arr.desc()).limit(10)
    )
    themes = theme_result.scalars().all()

    # Fetch top feedback items
    feedback_query = select(Feedback).where(Feedback.tenant_id == tenant_id)
    if req.segments:
        from sqlalchemy import or_
        feedback_query = feedback_query.where(
            or_(*[Feedback.customer_segment == s for s in req.segments])
        )
    feedback_result = await db.execute(
        feedback_query.order_by(Feedback.urgency_score.desc().nullslast()).limit(20)
    )
    feedback_items = feedback_result.scalars().all()

    # Serialize
    themes_out = [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "summary": t.summary,
            "feedback_count": t.feedback_count,
            "account_count": t.account_count,
            "total_arr": t.total_arr,
            "urgency_score": t.urgency_score,
            "impact_score": t.impact_score,
            "affected_segments": t.affected_segments or [],
            "key_quotes": t.key_quotes or [],
            "citations": [
                {
                    "source_type": "theme",
                    "source_id": t.id,
                    "confidence": t.confidence_score or 0.8,
                    "metadata": {
                        "title": t.title,
                        "feedback_count": t.feedback_count,
                        "total_arr": t.total_arr,
                    },
                }
            ],
        }
        for t in themes
    ]

    feedback_out = [
        {
            "id": f.id,
            "content": f.content,
            "customer_name": f.customer_name,
            "customer_segment": f.customer_segment,
            "category": f.category.value if f.category else None,
            "urgency_score": f.urgency_score,
        }
        for f in feedback_items
    ]

    return {
        "themes": themes_out,
        "feedback": feedback_out,
        "total_themes": len(themes_out),
        "total_feedback": len(feedback_out),
    }


@router.post("/generate-options")
async def generate_options(
    req: GenerateOptionsRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    tenant_config = Depends(get_tenant_llm_config),
):
    """
    AI-generate 2-3 roadmap options for the decision objective.
    Each option includes pros/cons, segment impact, ARR upside, and citations.
    This is Step 3 of the workbench flow.
    """
    # Validate LLM configuration
    import os
    if not tenant_config:
        if not os.getenv('OPENAI_API_KEY') and not os.getenv('ANTHROPIC_API_KEY'):
            logger.error("No LLM configuration available for option generation")
            raise HTTPException(
                status_code=400,
                detail="LLM configuration required. Please configure your API keys in Settings > LLM Settings before generating options."
            )
        logger.warning("No tenant LLM config, falling back to environment variables")
    # Fetch requested themes
    themes = []
    if req.theme_ids:
        theme_result = await db.execute(
            select(Theme).where(
                Theme.id.in_(req.theme_ids),
                Theme.tenant_id == tenant_id,
            )
        )
        themes = theme_result.scalars().all()

    if not themes:
        # Fall back to top themes by ARR
        theme_result = await db.execute(
            select(Theme)
            .where(Theme.tenant_id == tenant_id)
            .order_by(Theme.total_arr.desc())
            .limit(5)
        )
        themes = theme_result.scalars().all()

    # Build context for LLM
    themes_context = "\n".join(
        f"- Theme: {t.title} | ARR: ${t.total_arr:,.0f} | Urgency: {t.urgency_score:.2f} | "
        f"Segments: {', '.join(t.affected_segments or [])}\n  Summary: {t.summary or t.description or ''}"
        for t in themes
    )

    segments_str = ", ".join(req.segments) if req.segments else "all segments"
    constraints_str = f"\n\nConstraints from PM: {req.constraints}" if req.constraints else ""

    prompt = f"""A senior PM needs to make a roadmap decision.

Objective: {req.objective}
Target segments: {segments_str}
Time horizon: {req.time_horizon}{constraints_str}

Available themes from customer data:
{themes_context}

Generate 3 distinct strategic roadmap options. Each option should be a coherent strategic approach with a memorable name.

Respond with JSON:
{{
  "options": [
    {{
      "id": "option_a",
      "title": "<3-5 word option name, e.g. 'Enterprise-First'>",
      "description": "<2-3 sentence description of this strategic direction>",
      "pros": ["<pro 1>", "<pro 2>", "<pro 3>"],
      "cons": ["<con 1>", "<con 2>", "<con 3>"],
      "segments_served": ["<segment>"],
      "arr_upside": <estimated ARR upside as integer>,
      "risk_level": "<low|medium|high>",
      "theme_ids": [<theme id integers this option addresses>]
    }}
  ],
  "recommendation": "option_a",
  "recommendation_reasoning": "<1-2 sentence explanation>"
}}"""

    try:
        llm = get_llm_service(tenant_config=tenant_config)
        result = await llm.generate_structured(
            prompt=prompt,
            response_format={
                "options": [],
                "recommendation": "",
                "recommendation_reasoning": "",
            },
            system_prompt=DECISION_OPTIONS_SYSTEM_PROMPT,
        )
    except Exception as e:
        logger.error(f"Option generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Option generation failed: {str(e)}")

    # Attach citations to each option
    theme_citation_map = {t.id: t for t in themes}
    options = result.get("options", [])

    for opt in options:
        theme_ids_for_option = opt.pop("theme_ids", [])
        opt["citations"] = [
            {
                "source_type": "theme",
                "source_id": tid,
                "confidence": 0.85,
                "metadata": {
                    "title": theme_citation_map[tid].title if tid in theme_citation_map else f"Theme {tid}",
                    "feedback_count": theme_citation_map[tid].feedback_count if tid in theme_citation_map else 0,
                    "total_arr": theme_citation_map[tid].total_arr if tid in theme_citation_map else 0,
                },
            }
            for tid in theme_ids_for_option
            if tid in theme_citation_map
        ]

    return {
        "options": options,
        "recommendation": result.get("recommendation"),
        "recommendation_reasoning": result.get("recommendation_reasoning"),
        "themes_used": len(themes),
    }


@router.post("/persona-votes")
async def get_persona_votes(
    req: PersonaVotesRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    tenant_config = Depends(get_tenant_llm_config),
):
    """
    Have all persona digital twins vote on the proposed options.
    Returns a vote matrix with confidence scores for each persona × option.
    This is Step 5 of the workbench flow.
    """
    # Validate LLM configuration
    import os
    if not tenant_config:
        if not os.getenv('OPENAI_API_KEY') and not os.getenv('ANTHROPIC_API_KEY'):
            logger.error("No LLM configuration available for persona voting")
            raise HTTPException(
                status_code=400,
                detail="LLM configuration required. Please configure your API keys in Settings > LLM Settings before using persona voting."
            )
        logger.warning("No tenant LLM config, falling back to environment variables")
    # Fetch only active personas for this tenant
    persona_result = await db.execute(
        select(Persona).where(
            Persona.tenant_id == tenant_id,
            Persona.status == 'advisor'
        ).limit(6)
    )
    personas = persona_result.scalars().all()

    if not personas:
        return {"votes": [], "message": "No active personas found. Activate personas from the Personas page first."}

    persona_service = PersonaService(tenant_config=tenant_config)

    # Parallelize voting: run all persona votes concurrently
    async def vote_for_persona(persona):
        """Helper to get vote result for a single persona"""
        try:
            vote_result = await persona_service.vote_on_options(
                persona=persona,
                options=req.options,
            )
            return {
                "persona_name": vote_result.persona_name,
                "segment": vote_result.segment,
                "votes": vote_result.votes,
                "top_choice": vote_result.top_choice,
                "confidence": vote_result.confidence,
            }
        except Exception as e:
            logger.warning(f"Persona voting failed for {persona.name}: {e}")
            return None

    # Execute all votes in parallel using asyncio.gather()
    import asyncio
    vote_results = await asyncio.gather(*[vote_for_persona(p) for p in personas])

    # Filter out None results (failed votes)
    votes = [v for v in vote_results if v is not None]

    # Aggregate: which option is most popular
    option_tally: Dict[str, float] = {}
    for v in votes:
        for vote in v.get("votes", []):
            oid = vote.get("option_id", "")
            option_tally[oid] = option_tally.get(oid, 0) + vote.get("score", 0)

    recommended_option = max(option_tally.items(), key=lambda x: x[1])[0] if option_tally else None

    return {
        "votes": votes,
        "recommended_option": recommended_option,
        "option_scores": option_tally,
    }


@router.post("/chat")
async def workbench_chat(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    tenant_config = Depends(get_tenant_llm_config),
):
    """
    AI Copilot chat endpoint - RAG-backed Q&A over the product knowledge graph.
    Every response includes citations back to source data.
    """
    # Validate LLM configuration
    import os
    if not tenant_config:
        if not os.getenv('OPENAI_API_KEY') and not os.getenv('ANTHROPIC_API_KEY'):
            logger.error("No LLM configuration available for workbench chat")
            raise HTTPException(
                status_code=400,
                detail="LLM configuration required. Please configure your API keys in Settings > LLM Settings before using the chat feature."
            )
        logger.warning("No tenant LLM config, falling back to environment variables")
    # Gather context: themes and feedback from the workbench state
    context_parts = []
    citations = []

    # Load themes if theme_ids provided
    theme_ids = req.context.get("theme_ids", [])
    if theme_ids:
        theme_result = await db.execute(
            select(Theme).where(
                Theme.id.in_(theme_ids),
                Theme.tenant_id == tenant_id,
            )
        )
        themes = theme_result.scalars().all()
        for t in themes:
            context_parts.append(
                f"Theme '{t.title}': {t.summary or t.description or ''} "
                f"(ARR: ${t.total_arr:,.0f}, Urgency: {t.urgency_score:.1f})"
            )
            citations.append({
                "source_type": "theme",
                "source_id": t.id,
                "confidence": 0.9,
                "metadata": {"title": t.title, "total_arr": t.total_arr},
            })
    else:
        # Fall back to top themes
        theme_result = await db.execute(
            select(Theme)
            .where(Theme.tenant_id == tenant_id)
            .order_by(Theme.total_arr.desc())
            .limit(5)
        )
        themes = theme_result.scalars().all()
        for t in themes:
            context_parts.append(f"Theme '{t.title}': {t.summary or ''}")
            citations.append({
                "source_type": "theme",
                "source_id": t.id,
                "confidence": 0.8,
                "metadata": {"title": t.title, "total_arr": t.total_arr},
            })

    # Load top feedback
    feedback_result = await db.execute(
        select(Feedback)
        .where(Feedback.tenant_id == tenant_id)
        .order_by(Feedback.urgency_score.desc().nullslast())
        .limit(10)
    )
    feedback_items = feedback_result.scalars().all()
    for f in feedback_items:
        context_parts.append(
            f'Customer feedback [{f.customer_segment or "Unknown"}]: "{f.content[:200]}"'
        )
        citations.append({
            "source_type": "feedback",
            "source_id": f.id,
            "quote": f.content[:200],
            "confidence": 0.85,
            "metadata": {"segment": f.customer_segment},
        })

    # Objective context
    objective = req.context.get("objective", "")
    segments = req.context.get("segments", [])

    system_prompt = f"""You are an AI product copilot with access to a company's product knowledge graph.
Answer questions grounded ONLY in the provided data. Be specific and cite the data.
Current decision context: {objective or "General product exploration"}
Target segments: {', '.join(segments) if segments else 'All'}

IMPORTANT: Always cite specific themes, feedback, or accounts from the data. 
Never hallucinate metrics or facts not present in the provided context."""

    context_text = "\n".join(context_parts[:15])  # Limit context size
    full_prompt = f"""Context from your product knowledge graph:
{context_text}

Question: {req.message}

Answer based on the context above. Be concise (3-5 sentences). Cite specific themes and feedback."""

    try:
        llm = get_llm_service(tenant_config=tenant_config)
        response = await llm.generate(
            prompt=full_prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=600,
        )
        return {
            "content": response.content,
            "citations": citations[:5],  # Return top 5 most relevant citations
        }
    except Exception as e:
        logger.error(f"Copilot chat failed: {e}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")
