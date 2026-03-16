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
from app.models.decision import Decision, DecisionOption
from app.models.user import User
from app.services.llm_service import get_llm_service, DECISION_OPTIONS_SYSTEM_PROMPT_PM, DECISION_OPTIONS_SYSTEM_PROMPT_FOUNDER
from app.services.persona_service import PersonaService
from app.services.web_scraper import get_web_scraper
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
    # Flexible context selection
    use_internal_context: bool = False  # Pull from themes & feedback
    use_external_context: bool = False  # Pull from market research
    # Internal context (when use_internal_context=True)
    theme_ids: List[int] = []
    # External context (when use_external_context=True)
    market_data: Optional[Dict[str, Any]] = None
    product_name: Optional[str] = None
    product_description: Optional[str] = None


class PersonaVotesRequest(BaseModel):
    options: List[Dict[str, Any]]  # [{id, title, description}]
    generated_personas: Optional[List[Dict[str, Any]]] = None  # Use these personas instead of library personas


class ChatRequest(BaseModel):
    message: str
    context: Dict[str, Any] = {}


class PullInternetDataRequest(BaseModel):
    product_name: Optional[str] = ""  # Optional for pre-launch products
    product_description: Optional[str] = ""
    competitors: List[str] = []
    is_beyond_idea_phase: bool = False


class GeneratePersonasFromMarketRequest(BaseModel):
    market_data: Dict[str, Any]  # Contains scraped data
    product_name: Optional[str] = ""  # Optional for pre-launch products
    target_market: Optional[str] = ""


class IdeaValidatorRequest(BaseModel):
    product_idea: str
    target_market: Optional[str] = ""
    problem_solving: Optional[str] = ""
    unique_value_prop: Optional[str] = ""
    competitors: List[str] = []


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
    if not tenant_config:
        logger.error("No LLM configuration available for option generation")
        raise HTTPException(
            status_code=400,
            detail="LLM configuration required. Please configure your API keys in Settings > LLM Settings before generating options."
        )

    segments_str = ", ".join(req.segments) if req.segments else "all segments"
    constraints_str = f"\n\nConstraints: {req.constraints}" if req.constraints else ""

    # Build context based on selected sources
    themes = []
    themes_context = ""
    market_context = ""

    # Internal context: Fetch themes from knowledge base
    if req.use_internal_context:
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

        if themes:
            themes_context = f"""
INTERNAL CUSTOMER DATA (from your knowledge base):

Customer Themes:
{chr(10).join(f"- Theme: {t.title} | ARR: ${t.total_arr:,.0f} | Urgency: {t.urgency_score:.2f} | Segments: {', '.join(t.affected_segments or [])}{chr(10)}  Summary: {t.summary or t.description or ''}" for t in themes)}
"""

    # External context: Market data from Reddit
    if req.use_external_context and req.market_data:
        pain_points = req.market_data.get("customer_pain_points", [])
        feedback = req.market_data.get("product_feedback", [])
        trends = req.market_data.get("market_trends", [])
        opportunities = req.market_data.get("opportunities", [])

        market_context = f"""
EXTERNAL MARKET DATA (from Reddit research):

Customer Pain Points (from Reddit discussions):
{chr(10).join(f"- {p.get('pain_point', '')}: {p.get('description', '')} (Frequency: {p.get('frequency', 'unknown')})" for p in pain_points[:8])}

Market Feedback Themes:
{chr(10).join(f"- {f.get('text', '')[:150]}... (Score: {f.get('score', 0)})" for f in feedback[:5])}

Market Trends:
{chr(10).join(f"- {t.get('trend', '')}: {t.get('description', '')[:120]}..." for t in trends[:5])}

Opportunities:
{chr(10).join(f"- {o.get('opportunity', '')}: {o.get('description', '')[:120]}..." for o in opportunities[:5])}
"""

    # Build prompt based on available context
    context_description = []
    if req.use_internal_context and themes:
        context_description.append("internal customer data")
    if req.use_external_context and req.market_data:
        context_description.append("external market research")

    context_str = " and ".join(context_description) if context_description else "the decision objective"
    product_info = ""
    if req.use_external_context:
        product_identifier = req.product_name or req.product_description or "this product/idea"
        product_info = f"\nProduct: {product_identifier}"

    prompt = f"""Generate strategic decision options based on {context_str}.

Decision Objective: {req.objective}{product_info}
Target market: {segments_str}
Time horizon: {req.time_horizon}{constraints_str}
{themes_context}{market_context}

Generate 3 distinct strategic options. Each option should represent a different strategic direction.
Make the options realistic, actionable, and grounded in the available data.

Respond with JSON:
{{
  "options": [
    {{
      "id": "option_a",
      "title": "<3-5 word option name>",
      "description": "<2-3 sentence description of this strategic direction>",
      "pros": ["<pro 1>", "<pro 2>", "<pro 3>"],
      "cons": ["<con 1>", "<con 2>", "<con 3>"],
      "segments_served": ["<segment>"],
      "arr_upside": <estimated ARR upside as integer or 0 if unknown>,
      "risk_level": "<low|medium|high>",
      "theme_ids": [<theme id integers this option addresses, empty if no themes used>]
    }}
  ],
  "recommendation": "option_a",
  "recommendation_reasoning": "<1-2 sentence explanation>"
}}"""

    try:
        llm = get_llm_service(tenant_config=tenant_config)
        # Use context-appropriate system prompt
        # If using external context, use Founder-style prompt; otherwise use PM-style prompt
        system_prompt = DECISION_OPTIONS_SYSTEM_PROMPT_FOUNDER if req.use_external_context else DECISION_OPTIONS_SYSTEM_PROMPT_PM
        result = await llm.generate_structured(
            prompt=prompt,
            response_model={
                "options": [],
                "recommendation": "",
                "recommendation_reasoning": "",
            },
            system_prompt=system_prompt,
        )
    except Exception as e:
        logger.error(f"Option generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Option generation failed: {str(e)}")

    options = result.get("options", [])

    # Attach citations based on context sources used
    theme_citation_map = {t.id: t for t in themes} if themes else {}

    for opt in options:
        theme_ids_for_option = opt.pop("theme_ids", [])
        opt["citations"] = []

        # Add internal context citations (themes)
        if req.use_internal_context and theme_citation_map:
            for tid in theme_ids_for_option:
                if tid in theme_citation_map:
                    opt["citations"].append({
                        "source_type": "theme",
                        "source_id": tid,
                        "confidence": 0.85,
                        "metadata": {
                            "title": theme_citation_map[tid].title,
                            "feedback_count": theme_citation_map[tid].feedback_count,
                            "total_arr": theme_citation_map[tid].total_arr,
                        },
                    })

        # Add external context citations (market data)
        if req.use_external_context and req.market_data:
            opt["citations"].append({
                "source_type": "market_data",
                "source_id": "reddit",
                "confidence": 0.80,
                "metadata": {
                    "title": "Reddit Market Research",
                    "data_points": req.market_data.get("metadata", {}).get("total_data_points", 0),
                    "sources": ["Reddit discussions", "Customer pain points", "Market trends"],
                },
            })

    # Remove remaining theme_ids and citations processing below
    return {
        "options": options,
        "recommendation": result.get("recommendation"),
        "recommendation_reasoning": result.get("recommendation_reasoning"),
    }


@router.post("/persona-votes")
async def persona_votes(
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
    if not tenant_config:
            logger.error("No LLM configuration available for persona voting")
            raise HTTPException(
                status_code=400,
                detail="LLM configuration required. Please configure your API keys in Settings > LLM Settings before using persona voting."
            )

    # Use generated personas if provided (from market research), otherwise use library personas
    personas = []
    if req.generated_personas:
        # Convert generated persona dicts to Persona-like objects for voting
        for p_data in req.generated_personas:
            # Create a temporary Persona object with the generated data
            # Only use fields that exist in the Persona model
            persona = Persona(
                tenant_id=tenant_id,
                name=p_data.get("name", "Unknown Persona"),
                segment=p_data.get("segment", ""),
                persona_summary=p_data.get("persona_summary", ""),
                description=p_data.get("description", ""),
                key_pain_points=p_data.get("key_pain_points", []),
                buying_triggers=p_data.get("buying_triggers", []),
                feature_priorities=p_data.get("feature_priorities", []),
                company_size_range=p_data.get("company_size_range", ""),
                budget_authority_min=p_data.get("budget_authority_min"),
                budget_authority_max=p_data.get("budget_authority_max"),
                typical_decision_time_days=p_data.get("typical_decision_time_days"),
                status="advisor",  # Treat as advisor for voting
                extra_data=p_data,  # Store full generated data in extra_data
            )
            personas.append(persona)
    else:
        # Fetch only active personas from library
        persona_result = await db.execute(
            select(Persona).where(
                Persona.tenant_id == tenant_id,
                Persona.status == 'advisor'
            ).limit(6)
        )
        personas = persona_result.scalars().all()

    if not personas:
        return {"votes": [], "message": "No personas available. Either generate personas from market data or activate personas from the Personas page."}

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


@router.post("/pull-internet-data")
async def pull_internet_data(
    req: PullInternetDataRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    tenant_config = Depends(get_tenant_llm_config),
):
    """
    Founder Mode: Pull REAL data from internet sources (Reddit discussions, market signals)
    for the product, competitors, and alternatives.
    This is Step 2 of the founder workflow - uses actual web scraping via Reddit API.
    Product name is optional - can pull market data using just description for pre-launch products.
    """
    try:
        product_identifier = req.product_name or req.product_description or "product"
        logger.info(f"Pulling real market data for: {product_identifier}")

        # Get web scraper instance
        scraper = get_web_scraper()

        # Fetch real market data from Reddit and other sources
        market_data = await scraper.fetch_market_data(
            product_name=req.product_name or "",
            product_description=req.product_description or "",
            competitors=req.competitors,
            is_beyond_idea_phase=req.is_beyond_idea_phase
        )

        logger.info(f"Collected {market_data['metadata']['total_data_points']} real data points")

        return {
            "market_data": market_data,
            "sources_queried": market_data['metadata']['sources_queried'],
            "data_points_collected": market_data['metadata']['total_data_points'],
            "message": "Real market data collected from Reddit and other sources",
        }

    except Exception as e:
        logger.error(f"Internet data pull failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to pull market data: {str(e)}")


@router.post("/generate-personas-from-market")
async def generate_personas_from_market(
    req: GeneratePersonasFromMarketRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    tenant_config = Depends(get_tenant_llm_config),
):
    """
    Founder Mode: Generate personas from market data pulled from internet.
    This is Step 3 of the founder workflow.
    """
    # Validate LLM configuration
    if not tenant_config:
            logger.error("No LLM configuration available for persona generation")
            raise HTTPException(
                status_code=400,
                detail="LLM configuration required. Please configure your API keys in Settings > LLM Settings."
            )

    # Extract key data from market research
    market_data = req.market_data
    pain_points = market_data.get("customer_pain_points", [])
    feedback = market_data.get("product_feedback", [])
    trends = market_data.get("market_trends", [])

    # Build context for persona generation
    product_identifier = req.product_name or "this product/idea"
    context_summary = f"""Market Data Summary for {product_identifier}:

Customer Pain Points:
{chr(10).join(f"- {p.get('pain_point', '')} (Frequency: {p.get('frequency', 'unknown')}, Segment: {p.get('segment', 'unknown')})" for p in pain_points[:10])}

Customer Feedback Themes:
{chr(10).join(f"- {f.get('content', '')[:100]}... (Source: {f.get('source', 'unknown')}, Sentiment: {f.get('sentiment', 'unknown')})" for f in feedback[:10])}

Market Trends:
{chr(10).join(f"- {t.get('trend', '')}: {t.get('description', '')[:100]}..." for t in trends[:5])}"""

    prompt = f"""Based on market research data, generate 3-5 realistic customer personas for {req.product_name}.

{context_summary}

Generate personas as JSON:
{{
  "personas": [
    {{
      "name": "<Descriptive name, e.g. 'Enterprise IT Manager Emily'>",
      "segment": "<Customer segment>",
      "persona_summary": "<2-3 sentence summary of who they are>",
      "key_pain_points": ["<pain 1>", "<pain 2>", "<pain 3>"],
      "buying_triggers": ["<trigger 1>", "<trigger 2>"],
      "feature_priorities": ["<priority 1>", "<priority 2>", "<priority 3>"],
      "budget_authority_min": <number or null>,
      "budget_authority_max": <number or null>,
      "company_size_range": "<e.g. '50-200 employees'>",
      "typical_decision_time_days": <number>,
      "description": "<1-2 sentence description of their role>"
    }}
  ]
}}

Create diverse personas representing different segments of the target market."""

    try:
        llm = get_llm_service(tenant_config=tenant_config)
        result = await llm.generate_structured(
            prompt=prompt,
            response_model={"personas": []},
            system_prompt="You are a customer research expert creating data-driven personas from market research.",
        )

        personas = result.get("personas", [])

        # Return personas without saving to DB (for preview/voting)
        return {
            "personas": personas,
            "count": len(personas),
            "message": f"Generated {len(personas)} personas from market data",
        }
    except Exception as e:
        logger.error(f"Persona generation from market failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate personas: {str(e)}")


@router.post("/save-personas")
async def save_generated_personas(
    personas_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Save generated personas from Founder Mode to the database.
    Personas are saved with status='advisor' and marked as market-research-based.
    """
    try:
        personas_list = personas_data.get("personas", [])
        product_id = personas_data.get("product_id")  # Optional product association

        if not personas_list:
            raise HTTPException(status_code=400, detail="No personas provided")

        saved_personas = []

        for persona_dict in personas_list:
            # Map generated persona fields to database model
            persona = Persona(
                tenant_id=tenant_id,
                product_id=product_id,
                name=persona_dict.get("name"),
                description=persona_dict.get("description"),
                segment=persona_dict.get("segment"),
                company_size_range=persona_dict.get("company_size_range"),
                persona_summary=persona_dict.get("persona_summary", ""),
                key_pain_points=persona_dict.get("key_pain_points", []),
                buying_triggers=persona_dict.get("buying_triggers", []),
                feature_priorities=persona_dict.get("feature_priorities", []),
                budget_authority_min=persona_dict.get("budget_authority_min"),
                budget_authority_max=persona_dict.get("budget_authority_max"),
                typical_decision_time_days=persona_dict.get("typical_decision_time_days"),
                status="advisor",  # Set as active advisor
                based_on_feedback_count=0,  # Market-research based, not feedback-based
                confidence_score=0.7,  # Default confidence for market-research personas
                extra_data={
                    "source": "founder_workbench",
                    "generation_method": "market_research",
                }
            )

            db.add(persona)
            saved_personas.append(persona)

        await db.commit()

        # Refresh to get IDs
        for persona in saved_personas:
            await db.refresh(persona)

        logger.info(f"Saved {len(saved_personas)} personas from founder workbench for tenant {tenant_id}")

        return {
            "saved_count": len(saved_personas),
            "personas": [
                {
                    "id": p.id,
                    "name": p.name,
                    "segment": p.segment,
                    "status": p.status,
                }
                for p in saved_personas
            ],
            "message": f"Successfully saved {len(saved_personas)} personas to your persona library",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save personas: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save personas: {str(e)}")


@router.post("/validate-idea")
async def validate_idea(
    req: IdeaValidatorRequest,
    tenant_config = Depends(get_tenant_llm_config),
):
    """
    Idea Validator - Analyze product idea across 5 key dimensions using REAL market data:
    1. Market Demand (0-100) - validated against Reddit discussions
    2. Competition Level (0-100) - based on actual competitor mentions
    3. Differentiation Potential (0-100) - assessed from market gaps
    4. Monetization Viability (0-100) - informed by pricing discussions
    5. Execution Feasibility (0-100) - grounded in startup realities

    First fetches real market data from Reddit, then analyzes the idea.
    Returns structured validation report with scores and recommendations.
    """
    try:
        logger.info(f"Validating idea: {req.product_idea[:50]}...")

        # Step 1: Fetch real market data from Reddit
        scraper = get_web_scraper()
        market_data = await scraper.fetch_market_data(
            product_name=req.product_idea,
            product_description=req.problem_solving or "",
            competitors=req.competitors,
            is_beyond_idea_phase=False
        )

        logger.info(f"Fetched {market_data['metadata']['total_data_points']} market data points for validation")

        # Step 2: Analyze idea using LLM + real market data
        llm = get_llm_service(tenant_config=tenant_config)

        # Summarize market data for prompt
        feedback_summary = "\n".join([
            f"- {fb['text'][:150]}... (Score: {fb['score']}, Source: {fb['source']})"
            for fb in market_data['product_feedback'][:5]
        ])

        pain_points_summary = "\n".join([
            f"- {pp['pain_point']}: {pp['description'][:100]}..."
            for pp in market_data['customer_pain_points'][:5]
        ])

        trends_summary = "\n".join([
            f"- {t['trend']}: {t['description'][:100]}..."
            for t in market_data['market_trends'][:5]
        ])

        prompt = f"""Analyze this product idea using REAL market data from Reddit discussions:

**Product Idea:** {req.product_idea}

**Target Market:** {req.target_market or 'Not specified'}

**Problem Solving:** {req.problem_solving or 'Not specified'}

**Unique Value Proposition:** {req.unique_value_prop or 'Not specified'}

**Known Competitors:** {', '.join(req.competitors) if req.competitors else 'None specified'}

**REAL MARKET DATA FROM REDDIT:**

Real Customer Feedback:
{feedback_summary or 'No feedback found'}

Real Pain Points Discussed:
{pain_points_summary or 'No pain points identified'}

Market Trends:
{trends_summary or 'No trends identified'}

Competitor Mentions: {len(market_data['competitor_insights'])} mentions found
Opportunities Identified: {len(market_data['opportunities'])} opportunities

Provide a structured validation across 5 dimensions. For each dimension, provide:
- Score (0-100)
- Assessment (2-3 sentences)
- Key insights (3-5 bullet points)
- Recommendations (2-3 actionable suggestions)

Return as JSON:
{{
  "overall_score": <0-100>,
  "verdict": "<Go | Pivot | Stop>",
  "verdict_reasoning": "<2-3 sentences explaining the verdict>",
  "dimensions": [
    {{
      "name": "Market Demand",
      "score": <0-100>,
      "assessment": "<2-3 sentences>",
      "insights": ["<insight 1>", "<insight 2>", ...],
      "recommendations": ["<rec 1>", "<rec 2>", ...]
    }},
    {{
      "name": "Competition Level",
      "score": <0-100>,
      "assessment": "<2-3 sentences>",
      "insights": [...],
      "recommendations": [...]
    }},
    {{
      "name": "Differentiation Potential",
      "score": <0-100>,
      "assessment": "<2-3 sentences>",
      "insights": [...],
      "recommendations": [...]
    }},
    {{
      "name": "Monetization Viability",
      "score": <0-100>,
      "assessment": "<2-3 sentences>",
      "insights": [...],
      "recommendations": [...]
    }},
    {{
      "name": "Execution Feasibility",
      "score": <0-100>,
      "assessment": "<2-3 sentences>",
      "insights": [...],
      "recommendations": [...]
    }}
  ],
  "next_steps": ["<step 1>", "<step 2>", "<step 3>"],
  "red_flags": ["<flag 1>", "<flag 2>", ...],
  "opportunities": ["<opportunity 1>", "<opportunity 2>", ...]
}}

Be honest and critical. Provide actionable, specific feedback. Ground your analysis in the REAL market data provided."""

        result = await llm.generate_structured(
            prompt=prompt,
            response_model={
                "overall_score": 0,
                "verdict": "",
                "verdict_reasoning": "",
                "dimensions": [],
                "next_steps": [],
                "red_flags": [],
                "opportunities": [],
            },
            system_prompt="You are a startup advisor and product validation expert. Provide honest, critical analysis based on REAL market data, not assumptions. Ground your insights in the actual Reddit discussions and feedback provided.",
        )

        return {
            "validation": result,
            "market_data_sources": {
                "total_data_points": market_data['metadata']['total_data_points'],
                "sources": market_data['metadata']['sources_queried'],
                "timestamp": market_data['metadata']['timestamp'],
            },
            "message": "Idea validation complete using real market data",
        }

    except Exception as e:
        logger.error(f"Idea validation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to validate idea: {str(e)}")


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
    if not tenant_config:
            logger.error("No LLM configuration available for workbench chat")
            raise HTTPException(
                status_code=400,
                detail="LLM configuration required. Please configure your API keys in Settings > LLM Settings before using the chat feature."
            )
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


# ── Decision Management ────────────────────────────────────────────────────

class SaveDecisionRequest(BaseModel):
    objective: str
    segments: List[str] = []
    time_horizon: str = ""
    constraints: str = ""
    options: List[Dict[str, Any]] = []
    persona_votes: List[Dict[str, Any]] = []
    use_internal_context: bool = False
    use_external_context: bool = False


@router.post("/decisions")
async def save_decision(
    req: SaveDecisionRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    """
    Save a workbench decision with options and persona votes.
    Auto-called after persona voting completes.
    """
    try:
        # Create decision record
        decision = Decision(
            tenant_id=tenant_id,
            title=req.objective[:255] if req.objective else "Untitled Decision",
            objective=req.objective,
            target_segments=req.segments,
            time_horizon=req.time_horizon,
            constraints={"text": req.constraints} if req.constraints else None,
            created_by=current_user.id,
            extra_data={
                "use_internal_context": req.use_internal_context,
                "use_external_context": req.use_external_context,
            },
        )
        db.add(decision)
        await db.flush()  # Get decision.id

        # Create decision options with persona votes
        for opt_data in req.options:
            option = DecisionOption(
                tenant_id=tenant_id,
                decision_id=decision.id,
                title=opt_data.get("title", "")[:255],
                description=opt_data.get("description", ""),
                pros=opt_data.get("pros", []),
                cons=opt_data.get("cons", []),
                estimated_arr_impact=opt_data.get("arr_upside", 0),
                affected_segments=opt_data.get("segments_served", []),
                extra_data={
                    "risk_level": opt_data.get("risk_level", ""),
                    "option_id": opt_data.get("id", ""),
                },
            )
            
            # Attach persona votes to this option
            votes_for_option = [v for v in req.persona_votes if v.get("top_choice") == opt_data.get("id")]
            if votes_for_option:
                option.persona_votes = votes_for_option
                
            db.add(option)

        await db.commit()
        await db.refresh(decision)

        return {"id": decision.id, "message": "Decision saved successfully"}

    except Exception as e:
        logger.error(f"Failed to save decision: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save decision: {str(e)}")


@router.get("/decisions")
async def list_decisions(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    List all decisions for this tenant (for past decisions sidebar).
    """
    try:
        result = await db.execute(
            select(Decision)
            .where(Decision.tenant_id == tenant_id)
            .order_by(Decision.created_at.desc())
        )
        decisions = result.scalars().all()

        return [
            {
                "id": d.id,
                "objective": d.objective,
                "time_horizon": d.time_horizon,
                "use_internal_context": d.extra_data.get("use_internal_context", False) if d.extra_data else False,
                "use_external_context": d.extra_data.get("use_external_context", False) if d.extra_data else False,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in decisions
        ]

    except Exception as e:
        logger.error(f"Failed to list decisions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list decisions: {str(e)}")


@router.get("/decisions/{decision_id}")
async def get_decision(
    decision_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Get a specific decision with all options and persona votes.
    Used when clicking on a past decision.
    """
    try:
        result = await db.execute(
            select(Decision)
            .where(Decision.id == decision_id, Decision.tenant_id == tenant_id)
        )
        decision = result.scalar_one_or_none()

        if not decision:
            raise HTTPException(status_code=404, detail="Decision not found")

        # Get options
        options_result = await db.execute(
            select(DecisionOption)
            .where(DecisionOption.decision_id == decision_id)
        )
        options = options_result.scalars().all()

        # Extract all persona votes from options
        all_votes = []
        for opt in options:
            if opt.persona_votes:
                all_votes.extend(opt.persona_votes)

        return {
            "id": decision.id,
            "objective": decision.objective,
            "segments": decision.target_segments or [],
            "time_horizon": decision.time_horizon,
            "constraints": decision.constraints.get("text", "") if decision.constraints else "",
            "use_internal_context": decision.extra_data.get("use_internal_context", False) if decision.extra_data else False,
            "use_external_context": decision.extra_data.get("use_external_context", False) if decision.extra_data else False,
            "options": [
                {
                    "id": opt.extra_data.get("option_id", str(opt.id)) if opt.extra_data else str(opt.id),
                    "title": opt.title,
                    "description": opt.description,
                    "pros": opt.pros or [],
                    "cons": opt.cons or [],
                    "arr_upside": opt.estimated_arr_impact or 0,
                    "segments_served": opt.affected_segments or [],
                    "risk_level": opt.extra_data.get("risk_level", "medium") if opt.extra_data else "medium",
                }
                for opt in options
            ],
            "persona_votes": all_votes,
            "created_at": decision.created_at.isoformat() if decision.created_at else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get decision: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get decision: {str(e)}")
