"""
Adviser Tool Registry
Central registry of tools that advisers can use
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


class ToolParameter(BaseModel):
    """Tool parameter definition"""
    name: str
    type: str  # "string", "integer", "array", "boolean", "object"
    description: str
    required: bool = True
    enum: Optional[List[str]] = None
    items: Optional[Dict[str, Any]] = None  # For array types


class AdviserTool(BaseModel):
    """Tool definition"""
    name: str
    description: str
    parameters: List[ToolParameter]
    handler: Any  # Will be the actual function


class ToolRegistry:
    """
    Central registry for adviser tools.
    Tools are functions that advisers can call to get data or perform actions.
    """

    def __init__(self):
        self._tools: Dict[str, AdviserTool] = {}

    def register(
        self,
        name: str,
        description: str,
        parameters: List[ToolParameter]
    ):
        """Decorator to register a tool"""
        def decorator(func: Callable):
            tool = AdviserTool(
                name=name,
                description=description,
                parameters=parameters,
                handler=func
            )
            self._tools[name] = tool
            return func
        return decorator

    def get_tool(self, name: str) -> Optional[AdviserTool]:
        """Get a tool by name"""
        return self._tools.get(name)

    def get_all_tools(self) -> Dict[str, AdviserTool]:
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
        product_id: Optional[int] = None
    ) -> Any:
        """Execute a tool with automatic tenant isolation and optional product scoping"""
        tool = self.get_tool(tool_name)
        if not tool:
            raise ValueError(f"Tool '{tool_name}' not found")

        # Inject tenant_id and db into arguments
        arguments['tenant_id'] = tenant_id
        arguments['db'] = db

        # Inject product_id if provided and tool accepts it
        if product_id is not None:
            # Check if tool accepts product_id parameter
            tool_params = {param.name for param in tool.parameters}
            if 'product_id' in tool_params:
                arguments['product_id'] = product_id

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
    description="Get recent feedback items from customers",
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
    """Get feedback items"""
    query = select(Feedback).where(Feedback.tenant_id == tenant_id)

    if product_id:
        query = query.where(Feedback.product_id == product_id)

    # Apply date filter
    if date_range and date_range != "all":
        days_map = {"7d": 7, "30d": 30, "90d": 90}
        days = days_map.get(date_range, 30)
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.where(Feedback.created_at >= cutoff)

    query = query.order_by(Feedback.created_at.desc())

    if limit:
        query = query.limit(limit)

    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "feedback_items": [
            {
                "id": int(item.id),
                "content": str(item.content) if item.content else "",
                "source": str(item.source) if item.source else "",
                "sentiment_score": float(item.sentiment_score) if item.sentiment_score is not None else 0.0,
                "created_at": item.created_at.isoformat() if item.created_at else None
            }
            for item in items
        ],
        "total_count": len(items)
    }


@tool_registry.register(
    name="get_feedback_summary",
    description="Get summary statistics about feedback",
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
    """Get feedback summary stats"""
    query = select(Feedback).where(Feedback.tenant_id == tenant_id)

    if product_id:
        query = query.where(Feedback.product_id == product_id)

    # Apply date filter
    if date_range and date_range != "all":
        days_map = {"7d": 7, "30d": 30, "90d": 90}
        days = days_map.get(date_range, 30)
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.where(Feedback.created_at >= cutoff)

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
        ToolParameter(name="reach", type="integer", description="Number of users impacted"),
        ToolParameter(name="impact", type="integer", description="Impact score (1-5)"),
        ToolParameter(name="confidence", type="integer", description="Confidence percentage (0-100)"),
        ToolParameter(name="effort", type="integer", description="Effort in person-weeks")
    ]
)
async def calculate_rice_score(
    reach: int,
    impact: int,
    confidence: int,
    effort: int,
    tenant_id: int,
    db: AsyncSession
) -> Dict[str, Any]:
    """Calculate RICE score"""
    if effort == 0:
        return {"error": "Effort cannot be zero"}

    confidence_decimal = confidence / 100.0
    rice_score = (reach * impact * confidence_decimal) / effort

    return {
        "rice_score": float(round(rice_score, 2)),
        "reach": int(reach),
        "impact": int(impact),
        "confidence": int(confidence),
        "effort": int(effort),
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

    # Get recent feedback
    query = select(Feedback).where(Feedback.tenant_id == tenant_id)
    if product_id:
        query = query.where(Feedback.product_id == product_id)
    query = query.order_by(Feedback.created_at.desc())
    result = await db.execute(query.limit(20))
    feedback = result.scalars().all()

    # Get extracted entities related to objective
    query = select(ExtractedEntity).where(
        ExtractedEntity.tenant_id == tenant_id
    )
    result = await db.execute(query.limit(50))
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
        "recent_feedback": [
            {
                "id": int(f.id),
                "content": str(f.content)[:200] if f.content else "",
                "category": str(f.category.value) if f.category else None,
                "sentiment_score": float(f.sentiment_score) if f.sentiment_score else 0.0
            }
            for f in feedback[:10]
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
    description="Get all context sources (meeting transcripts, surveys, documents, etc.) for analysis",
    parameters=[
        ToolParameter(name="source_type", type="string", description="Filter by source type (optional)", required=False),
        ToolParameter(name="status", type="string", description="Filter by processing status (optional)", required=False),
        ToolParameter(name="limit", type="integer", description="Maximum number of sources to return", required=False),
        ToolParameter(name="product_id", type="integer", description="Filter by product ID", required=False)
    ]
)
async def get_context_sources(
    tenant_id: int,
    db: AsyncSession,
    source_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: Optional[int] = 50,
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Get context sources with optional filtering"""
    query = select(ContextSource).where(ContextSource.tenant_id == tenant_id)

    if product_id:
        query = query.where(ContextSource.product_id == product_id)

    if source_type and source_type != 'all':
        query = query.where(ContextSource.source_type == source_type)

    if status and status != 'all':
        query = query.where(ContextSource.status == status)

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
    description="Get AI-extracted entities (personas, pain points, use cases, capabilities, etc.) from context sources",
    parameters=[
        ToolParameter(
            name="entity_type",
            type="string",
            description="Type of entity to retrieve",
            required=False,
            enum=["persona", "pain_point", "use_case", "feature_request", "product_capability", "stakeholder", "competitor", "all"]
        ),
        ToolParameter(name="limit", type="integer", description="Maximum number of entities to return", required=False),
        ToolParameter(name="product_id", type="integer", description="Filter by product ID", required=False)
    ]
)
async def get_extracted_entities(
    tenant_id: int,
    db: AsyncSession,
    entity_type: Optional[str] = "all",
    limit: Optional[int] = 100,
    product_id: Optional[int] = None
) -> Dict[str, Any]:
    """Get extracted entities with optional type filtering"""
    query = select(ExtractedEntity).where(ExtractedEntity.tenant_id == tenant_id)

    if product_id:
        query = query.where(ExtractedEntity.product_id == product_id)

    if entity_type and entity_type != 'all':
        query = query.where(ExtractedEntity.entity_type == entity_type)

    query = query.order_by(ExtractedEntity.created_at.desc())

    if limit:
        query = query.limit(limit)

    result = await db.execute(query)
    entities = result.scalars().all()

    return {
        "entities": [
            {
                "id": int(e.id),
                "source_id": int(e.source_id) if e.source_id else None,
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


# Export registry
__all__ = ['tool_registry', 'ToolRegistry', 'AdviserTool', 'ToolParameter']
