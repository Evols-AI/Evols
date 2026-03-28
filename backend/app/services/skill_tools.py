"""
Skill Tool Registry
Central registry of tools that skills can use
"""

from typing import Callable, Dict, Any, Optional, List
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from datetime import datetime, timedelta

from app.models.persona import Persona
from app.models.feedback import Feedback
from app.models.theme import Theme
from app.models.initiative import Initiative
from app.models.context import ContextSource, ExtractedEntity, EntityType
from app.models.user import User
from app.models.work_context import (
    WorkContext, ActiveProject, KeyRelationship, Task, WeeklyFocus,
    CapacityStatus, ProjectStatus, ProjectRole, TaskPriority, TaskStatus
)


class ToolParameter(BaseModel):
    """Tool parameter definition"""
    name: str
    type: str  # "string", "integer", "array", "boolean", "object"
    description: str
    required: bool = True
    enum: Optional[List[str]] = None
    items: Optional[Dict[str, Any]] = None  # For array types


class SkillTool(BaseModel):
    """Tool definition"""
    name: str
    description: str
    parameters: List[ToolParameter]
    handler: Any  # Will be the actual function


class ToolRegistry:
    """
    Central registry for skill tools.
    Tools are functions that skills can call to get data or perform actions.
    """

    def __init__(self):
        self._tools: Dict[str, SkillTool] = {}

    def register(
        self,
        name: str,
        description: str,
        parameters: List[ToolParameter]
    ):
        """Decorator to register a tool"""
        def decorator(func: Callable):
            tool = SkillTool(
                name=name,
                description=description,
                parameters=parameters,
                handler=func
            )
            self._tools[name] = tool
            return func
        return decorator

    def get_tool(self, name: str) -> Optional[SkillTool]:
        """Get a tool by name"""
        return self._tools.get(name)

    def get_all_tools(self) -> Dict[str, SkillTool]:
        """Get all registered tools"""
        return self._tools

    def get_tools_schema(self) -> List[Dict[str, Any]]:
        """Get OpenAI function calling schema for all tools"""
        schemas = []
        for tool in self._tools.values():
            schema = {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                }
            }

            for param in tool.parameters:
                prop = {
                    "type": param.type,
                    "description": param.description
                }
                if param.enum:
                    prop["enum"] = param.enum
                if param.items:
                    prop["items"] = param.items

                schema["function"]["parameters"]["properties"][param.name] = prop

                if param.required:
                    schema["function"]["parameters"]["required"].append(param.name)

            schemas.append(schema)

        return schemas

    async def execute_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        tenant_id: int,
        db: AsyncSession,
        product_id: Optional[int] = None,
        user_id: Optional[int] = None
    ) -> Any:
        """Execute a tool with automatic tenant isolation and optional product scoping"""
        from loguru import logger
        import inspect

        tool = self.get_tool(tool_name)
        if not tool:
            raise ValueError(f"Tool '{tool_name}' not found")

        # Get the function signature to check what parameters it accepts
        sig = inspect.signature(tool.handler)
        accepts_tenant_id = 'tenant_id' in sig.parameters
        accepts_user = 'user' in sig.parameters

        # Inject tenant_id or user depending on what the tool accepts
        if accepts_user and user_id is not None:
            # Work context tools use 'user' instead of 'tenant_id'
            # Load fresh user from database for each tool call to avoid detached session issues
            from app.models.user import User as UserModel
            from sqlalchemy import select

            result = await db.execute(select(UserModel).where(UserModel.id == user_id))
            user = result.scalar_one()

            arguments['user'] = user
            arguments['db'] = db
            logger.info(f"[ToolRegistry] Injecting user={user.id} into {tool_name}")
        elif accepts_tenant_id:
            # Regular tools use 'tenant_id'
            arguments['tenant_id'] = tenant_id
            arguments['db'] = db
        else:
            # Tool doesn't accept tenant_id or user, just inject db
            arguments['db'] = db

        # Inject product_id if provided and tool accepts it
        if product_id is not None:
            # Check if tool accepts product_id parameter
            tool_params = {param.name for param in tool.parameters}
            if 'product_id' in tool_params:
                logger.info(f"[ToolRegistry] Injecting product_id={product_id} into {tool_name}")
                arguments['product_id'] = product_id
            else:
                logger.warning(f"[ToolRegistry] Tool {tool_name} does not accept product_id parameter")
        else:
            logger.warning(f"[ToolRegistry] product_id is None for {tool_name}")

        return await tool.handler(**arguments)


# Create global registry instance
tool_registry = ToolRegistry()


# ===================================
# PERSONA TOOLS
# ===================================

@tool_registry.register(
    name="get_personas",
    description="Get all personas for the tenant with their vote counts",
    parameters=[
        ToolParameter(name="limit", type="integer", description="Maximum number of personas to return", required=False),
        ToolParameter(name="product_id", type="integer", description="Filter by product ID", required=False)
    ]
)
async def get_personas(tenant_id: int, db: AsyncSession, limit: Optional[int] = None, product_id: Optional[int] = None) -> Dict[str, Any]:
    """Get personas with vote counts"""
    query = select(Persona).where(Persona.tenant_id == tenant_id)

    if product_id:
        query = query.where(Persona.product_id == product_id)

    if limit:
        query = query.limit(limit)

    result = await db.execute(query)
    personas = result.scalars().all()

    return {
        "personas": [
            {
                "id": int(p.id),
                "name": str(p.name),
                "description": str(p.description) if p.description else "",
                "segment": str(p.segment) if p.segment else "",
                "total_votes": int(p.total_votes) if p.total_votes else 0
            }
            for p in personas
        ]
    }


@tool_registry.register(
    name="get_persona_by_id",
    description="Get detailed information about a specific persona",
    parameters=[
        ToolParameter(name="persona_id", type="integer", description="ID of the persona"),
        ToolParameter(name="product_id", type="integer", description="Filter by product ID", required=False)
    ]
)
async def get_persona_by_id(persona_id: int, tenant_id: int, db: AsyncSession, product_id: Optional[int] = None) -> Dict[str, Any]:
    """Get single persona details"""
    query = select(Persona).where(
        Persona.id == persona_id,
        Persona.tenant_id == tenant_id
    )

    if product_id:
        query = query.where(Persona.product_id == product_id)

    result = await db.execute(query)
    persona = result.scalar_one_or_none()

    if not persona:
        return {"error": "Persona not found"}

    return {
        "id": int(persona.id),
        "name": str(persona.name),
        "description": str(persona.description) if persona.description else "",
        "segment": str(persona.segment) if persona.segment else "",
        "pain_points": persona.pain_points if persona.pain_points else [],
        "goals": persona.goals if persona.goals else [],
        "behaviors": persona.behaviors if persona.behaviors else [],
        "total_votes": int(persona.total_votes) if persona.total_votes else 0
    }


# ===================================
# FEEDBACK TOOLS
# ===================================

@tool_registry.register(
    name="get_feedback_items",
    description="Get recent customer feedback and uploaded context sources (CSVs, documents, etc.)",
    parameters=[
        ToolParameter(name="limit", type="integer", description="Maximum number of items", required=False),
        ToolParameter(name="date_range", type="string", description="Date range", required=False, enum=["7d", "30d", "90d", "all"]),
        ToolParameter(name="product_id", type="integer", description="Filter by product ID", required=False)
    ]
)
async def get_feedback_items(
    tenant_id: int,
    db: AsyncSession,
    limit: Optional[int] = 50,
    date_range: Optional[str] = "all",
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Get customer feedback from uploaded context sources"""
    from app.models.context import ContextProcessingStatus

    query = select(ContextSource).where(
        ContextSource.tenant_id == tenant_id,
        ContextSource.status == ContextProcessingStatus.COMPLETED
    )

    if product_id:
        query = query.where(ContextSource.product_id == product_id)

    # Apply date filter
    if date_range and date_range != "all":
        days_map = {"7d": 7, "30d": 30, "90d": 90}
        days = days_map.get(date_range, 30)
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.where(ContextSource.created_at >= cutoff)

    query = query.order_by(ContextSource.created_at.desc())

    if limit:
        query = query.limit(limit)

    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "feedback_items": [
            {
                "id": int(item.id),
                "content": str(item.content)[:500] if item.content else "",
                "source": str(item.name) if item.name else str(item.source_type.value) if item.source_type else "unknown",
                "source_type": str(item.source_type.value) if item.source_type else "unknown",
                "customer_segment": str(item.customer_segment) if item.customer_segment else None,
                "sentiment_score": float(item.sentiment_score) if item.sentiment_score is not None else 0.0,
                "created_at": item.created_at.isoformat() if item.created_at else None
            }
            for item in items
        ],
        "total_count": len(items)
    }


@tool_registry.register(
    name="get_feedback_summary",
    description="Get summary statistics about customer feedback and uploaded context sources",
    parameters=[
        ToolParameter(name="date_range", type="string", description="Date range", required=False, enum=["7d", "30d", "90d", "all"]),
        ToolParameter(name="product_id", type="integer", description="Filter by product ID", required=False)
    ]
)
async def get_feedback_summary(
    tenant_id: int,
    db: AsyncSession,
    date_range: Optional[str] = "30d",
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Get feedback summary stats from context sources"""
    from app.models.context import ContextProcessingStatus

    query = select(ContextSource).where(
        ContextSource.tenant_id == tenant_id,
        ContextSource.status == ContextProcessingStatus.COMPLETED
    )

    if product_id:
        query = query.where(ContextSource.product_id == product_id)

    # Apply date filter
    if date_range and date_range != "all":
        days_map = {"7d": 7, "30d": 30, "90d": 90}
        days = days_map.get(date_range, 30)
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.where(ContextSource.created_at >= cutoff)

    result = await db.execute(query)
    items = result.scalars().all()

    # Calculate sentiment distribution based on sentiment_score
    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
    for item in items:
        if item.sentiment_score is not None:
            if item.sentiment_score > 0.2:
                sentiment_counts["positive"] += 1
            elif item.sentiment_score < -0.2:
                sentiment_counts["negative"] += 1
            else:
                sentiment_counts["neutral"] += 1

    return {
        "total_feedback": int(len(items)),
        "date_range": str(date_range) if date_range else "all",
        "sentiment_distribution": sentiment_counts
    }


# ===================================
# THEME TOOLS
# ===================================

@tool_registry.register(
    name="get_themes",
    description="Get customer feedback themes/clusters",
    parameters=[
        ToolParameter(name="limit", type="integer", description="Maximum number of themes", required=False),
        ToolParameter(name="product_id", type="integer", description="Filter by product ID", required=False)
    ]
)
async def get_themes(tenant_id: int, db: AsyncSession, limit: Optional[int] = None, product_id: Optional[int] = None) -> Dict[str, Any]:
    """Get themes"""
    query = select(Theme).where(Theme.tenant_id == tenant_id)

    if product_id:
        query = query.where(Theme.product_id == product_id)

    query = query.order_by(Theme.feedback_count.desc())

    if limit:
        query = query.limit(limit)

    result = await db.execute(query)
    themes = result.scalars().all()

    return {
        "themes": [
            {
                "id": int(theme.id),
                "label": str(theme.label) if theme.label else "",
                "description": str(theme.description) if theme.description else "",
                "feedback_count": int(theme.feedback_count) if theme.feedback_count else 0,
                "sentiment_avg": float(theme.sentiment_avg) if theme.sentiment_avg is not None else 0.0
            }
            for theme in themes
        ]
    }


# ===================================
# FEATURE TOOLS
# ===================================

@tool_registry.register(
    name="get_features",
    description="Get product initiatives/features with their scores",
    parameters=[
        ToolParameter(name="status", type="string", description="Filter by status", required=False, enum=["idea", "backlog", "planned", "in_progress", "launched"]),
        ToolParameter(name="limit", type="integer", description="Maximum number of features", required=False),
        ToolParameter(name="product_id", type="integer", description="Filter by product ID", required=False)
    ]
)
async def get_features(
    tenant_id: int,
    db: AsyncSession,
    status: Optional[str] = None,
    limit: Optional[int] = None,
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Get initiatives/features"""
    query = select(Initiative).where(Initiative.tenant_id == tenant_id)

    if product_id:
        query = query.where(Initiative.product_id == product_id)

    if status:
        query = query.where(Initiative.status == status)

    query = query.order_by(Initiative.priority_score.desc().nulls_last())

    if limit:
        query = query.limit(limit)

    result = await db.execute(query)
    features = result.scalars().all()

    return {
        "features": [
            {
                "id": int(f.id),
                "title": str(f.title) if f.title else "",
                "description": str(f.description) if f.description else "",
                "status": str(f.status) if f.status else "",
                "priority_score": float(f.priority_score) if f.priority_score is not None else 0.0,
                "effort": int(f.effort) if f.effort else 0,
                "estimated_impact_score": float(f.estimated_impact_score) if f.estimated_impact_score is not None else 0.0
            }
            for f in features
        ]
    }


@tool_registry.register(
    name="calculate_rice_score",
    description="Calculate RICE score for a feature",
    parameters=[
        ToolParameter(name="reach", type="number", description="Number of users impacted"),
        ToolParameter(name="impact", type="number", description="Impact score (1-5)"),
        ToolParameter(name="confidence", type="number", description="Confidence percentage (0-100)"),
        ToolParameter(name="effort", type="number", description="Effort in person-weeks (can be decimal)")
    ]
)
async def calculate_rice_score(
    reach: float,
    impact: float,
    confidence: float,
    effort: float,
    tenant_id: int,
    db: AsyncSession
) -> Dict[str, Any]:
    """Calculate RICE score"""
    # Convert all inputs to float to handle both int and string inputs
    try:
        reach = float(reach)
        impact = float(impact)
        confidence = float(confidence)
        effort = float(effort)
    except (ValueError, TypeError) as e:
        return {"error": f"Invalid numeric input: {str(e)}"}

    if effort == 0:
        return {"error": "Effort cannot be zero"}

    confidence_decimal = confidence / 100.0
    rice_score = (reach * impact * confidence_decimal) / effort

    return {
        "rice_score": float(round(rice_score, 2)),
        "reach": float(reach),
        "impact": float(impact),
        "confidence": float(confidence),
        "effort": float(effort),
        "formula": str(f"({reach} × {impact} × {confidence_decimal}) / {effort}")
    }


# ===================================
# DECISION WORKBENCH TOOLS
# ===================================

@tool_registry.register(
    name="simulate_persona_votes",
    description="Ask AI-powered persona twins (digital customer representations) to vote on strategic options. Returns each persona's choice, reasoning, confidence score (0-100%), and supporting evidence.",
    parameters=[
        ToolParameter(
            name="question",
            type="string",
            description="The decision question to ask personas (e.g., 'What should we prioritize next quarter to prevent churn?')"
        ),
        ToolParameter(
            name="options",
            type="array",
            description="List of strategic options for personas to evaluate",
            items={"type": "object", "properties": {"id": {"type": "string"}, "name": {"type": "string"}, "description": {"type": "string"}}}
        ),
        ToolParameter(
            name="persona_filter",
            type="string",
            description="Filter personas (e.g., 'CTO', 'VP', 'active status'). Leave empty for all personas.",
            required=False
        ),
        ToolParameter(
            name="product_id",
            type="integer",
            description="Filter personas by product ID. Leave empty to include all products.",
            required=False
        )
    ]
)
async def simulate_persona_votes(
    question: str,
    options: List[Dict[str, str]],
    tenant_id: int,
    db: AsyncSession,
    persona_filter: Optional[str] = None,
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Ask persona twins to vote on options"""
    from app.services.persona_twin import PersonaTwinService
    from app.services.llm_service import get_llm_service_for_tenant

    # Get personas
    query = select(Persona).where(Persona.tenant_id == tenant_id)

    # Filter by product if specified
    if product_id:
        query = query.where(Persona.product_id == product_id)

    # Apply filter
    if persona_filter:
        filter_lower = persona_filter.lower()
        if 'active' in filter_lower:
            from app.schemas.persona import PersonaStatus
            query = query.where(Persona.status == PersonaStatus.ACTIVE)
        else:
            # Word-based matching: split filter into words and match if ANY word is in name/segment
            # This handles plurals/variations: "product managers" matches "Product Manager"
            filter_words = [w.strip() for w in filter_lower.replace(',', ' ').split() if len(w.strip()) > 2]

            if filter_words:
                # Build OR conditions for each word
                conditions = []
                for word in filter_words:
                    conditions.append(func.lower(Persona.name).contains(word))
                    conditions.append(func.lower(Persona.segment).contains(word))

                query = query.where(or_(*conditions))

    result = await db.execute(query)
    personas = result.scalars().all()

    if not personas:
        if persona_filter:
            return {
                "error": f"No personas found matching '{persona_filter}'",
                "suggestion": f"Try asking 'all personas' or check persona names/segments match your filter"
            }
        else:
            return {
                "error": "No personas found. Create persona twins first to get their input on decisions.",
                "suggestion": "Go to the Personas page to create persona twins from your customer feedback data"
            }

    # Get tenant config for PersonaTwinService
    from app.core.security import decrypt_llm_config
    from app.models.tenant import Tenant

    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    tenant_config = decrypt_llm_config(tenant.llm_config) if tenant and tenant.llm_config else None

    persona_service = PersonaTwinService(tenant_config)

    # Collect votes from each persona
    votes = []
    for persona in personas:
        try:
            # Ask persona to vote
            vote_result = await persona_service.vote_on_options(
                persona=persona,
                question=question,
                options=options,
                db=db
            )

            # Ensure citations are serializable (extract only primitive fields)
            citations = []
            for cite in vote_result.get("citations", [])[:2]:
                if isinstance(cite, dict):
                    citations.append({
                        "feedback_id": int(cite.get("feedback_id", 0)),
                        "content": str(cite.get("content", ""))
                    })

            votes.append({
                "persona_id": int(vote_result["persona_id"]),
                "persona_name": str(vote_result["persona_name"]),
                "segment": str(vote_result["segment"]),
                "choice": str(vote_result.get("choice", "")) if vote_result.get("choice") else None,
                "reasoning": str(vote_result.get("reasoning", ""))[:300],
                "confidence": int(vote_result.get("confidence", 0) * 100),
                "citations": citations
            })
        except Exception as e:
            votes.append({
                "persona_id": int(persona.id),
                "persona_name": str(persona.name),
                "segment": str(persona.segment),
                "choice": None,
                "reasoning": f"Error: {str(e)}",
                "confidence": 0,
                "citations": []
            })

    return {
        "question": question,
        "total_personas": len(personas),
        "votes": votes,
        "options": options
    }


@tool_registry.register(
    name="pull_decision_context",
    description="Pull relevant feedback themes and customer data for a strategic decision",
    parameters=[
        ToolParameter(
            name="objective",
            type="string",
            description="The decision objective (e.g., 'prevent churn', 'enter enterprise market')"
        ),
        ToolParameter(
            name="segments",
            type="array",
            description="Target customer segments (optional)",
            required=False,
            items={"type": "string"}
        ),
        ToolParameter(
            name="product_id",
            type="integer",
            description="Filter by product ID",
            required=False
        )
    ]
)
async def pull_decision_context(
    objective: str,
    tenant_id: int,
    db: AsyncSession,
    segments: Optional[List[str]] = None,
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Pull relevant context for decision making"""
    # Get themes
    query = select(Theme).where(Theme.tenant_id == tenant_id)
    if product_id:
        query = query.where(Theme.product_id == product_id)
    query = query.order_by(Theme.total_arr.desc())
    result = await db.execute(query.limit(10))
    themes = result.scalars().all()

    # Get recent context sources (uploaded customer feedback)
    from app.models.context import ContextProcessingStatus
    query = select(ContextSource).where(
        ContextSource.tenant_id == tenant_id,
        ContextSource.status == ContextProcessingStatus.COMPLETED
    )
    if product_id:
        query = query.where(ContextSource.product_id == product_id)
    query = query.order_by(ContextSource.impact_score.desc().nullslast())
    result = await db.execute(query.limit(20))
    context_sources = result.scalars().all()

    # Get extracted entities related to objective
    query = select(ExtractedEntity).where(
        ExtractedEntity.tenant_id == tenant_id
    )
    if product_id:
        query = query.where(ExtractedEntity.product_id == product_id)
    result = await db.execute(query.order_by(ExtractedEntity.confidence_score.desc().nullslast()).limit(50))
    entities = result.scalars().all()

    return {
        "objective": objective,
        "themes": [
            {
                "id": int(t.id),
                "title": str(t.title) if t.title else "",
                "description": str(t.description) if t.description else "",
                "total_arr": float(t.total_arr) if t.total_arr else 0.0,
                "urgency": float(t.urgency_score) if t.urgency_score else 0.0
            }
            for t in themes
        ],
        "context_sources": [
            {
                "id": int(cs.id),
                "name": str(cs.name) if cs.name else "",
                "content": str(cs.content)[:200] if cs.content else "",
                "source_type": str(cs.source_type.value) if cs.source_type else "unknown",
                "customer_segment": str(cs.customer_segment) if cs.customer_segment else None,
                "sentiment_score": float(cs.sentiment_score) if cs.sentiment_score else 0.0
            }
            for cs in context_sources[:10]
        ],
        "extracted_entities": {
            "pain_points": [
                {
                    "name": str(e.name) if e.name else "",
                    "description": str(e.description) if e.description else "",
                    "confidence": float(e.confidence_score) if e.confidence_score else 0.0
                }
                for e in entities if e.entity_type == EntityType.PAIN_POINT
            ][:5],
            "capabilities": [
                {
                    "name": str(e.name) if e.name else "",
                    "description": str(e.description) if e.description else ""
                }
                for e in entities if e.entity_type == EntityType.PRODUCT_CAPABILITY
            ][:5]
        }
    }


# ===================================
# UTILITY TOOLS
# ===================================

@tool_registry.register(
    name="get_current_date",
    description="Get the current date and time",
    parameters=[]
)
async def get_current_date(tenant_id: int, db: AsyncSession) -> Dict[str, Any]:
    """Get current date"""
    now = datetime.utcnow()
    return {
        "date": now.strftime("%Y-%m-%d"),
        "datetime": now.isoformat(),
        "timestamp": int(now.timestamp())
    }


# ===================================
# CONTEXT TOOLS (Unified Context System)
# ===================================

@tool_registry.register(
    name="get_context_sources",
    description="Get all context sources (meeting transcripts, surveys, documents, etc.) for analysis. Can search by source name or keywords.",
    parameters=[
        ToolParameter(name="search", type="string", description="Search by source name or keywords (e.g., 'Acme Corp', 'dashboard meeting')", required=False),
        ToolParameter(name="source_type", type="string", description="Filter by source type (optional)", required=False),
        ToolParameter(name="status", type="string", description="Filter by processing status (optional)", required=False),
        ToolParameter(name="limit", type="integer", description="Maximum number of sources to return", required=False),
        ToolParameter(name="product_id", type="integer", description="Filter by product ID", required=False)
    ]
)
async def get_context_sources(
    tenant_id: int,
    db: AsyncSession,
    search: Optional[str] = None,
    source_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: Optional[int] = 50,
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Get context sources with optional filtering"""
    from sqlalchemy import or_, func as sqlfunc

    query = select(ContextSource).where(ContextSource.tenant_id == tenant_id)

    if product_id:
        query = query.where(ContextSource.product_id == product_id)

    if source_type and source_type != 'all':
        query = query.where(ContextSource.source_type == source_type)

    if status and status != 'all':
        query = query.where(ContextSource.status == status)

    # Add search filter
    if search:
        search_term = f"%{search.lower()}%"
        query = query.where(
            or_(
                sqlfunc.lower(ContextSource.name).like(search_term),
                sqlfunc.lower(ContextSource.description).like(search_term)
            )
        )

    query = query.order_by(ContextSource.created_at.desc())

    if limit:
        query = query.limit(limit)

    result = await db.execute(query)
    sources = result.scalars().all()

    return {
        "sources": [
            {
                "id": int(s.id),
                "source_type": str(s.source_type.value) if s.source_type else "",
                "name": str(s.name) if s.name else "",
                "description": str(s.description) if s.description else "",
                "customer_name": str(s.customer_name) if s.customer_name else None,
                "status": str(s.status.value) if s.status else "",
                "entities_extracted_count": int(s.entities_extracted_count) if s.entities_extracted_count else 0,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "source_url": str(s.source_url) if s.source_url else None,
            }
            for s in sources
        ],
        "total": len(sources)
    }


@tool_registry.register(
    name="get_extracted_entities",
    description="Get AI-extracted entities (personas, pain points, use cases, capabilities, etc.) from context sources. Can search by keywords or filter by source/customer. Returns source_name and customer_name with each entity so you can see which source and customer it came from.",
    parameters=[
        ToolParameter(
            name="entity_type",
            type="string",
            description="Type of entity to retrieve",
            required=False,
            enum=["persona", "pain_point", "use_case", "feature_request", "product_capability", "stakeholder", "competitor", "all"]
        ),
        ToolParameter(name="search", type="string", description="Search by entity name, description, or category (e.g., 'dashboard', 'performance', 'slow')", required=False),
        ToolParameter(name="source_name", type="string", description="Filter by source name using partial match (e.g., 'Acme' will match 'Acme Corp Meeting Notes'). NOTE: Source names may vary - check source names first with get_context_sources if unsure.", required=False),
        ToolParameter(name="customer_name", type="string", description="Filter by customer/company name using partial match (e.g., 'Acme' will match 'Acme Corp')", required=False),
        ToolParameter(name="limit", type="integer", description="Maximum number of entities to return", required=False),
        ToolParameter(name="product_id", type="integer", description="Filter by product ID", required=False)
    ]
)
async def get_extracted_entities(
    tenant_id: int,
    db: AsyncSession,
    entity_type: Optional[str] = "all",
    search: Optional[str] = None,
    source_name: Optional[str] = None,
    customer_name: Optional[str] = None,
    limit: Optional[int] = 100,
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Get extracted entities with optional type filtering and search"""
    from sqlalchemy import or_, func as sqlfunc
    from sqlalchemy.orm import joinedload

    # Always join with source to get source name
    query = select(ExtractedEntity).where(ExtractedEntity.tenant_id == tenant_id)
    query = query.join(ContextSource, ExtractedEntity.source_id == ContextSource.id)

    if product_id:
        query = query.where(ExtractedEntity.product_id == product_id)

    if entity_type and entity_type != 'all':
        query = query.where(ExtractedEntity.entity_type == entity_type)

    # Add search filter
    if search:
        search_term = f"%{search.lower()}%"
        query = query.where(
            or_(
                sqlfunc.lower(ExtractedEntity.name).like(search_term),
                sqlfunc.lower(ExtractedEntity.description).like(search_term),
                sqlfunc.lower(ExtractedEntity.category).like(search_term)
            )
        )

    # Add source name filter
    if source_name:
        source_search_term = f"%{source_name.lower()}%"
        query = query.where(sqlfunc.lower(ContextSource.name).like(source_search_term))

    # Add customer name filter
    if customer_name:
        customer_search_term = f"%{customer_name.lower()}%"
        query = query.where(sqlfunc.lower(ContextSource.customer_name).like(customer_search_term))

    query = query.order_by(ExtractedEntity.created_at.desc())

    if limit:
        query = query.limit(limit)

    result = await db.execute(query)
    entities = result.scalars().all()

    # Fetch source names and customer names for all entities
    source_ids = list(set(e.source_id for e in entities if e.source_id))
    source_map = {}
    if source_ids:
        source_result = await db.execute(
            select(ContextSource).where(ContextSource.id.in_(source_ids))
        )
        sources = source_result.scalars().all()
        source_map = {s.id: {"name": s.name, "customer_name": s.customer_name} for s in sources}

    return {
        "entities": [
            {
                "id": int(e.id),
                "source_id": int(e.source_id) if e.source_id else None,
                "source_name": source_map.get(e.source_id, {}).get("name") if e.source_id else None,
                "customer_name": source_map.get(e.source_id, {}).get("customer_name") if e.source_id else None,
                "entity_type": str(e.entity_type.value) if e.entity_type else "",
                "name": str(e.name) if e.name else "",
                "description": str(e.description) if e.description else "",
                "confidence_score": float(e.confidence_score) if e.confidence_score is not None else 0.0,
                "category": str(e.category) if e.category else None,
                "attributes": e.attributes if isinstance(e.attributes, dict) else {},
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in entities
        ],
        "total": len(entities)
    }


@tool_registry.register(
    name="get_entity_summary",
    description="Get summary statistics of extracted entities by type (counts and categories)",
    parameters=[]
)
async def get_entity_summary(tenant_id: int, db: AsyncSession) -> Dict[str, Any]:
    """Get aggregated statistics for extracted entities"""
    # Count entities by type
    from sqlalchemy import func as sql_func

    result = await db.execute(
        select(
            ExtractedEntity.entity_type,
            sql_func.count(ExtractedEntity.id).label('count')
        )
        .where(ExtractedEntity.tenant_id == tenant_id)
        .group_by(ExtractedEntity.entity_type)
    )

    counts_by_type = {str(row[0].value): int(row[1]) for row in result.all()}

    # Get total count
    total_result = await db.execute(
        select(sql_func.count(ExtractedEntity.id))
        .where(ExtractedEntity.tenant_id == tenant_id)
    )
    total = total_result.scalar() or 0

    return {
        "total": int(total),
        "by_type": {
            "persona": counts_by_type.get("persona", 0),
            "pain_point": counts_by_type.get("pain_point", 0),
            "use_case": counts_by_type.get("use_case", 0),
            "feature_request": counts_by_type.get("feature_request", 0),
            "product_capability": counts_by_type.get("product_capability", 0),
            "competitor": counts_by_type.get("competitor", 0),
            "stakeholder": counts_by_type.get("stakeholder", 0),
            "technical_requirement": counts_by_type.get("technical_requirement", 0),
            "business_goal": counts_by_type.get("business_goal", 0),
            "metric": counts_by_type.get("metric", 0),
            "quote": counts_by_type.get("quote", 0),
        }
    }


# ===================================
# PRODUCT KNOWLEDGE TOOLS
# ===================================

@tool_registry.register(
    name="get_product_strategy",
    description="Get the product strategy document - includes vision, mission, goals, target market, positioning",
    parameters=[
        ToolParameter(name="product_id", type="integer", description="Product ID", required=False)
    ]
)
async def get_product_strategy(
    tenant_id: int,
    db: AsyncSession,
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Get product strategy document"""
    from app.models.product_knowledge import ProductKnowledge

    query = select(ProductKnowledge).where(ProductKnowledge.tenant_id == tenant_id)

    if product_id:
        query = query.where(ProductKnowledge.product_id == product_id)

    result = await db.execute(query)
    knowledge = result.scalar_one_or_none()

    if not knowledge or not knowledge.strategy_doc:
        return {
            "error": "No product strategy document found",
            "suggestion": "Add strategy documentation in the Knowledge page (Strategy Docs tab)"
        }

    return {
        "product_id": product_id,
        "strategy": knowledge.strategy_doc
    }


@tool_registry.register(
    name="get_customer_segments",
    description="Get customer segment definitions - target personas, ICP, market segments",
    parameters=[
        ToolParameter(name="product_id", type="integer", description="Product ID", required=False)
    ]
)
async def get_customer_segments(
    tenant_id: int,
    db: AsyncSession,
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Get customer segments document"""
    from app.models.product_knowledge import ProductKnowledge

    query = select(ProductKnowledge).where(ProductKnowledge.tenant_id == tenant_id)

    if product_id:
        query = query.where(ProductKnowledge.product_id == product_id)

    result = await db.execute(query)
    knowledge = result.scalar_one_or_none()

    if not knowledge or not knowledge.customer_segments_doc:
        return {
            "error": "No customer segments document found",
            "suggestion": "Add customer segment documentation in the Knowledge page (Strategy Docs tab)"
        }

    return {
        "product_id": product_id,
        "customer_segments": knowledge.customer_segments_doc
    }


@tool_registry.register(
    name="get_competitive_landscape",
    description="Get competitive analysis - competitors, differentiation, market positioning, SWOT analysis",
    parameters=[
        ToolParameter(name="product_id", type="integer", description="Product ID", required=False)
    ]
)
async def get_competitive_landscape(
    tenant_id: int,
    db: AsyncSession,
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Get competitive landscape document"""
    from app.models.product_knowledge import ProductKnowledge

    query = select(ProductKnowledge).where(ProductKnowledge.tenant_id == tenant_id)

    if product_id:
        query = query.where(ProductKnowledge.product_id == product_id)

    result = await db.execute(query)
    knowledge = result.scalar_one_or_none()

    if not knowledge or not knowledge.competitive_landscape_doc:
        return {
            "error": "No competitive landscape document found",
            "suggestion": "Add competitive analysis in the Knowledge page (Strategy Docs tab)"
        }

    return {
        "product_id": product_id,
        "competitive_landscape": knowledge.competitive_landscape_doc
    }


@tool_registry.register(
    name="get_value_proposition",
    description="Get value proposition - unique selling points, benefits, positioning statement",
    parameters=[
        ToolParameter(name="product_id", type="integer", description="Product ID", required=False)
    ]
)
async def get_value_proposition(
    tenant_id: int,
    db: AsyncSession,
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Get value proposition document"""
    from app.models.product_knowledge import ProductKnowledge

    query = select(ProductKnowledge).where(ProductKnowledge.tenant_id == tenant_id)

    if product_id:
        query = query.where(ProductKnowledge.product_id == product_id)

    result = await db.execute(query)
    knowledge = result.scalar_one_or_none()

    if not knowledge or not knowledge.value_proposition_doc:
        return {
            "error": "No value proposition document found",
            "suggestion": "Add value proposition in the Knowledge page (Strategy Docs tab)"
        }

    return {
        "product_id": product_id,
        "value_proposition": knowledge.value_proposition_doc
    }


@tool_registry.register(
    name="get_metrics_and_targets",
    description="Get key metrics, OKRs, KPIs, and targets - business goals, success metrics, performance indicators",
    parameters=[
        ToolParameter(name="product_id", type="integer", description="Product ID", required=False)
    ]
)
async def get_metrics_and_targets(
    tenant_id: int,
    db: AsyncSession,
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Get metrics and targets document"""
    from app.models.product_knowledge import ProductKnowledge

    query = select(ProductKnowledge).where(ProductKnowledge.tenant_id == tenant_id)

    if product_id:
        query = query.where(ProductKnowledge.product_id == product_id)

    result = await db.execute(query)
    knowledge = result.scalar_one_or_none()

    if not knowledge or not knowledge.metrics_and_targets_doc:
        return {
            "error": "No metrics and targets document found",
            "suggestion": "Add metrics and targets in the Knowledge page (Strategy Docs tab)"
        }

    return {
        "product_id": product_id,
        "metrics_and_targets": knowledge.metrics_and_targets_doc
    }


@tool_registry.register(
    name="get_all_product_knowledge",
    description="Get all product knowledge documents at once - strategy, segments, competitive landscape, value prop, and metrics. Use this when you need comprehensive product context.",
    parameters=[
        ToolParameter(name="product_id", type="integer", description="Product ID", required=False)
    ]
)
async def get_all_product_knowledge(
    tenant_id: int,
    db: AsyncSession,
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Get all product knowledge documents"""
    from app.models.product_knowledge import ProductKnowledge

    query = select(ProductKnowledge).where(ProductKnowledge.tenant_id == tenant_id)

    if product_id:
        query = query.where(ProductKnowledge.product_id == product_id)

    result = await db.execute(query)
    knowledge = result.scalar_one_or_none()

    if not knowledge:
        return {
            "error": "No product knowledge found",
            "suggestion": "Add product documentation in the Knowledge page (Strategy Docs tab)"
        }

    return {
        "product_id": product_id,
        "strategy": knowledge.strategy_doc or "",
        "customer_segments": knowledge.customer_segments_doc or "",
        "competitive_landscape": knowledge.competitive_landscape_doc or "",
        "value_proposition": knowledge.value_proposition_doc or "",
        "metrics_and_targets": knowledge.metrics_and_targets_doc or "",
        "has_strategy": bool(knowledge.strategy_doc),
        "has_customer_segments": bool(knowledge.customer_segments_doc),
        "has_competitive_landscape": bool(knowledge.competitive_landscape_doc),
        "has_value_proposition": bool(knowledge.value_proposition_doc),
        "has_metrics_and_targets": bool(knowledge.metrics_and_targets_doc)
    }


# ===================================
# SKILL MEMORY TOOLS
# ===================================

@tool_registry.register(
    name="get_past_skill_work",
    description="Get recent skill executions and past work for this product. Use when you need to reference what analysis/frameworks/work was done before. Returns summaries with skill name, date, and brief overview.",
    parameters=[
        ToolParameter(name="limit", type="integer", description="Maximum results to return (default: 10)", required=False),
        ToolParameter(name="category", type="string", description="Filter by skill category: discovery, strategy, execution, market-research, data-analytics, go-to-market, marketing-growth, toolkit, os-infrastructure, daily-discipline", required=False),
        ToolParameter(name="product_id", type="integer", description="Product ID", required=False)
    ]
)
async def get_past_skill_work(
    tenant_id: int,
    db: AsyncSession,
    limit: int = 10,
    category: Optional[str] = None,
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Get recent skill executions to understand what work has been done"""
    from app.services.unified_pm_os import MemoryManager

    mm = MemoryManager(db)

    if not product_id:
        return {
            "error": "No product selected",
            "suggestion": "Product ID is required to query past work"
        }

    try:
        recent_work = await mm.get_recent_skill_outputs(
            product_id=product_id,
            limit=limit,
            category=category
        )

        if not recent_work:
            return {
                "message": "No past skill work found for this product",
                "suggestion": "This is the first skill execution, or past work was cleared"
            }

        return {
            "product_id": product_id,
            "total_results": len(recent_work),
            "past_work": [
                {
                    "skill_name": work['skill_name'],
                    "category": work['skill_category'],
                    "summary": work['summary'],
                    "date": work['created_at'].strftime('%Y-%m-%d') if work.get('created_at') else None,
                    "memory_id": work['id']
                }
                for work in recent_work
            ]
        }
    except Exception as e:
        return {
            "error": f"Failed to query past work: {str(e)}"
        }


@tool_registry.register(
    name="get_skill_memory_details",
    description="Get full details of a specific past skill execution including complete input and output. Use when you need to see the full content of previous work (e.g., complete OST, full SWOT analysis, entire PRD).",
    parameters=[
        ToolParameter(name="memory_id", type="integer", description="ID of the skill memory to retrieve (from get_past_skill_work)")
    ]
)
async def get_skill_memory_details(
    memory_id: int,
    tenant_id: int,
    db: AsyncSession
) -> Dict[str, Any]:
    """Get full details of a specific skill execution"""
    from app.services.unified_pm_os import MemoryManager

    mm = MemoryManager(db)

    try:
        memory = await mm.get_skill_memory_by_id(memory_id)

        if not memory:
            return {
                "error": f"Memory ID {memory_id} not found"
            }

        return {
            "skill_name": memory['skill_name'],
            "category": memory['skill_category'],
            "date": memory['created_at'].strftime('%Y-%m-%d %H:%M') if memory.get('created_at') else None,
            "input": memory['input_data'],
            "output": memory['output_data'],
            "summary": memory['summary']
        }
    except Exception as e:
        return {
            "error": f"Failed to retrieve memory: {str(e)}"
        }


@tool_registry.register(
    name="search_past_skill_work",
    description="Search past skill executions by keyword. Use when looking for specific topics or work (e.g., 'retention', 'onboarding', 'pricing'). Searches in skill names and summaries.",
    parameters=[
        ToolParameter(name="search_term", type="string", description="Keyword to search for"),
        ToolParameter(name="limit", type="integer", description="Maximum results (default: 20)", required=False),
        ToolParameter(name="product_id", type="integer", description="Product ID", required=False)
    ]
)
async def search_past_skill_work(
    search_term: str,
    tenant_id: int,
    db: AsyncSession,
    limit: int = 20,
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Search skill memory by keyword"""
    from app.services.unified_pm_os import MemoryManager

    mm = MemoryManager(db)

    if not product_id:
        return {
            "error": "No product selected",
            "suggestion": "Product ID is required to search past work"
        }

    try:
        results = await mm.search_memory(
            product_id=product_id,
            search_term=search_term,
            limit=limit
        )

        if not results:
            return {
                "message": f"No past work found matching '{search_term}'",
                "suggestion": "Try different keywords or check if work was done on this topic"
            }

        return {
            "search_term": search_term,
            "total_results": len(results),
            "matches": [
                {
                    "skill_name": r['skill_name'],
                    "category": r['skill_category'],
                    "summary": r['summary'],
                    "date": r['created_at'].strftime('%Y-%m-%d') if r.get('created_at') else None,
                    "memory_id": r['id']
                }
                for r in results
            ]
        }
    except Exception as e:
        return {
            "error": f"Search failed: {str(e)}"
        }


@tool_registry.register(
    name="get_skill_usage_stats",
    description="Get statistics about skill usage for this product - which skills are used most, category breakdown, recent activity. Useful for understanding what work has been prioritized.",
    parameters=[
        ToolParameter(name="product_id", type="integer", description="Product ID", required=False)
    ]
)
async def get_skill_usage_stats(
    tenant_id: int,
    db: AsyncSession,
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Get skill usage statistics"""
    from app.services.unified_pm_os import MemoryManager

    mm = MemoryManager(db)

    if not product_id:
        return {
            "error": "No product selected"
        }

    try:
        stats = await mm.get_memory_stats(product_id)

        return {
            "product_id": product_id,
            "total_skill_executions": stats['total_executions'],
            "category_breakdown": stats['category_breakdown'],
            "most_used_skills": stats['most_used_skills'],
            "recent_activity": [
                {
                    "skill_name": a['skill_name'],
                    "summary": a['summary'],
                    "date": a['created_at'].strftime('%Y-%m-%d') if a.get('created_at') else None
                }
                for a in stats['recent_activity']
            ]
        }
    except Exception as e:
        return {
            "error": f"Failed to get stats: {str(e)}"
        }


# ===================================
# INTERNET SEARCH TOOL
# ===================================

@tool_registry.register(
    name="search_internet",
    description="Search the internet for current information, news, research, or facts. Use this when the user asks about recent events, current data, competitors, market trends, or information not in your training data. Returns both a synthesized answer and source links.",
    parameters=[
        ToolParameter(
            name="query",
            type="string",
            description="Search query (e.g., 'latest trends in product management 2026', 'what is RICE prioritization framework')"
        ),
        ToolParameter(
            name="max_results",
            type="integer",
            description="Maximum number of search results to return (default: 5)",
            required=False
        )
    ]
)
async def search_internet(
    query: str,
    tenant_id: int,
    db: AsyncSession,
    max_results: int = 5
) -> Dict[str, Any]:
    """
    Search the internet using Tavily AI (primary) or Serper.dev (fallback).

    Returns both a synthesized answer and source links for grounding.
    """
    import os
    import httpx
    from loguru import logger

    # Try Tavily first (AI-optimized search)
    tavily_api_key = os.getenv("TAVILY_API_KEY")

    if tavily_api_key:
        try:
            from tavily import TavilyClient

            tavily = TavilyClient(api_key=tavily_api_key)

            response = tavily.search(
                query=query,
                max_results=max_results,
                include_answer=True,
                include_raw_content=False
            )

            logger.info(f"[Search] Tavily search successful for: {query}")

            return {
                "query": query,
                "answer": response.get("answer", ""),
                "results": [
                    {
                        "title": r["title"],
                        "url": r["url"],
                        "content": r["content"][:500],  # Truncate to 500 chars
                        "score": r.get("score", 0)
                    }
                    for r in response.get("results", [])[:max_results]
                ],
                "source": "tavily"
            }

        except ImportError:
            logger.warning("[Search] Tavily package not installed, falling back to Serper")
        except Exception as tavily_error:
            logger.warning(f"[Search] Tavily failed: {tavily_error}, falling back to Serper")

    # Fallback to Serper
    serper_api_key = os.getenv("SERPER_API_KEY")

    if serper_api_key:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "https://google.serper.dev/search",
                    headers={
                        "X-API-KEY": serper_api_key,
                        "Content-Type": "application/json"
                    },
                    json={"q": query, "num": max_results}
                )
                response.raise_for_status()
                data = response.json()

                logger.info(f"[Search] Serper search successful for: {query}")

                # Extract answer from knowledge graph or answer box
                answer = ""
                if "answerBox" in data:
                    answer = data["answerBox"].get("answer", "") or data["answerBox"].get("snippet", "")
                elif "knowledgeGraph" in data:
                    answer = data["knowledgeGraph"].get("description", "")

                return {
                    "query": query,
                    "answer": answer,
                    "results": [
                        {
                            "title": r.get("title", ""),
                            "url": r.get("link", ""),
                            "content": r.get("snippet", ""),
                            "score": 0
                        }
                        for r in data.get("organic", [])[:max_results]
                    ],
                    "source": "serper"
                }

        except Exception as serper_error:
            logger.error(f"[Search] Serper failed: {serper_error}")
            return {
                "error": f"Internet search unavailable. Serper error: {str(serper_error)}",
                "query": query,
                "answer": "",
                "results": []
            }

    # No API keys configured
    logger.error("[Search] No search API keys configured (TAVILY_API_KEY or SERPER_API_KEY)")
    return {
        "error": "Internet search is not configured. Please set TAVILY_API_KEY or SERPER_API_KEY environment variable.",
        "query": query,
        "answer": "",
        "results": []
    }


# ===================================
# WORK CONTEXT TOOLS
# ===================================

@tool_registry.register(
    name="update_role_info",
    description="Update user's name, role, team, and manager information when you learn about it in conversation",
    parameters=[
        ToolParameter(name="name", type="string", description="User's full name or preferred name", required=False),
        ToolParameter(name="title", type="string", description="Job title or role", required=False),
        ToolParameter(name="team", type="string", description="Team name", required=False),
        ToolParameter(name="team_description", type="string", description="What the team does", required=False),
        ToolParameter(name="manager_name", type="string", description="Manager's name", required=False),
        ToolParameter(name="manager_title", type="string", description="Manager's title", required=False),
        ToolParameter(name="team_size", type="integer", description="Number of people on team", required=False),
        ToolParameter(name="team_composition", type="string", description="Team makeup (e.g., '5 engineers, 2 designers')", required=False)
    ]
)
async def update_role_info(
    user: User,
    db: AsyncSession,
    name: Optional[str] = None,
    title: Optional[str] = None,
    team: Optional[str] = None,
    team_description: Optional[str] = None,
    manager_name: Optional[str] = None,
    manager_title: Optional[str] = None,
    team_size: Optional[int] = None,
    team_composition: Optional[str] = None
) -> Dict[str, Any]:
    """Update name, role and team information"""
    result = await db.execute(
        select(WorkContext).filter(WorkContext.user_id == user.id)
    )
    work_context = result.scalar_one_or_none()

    if not work_context:
        work_context = WorkContext(user_id=user.id)
        db.add(work_context)
        await db.commit()
        await db.refresh(work_context)

    if name:
        work_context.name = name
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

    await db.commit()

    return {
        "success": True,
        "message": "Updated name, role and team information",
        "data": {
            "name": work_context.name,
            "title": work_context.title,
            "team": work_context.team,
            "manager": work_context.manager_name
        }
    }


@tool_registry.register(
    name="update_capacity",
    description="Update user's capacity assessment when you detect capacity signals (sustainable, stretched, overloaded, unsustainable)",
    parameters=[
        ToolParameter(name="status", type="string", description="Current capacity state", required=True, enum=["sustainable", "stretched", "overloaded", "unsustainable"]),
        ToolParameter(name="factors", type="string", description="What's driving the capacity state", required=False)
    ]
)
async def update_capacity(
    user: User,
    db: AsyncSession,
    status: str,
    factors: Optional[str] = None
) -> Dict[str, Any]:
    """Update capacity assessment"""
    result = await db.execute(
        select(WorkContext).filter(WorkContext.user_id == user.id)
    )
    work_context = result.scalar_one_or_none()

    if not work_context:
        work_context = WorkContext(user_id=user.id)
        db.add(work_context)
        await db.commit()
        await db.refresh(work_context)

    try:
        work_context.capacity_status = CapacityStatus(status)
        if factors:
            work_context.capacity_factors = factors

        await db.commit()

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


@tool_registry.register(
    name="add_or_update_project",
    description="Add or update an active project when mentioned in conversation",
    parameters=[
        ToolParameter(name="name", type="string", description="Project name", required=True),
        ToolParameter(name="status", type="string", description="Project status (RAG)", required=True, enum=["green", "yellow", "red", "completed", "paused"]),
        ToolParameter(name="role", type="string", description="User's role in project", required=True, enum=["owner", "contributor", "advisor"]),
        ToolParameter(name="next_milestone", type="string", description="Next milestone description", required=False),
        ToolParameter(name="key_stakeholders", type="array", description="List of stakeholder names", required=False, items={"type": "string"}),
        ToolParameter(name="notes", type="string", description="Additional context", required=False)
    ]
)
async def add_or_update_project(
    user: User,
    db: AsyncSession,
    name: str,
    status: str,
    role: str,
    next_milestone: Optional[str] = None,
    key_stakeholders: Optional[List[str]] = None,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """Add or update an active project"""
    # Extract user_id immediately to avoid detached session issues
    user_id = user.id

    result = await db.execute(
        select(WorkContext).filter(WorkContext.user_id == user_id)
    )
    work_context = result.scalar_one_or_none()

    if not work_context:
        work_context = WorkContext(user_id=user_id)
        db.add(work_context)
        await db.commit()
        await db.refresh(work_context)

    # Check if project exists
    project_result = await db.execute(
        select(ActiveProject).filter(
            ActiveProject.user_id == user_id,
            ActiveProject.name == name
        )
    )
    project = project_result.scalar_one_or_none()

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

    logger.info(f"[add_or_update_project] Status mapping: '{original_status}' -> '{status}'")

    # Normalize key_stakeholders to always be a list
    if key_stakeholders is not None:
        if isinstance(key_stakeholders, str):
            # If it's a string, split by comma and strip whitespace
            key_stakeholders = [s.strip() for s in key_stakeholders.split(',') if s.strip()]
            logger.info(f"[add_or_update_project] Converted string stakeholders to list: {key_stakeholders}")
        elif not isinstance(key_stakeholders, list):
            # If it's neither string nor list, convert to list
            key_stakeholders = [str(key_stakeholders)]
            logger.info(f"[add_or_update_project] Converted non-list stakeholders to list: {key_stakeholders}")

    try:
        if project:
            # Update existing
            project.status = ProjectStatus(status)
            project.role = ProjectRole(role)
            if next_milestone:
                project.next_milestone = next_milestone
            if key_stakeholders:
                project.key_stakeholders = key_stakeholders
            if notes:
                project.notes = notes
            message = f"Updated project: {name}"
        else:
            # Create new
            project = ActiveProject(
                work_context_id=work_context.id,
                user_id=user_id,
                name=name,
                status=ProjectStatus(status),
                role=ProjectRole(role),
                next_milestone=next_milestone,
                key_stakeholders=key_stakeholders,
                notes=notes
            )
            db.add(project)
            message = f"Added project: {name}"

        await db.commit()

        from loguru import logger
        logger.info(f"[add_or_update_project] Successfully saved project '{name}' with status={status}, role={role}")

        return {
            "success": True,
            "message": message,
            "data": {"name": name, "status": status, "role": role}
        }
    except ValueError as e:
        from loguru import logger
        logger.error(f"[add_or_update_project] ValueError for project '{name}': {str(e)}")
        logger.error(f"[add_or_update_project] Arguments - status={status}, role={role}")
        await db.rollback()
        return {
            "success": False,
            "error": f"Invalid project data: {str(e)}"
        }
    except Exception as e:
        from loguru import logger
        logger.error(f"[add_or_update_project] Exception for project '{name}': {str(e)}")
        logger.error(f"[add_or_update_project] Arguments - status={status}, role={role}")
        await db.rollback()
        return {
            "success": False,
            "error": f"Failed to save project: {str(e)}"
        }


@tool_registry.register(
    name="add_or_update_relationship",
    description="Add or update a key stakeholder/relationship when mentioned in conversation",
    parameters=[
        ToolParameter(name="name", type="string", description="Person's name", required=True),
        ToolParameter(name="role", type="string", description="Their job title", required=False),
        ToolParameter(name="relationship_type", type="string", description="Type: manager, peer, stakeholder, direct_report", required=False),
        ToolParameter(name="cares_about", type="string", description="What motivates them", required=False),
        ToolParameter(name="current_dynamic", type="string", description="Current relationship state", required=False),
        ToolParameter(name="communication_preference", type="string", description="How they prefer to communicate", required=False)
    ]
)
async def add_or_update_relationship(
    user: User,
    db: AsyncSession,
    name: str,
    role: Optional[str] = None,
    relationship_type: Optional[str] = None,
    cares_about: Optional[str] = None,
    current_dynamic: Optional[str] = None,
    communication_preference: Optional[str] = None
) -> Dict[str, Any]:
    """Add or update a key relationship"""
    # Extract user_id immediately to avoid detached session issues
    user_id = user.id

    result = await db.execute(
        select(WorkContext).filter(WorkContext.user_id == user_id)
    )
    work_context = result.scalar_one_or_none()

    if not work_context:
        work_context = WorkContext(user_id=user_id)
        db.add(work_context)
        await db.commit()
        await db.refresh(work_context)

    # Check if relationship exists
    rel_result = await db.execute(
        select(KeyRelationship).filter(
            KeyRelationship.user_id == user_id,
            KeyRelationship.name == name
        )
    )
    relationship = rel_result.scalar_one_or_none()

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
        message = f"Updated relationship: {name}"
    else:
        # Create new
        relationship = KeyRelationship(
            work_context_id=work_context.id,
            user_id=user_id,
            name=name,
            role=role,
            relationship_type=relationship_type,
            cares_about=cares_about,
            current_dynamic=current_dynamic,
            communication_preference=communication_preference
        )
        db.add(relationship)
        message = f"Added relationship: {name}"

    await db.commit()

    return {
        "success": True,
        "message": message,
        "data": {"name": name, "relationship_type": relationship_type}
    }


@tool_registry.register(
    name="add_task",
    description="Add a task to the user's task board when action items come up in conversation",
    parameters=[
        ToolParameter(name="title", type="string", description="Task description (start with verb)", required=True),
        ToolParameter(name="priority", type="string", description="Task priority tier", required=True, enum=["critical", "high_leverage", "stakeholder", "sweep", "backlog"]),
        ToolParameter(name="deadline", type="string", description="Due date/deadline in natural language (e.g., 'next week', 'in 2 weeks', '2024-12-31')", required=False),
        ToolParameter(name="description", type="string", description="Additional details", required=False),
        ToolParameter(name="why_critical", type="string", description="Why critical (for critical tasks)", required=False),
        ToolParameter(name="impact", type="string", description="Expected impact (for high_leverage tasks)", required=False),
        ToolParameter(name="stakeholder_name", type="string", description="Who it's for (for stakeholder tasks)", required=False),
        ToolParameter(name="source", type="string", description="Where this task came from", required=False)
    ]
)
async def add_task(
    user: User,
    db: AsyncSession,
    title: str,
    priority: str,
    deadline: Optional[str] = None,
    description: Optional[str] = None,
    why_critical: Optional[str] = None,
    impact: Optional[str] = None,
    stakeholder_name: Optional[str] = None,
    source: Optional[str] = None
) -> Dict[str, Any]:
    """Add a task to the user's task board"""
    from datetime import datetime, timedelta
    import re

    try:
        # Parse deadline if provided
        deadline_dt = None
        if deadline:
            deadline_lower = deadline.lower().strip()
            now = datetime.now()

            # Try parsing common natural language formats
            if 'next week' in deadline_lower:
                deadline_dt = now + timedelta(weeks=1)
            elif 'in 2 weeks' in deadline_lower or '2 weeks' in deadline_lower:
                deadline_dt = now + timedelta(weeks=2)
            elif 'in 3 weeks' in deadline_lower or '3 weeks' in deadline_lower:
                deadline_dt = now + timedelta(weeks=3)
            elif 'tomorrow' in deadline_lower:
                deadline_dt = now + timedelta(days=1)
            elif 'next month' in deadline_lower:
                deadline_dt = now + timedelta(days=30)
            elif match := re.search(r'in (\d+) days?', deadline_lower):
                days = int(match.group(1))
                deadline_dt = now + timedelta(days=days)
            else:
                # Try parsing as ISO date
                try:
                    deadline_dt = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
                except:
                    # If all parsing fails, store as description
                    if description:
                        description += f" (Deadline: {deadline})"
                    else:
                        description = f"Deadline: {deadline}"

        task = Task(
            user_id=user.id,
            title=title,
            priority=TaskPriority(priority),
            status=TaskStatus.TODO,
            deadline=deadline_dt,
            description=description,
            why_critical=why_critical,
            impact=impact,
            stakeholder_name=stakeholder_name,
            source=source
        )
        db.add(task)
        await db.commit()

        return {
            "success": True,
            "message": f"Added task: {title}",
            "data": {"title": title, "priority": priority, "deadline": deadline_dt.isoformat() if deadline_dt else None}
        }
    except ValueError as e:
        return {
            "success": False,
            "error": f"Invalid task data: {str(e)}"
        }


@tool_registry.register(
    name="set_weekly_focus",
    description="Set the three things that matter this week for the user",
    parameters=[
        ToolParameter(name="focus_1", type="string", description="First priority for the week", required=False),
        ToolParameter(name="focus_2", type="string", description="Second priority for the week", required=False),
        ToolParameter(name="focus_3", type="string", description="Third priority for the week", required=False),
        ToolParameter(name="notes", type="string", description="Additional notes about this week", required=False)
    ]
)
async def set_weekly_focus(
    user: User,
    db: AsyncSession,
    focus_1: Optional[str] = None,
    focus_2: Optional[str] = None,
    focus_3: Optional[str] = None,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """Set weekly focus for the current week"""
    from datetime import datetime, timedelta
    from app.models.work_context import WeeklyFocus

    # Get start of current week (Monday)
    today = datetime.now()
    week_start = today - timedelta(days=today.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    # Check if focus already exists for this week
    result = await db.execute(
        select(WeeklyFocus).filter(
            WeeklyFocus.user_id == user.id,
            WeeklyFocus.week_start_date == week_start
        )
    )
    weekly_focus = result.scalar_one_or_none()

    try:
        if weekly_focus:
            # Update existing
            if focus_1 is not None:
                weekly_focus.focus_1 = focus_1
            if focus_2 is not None:
                weekly_focus.focus_2 = focus_2
            if focus_3 is not None:
                weekly_focus.focus_3 = focus_3
            if notes is not None:
                weekly_focus.notes = notes
            message = "Updated weekly focus"
        else:
            # Create new
            weekly_focus = WeeklyFocus(
                user_id=user.id,
                week_start_date=week_start,
                focus_1=focus_1,
                focus_2=focus_2,
                focus_3=focus_3,
                notes=notes
            )
            db.add(weekly_focus)
            message = "Set weekly focus"

        await db.commit()

        return {
            "success": True,
            "message": message,
            "data": {
                "week_start": week_start.isoformat(),
                "focus_1": focus_1,
                "focus_2": focus_2,
                "focus_3": focus_3
            }
        }
    except Exception as e:
        await db.rollback()
        return {
            "success": False,
            "error": f"Failed to set weekly focus: {str(e)}"
        }


@tool_registry.register(
    name="log_pm_decision",
    description="Log a product management decision to the user's decision log with context, options, and reasoning",
    parameters=[
        ToolParameter(name="title", type="string", description="Decision title (e.g., 'Prioritize mobile app over web redesign')", required=True),
        ToolParameter(name="category", type="string", description="Decision category: product, technical, organizational, career, process, or stakeholder", required=True),
        ToolParameter(name="context", type="string", description="What prompted this decision", required=True),
        ToolParameter(name="options_considered", type="array", description="Array of options with pros/cons: [{\"option\": \"...\", \"pros\": \"...\", \"cons\": \"...\"}]", required=True),
        ToolParameter(name="decision", type="string", description="What was decided", required=True),
        ToolParameter(name="reasoning", type="string", description="Why this option was chosen", required=True),
        ToolParameter(name="tradeoffs", type="string", description="What we're giving up or risks accepted", required=False),
        ToolParameter(name="stakeholders", type="array", description="Array of stakeholder names involved", required=False),
        ToolParameter(name="expected_outcome", type="string", description="What we expect to happen as a result", required=False),
        ToolParameter(name="product_id", type="integer", description="Product ID if decision is product-specific", required=False)
    ]
)
async def log_pm_decision(
    user: User,
    db: AsyncSession,
    title: str,
    category: str,
    context: str,
    options_considered: List[Dict[str, str]],
    decision: str,
    reasoning: str,
    tradeoffs: Optional[str] = None,
    stakeholders: Optional[List[str]] = None,
    expected_outcome: Optional[str] = None,
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Log a PM decision to the database"""
    from datetime import datetime
    from app.models.work_context import PMDecision, DecisionCategory

    try:
        # Validate category
        valid_categories = ['product', 'technical', 'organizational', 'career', 'process', 'stakeholder']
        if category.lower() not in valid_categories:
            return {
                "success": False,
                "error": f"Invalid category. Must be one of: {', '.join(valid_categories)}"
            }

        # Get next decision number for this user
        result = await db.execute(
            select(func.max(PMDecision.decision_number)).filter(PMDecision.user_id == user.id)
        )
        max_num = result.scalar()
        next_num = (max_num or 0) + 1

        # Create decision
        pm_decision = PMDecision(
            user_id=user.id,
            product_id=product_id,
            decision_number=next_num,
            title=title,
            category=DecisionCategory(category.lower()),
            context=context,
            options_considered=options_considered,
            decision=decision,
            reasoning=reasoning,
            tradeoffs=tradeoffs,
            stakeholders=stakeholders,
            expected_outcome=expected_outcome,
            decision_date=datetime.utcnow()
        )
        db.add(pm_decision)
        await db.commit()
        await db.refresh(pm_decision)

        return {
            "success": True,
            "message": f"Logged decision #{next_num}: {title}",
            "data": {
                "decision_number": next_num,
                "title": title,
                "category": category
            }
        }
    except Exception as e:
        await db.rollback()
        return {
            "success": False,
            "error": f"Failed to log decision: {str(e)}"
        }


@tool_registry.register(
    name="get_work_context_summary",
    description="Get summary of what you know about the user's work context",
    parameters=[]
)
async def get_work_context_summary(
    user: User,
    db: AsyncSession
) -> Dict[str, Any]:
    """Get current work context summary"""
    result = await db.execute(
        select(WorkContext).filter(WorkContext.user_id == user.id)
    )
    work_context = result.scalar_one_or_none()

    if not work_context:
        work_context = WorkContext(user_id=user.id)
        db.add(work_context)
        await db.commit()
        await db.refresh(work_context)

    # Get counts
    projects_result = await db.execute(
        select(ActiveProject).filter(ActiveProject.user_id == user.id)
    )
    projects = projects_result.scalars().all()

    relationships_result = await db.execute(
        select(KeyRelationship).filter(KeyRelationship.user_id == user.id)
    )
    relationships = relationships_result.scalars().all()

    tasks_result = await db.execute(
        select(Task).filter(
            Task.user_id == user.id,
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


# Export registry
__all__ = ['tool_registry', 'ToolRegistry', 'SkillTool', 'ToolParameter']
