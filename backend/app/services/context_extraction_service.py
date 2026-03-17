"""
Context Extraction Service
LLM-based entity extraction from context sources
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any, Optional
import json

from app.models.context import (
    ContextSource, ExtractedEntity, EntityType,
    ContextProcessingStatus, ContextSourceType
)
from app.models.tenant import Tenant
from app.services.llm_service import get_llm_service_for_tenant


class ContextExtractionService:
    """Service for extracting entities from context sources"""

    def __init__(self, db: AsyncSession, tenant_id: int):
        self.db = db
        self.tenant_id = tenant_id
        self.llm_service = None  # Will be initialized when needed

    async def _get_llm_service(self):
        """Get LLM service instance"""
        if not self.llm_service:
            self.llm_service = await get_llm_service_for_tenant(self.tenant_id, self.db)
        return self.llm_service

    async def extract_entities_from_source(self, source_id: int) -> int:
        """
        Extract entities from a context source
        Returns number of entities extracted
        """
        # Get source
        query = select(ContextSource).where(
            ContextSource.id == source_id,
            ContextSource.tenant_id == self.tenant_id
        )
        result = await self.db.execute(query)
        source = result.scalar_one_or_none()

        if not source:
            raise ValueError(f"Source {source_id} not found")

        # Update status to processing
        source.status = ContextProcessingStatus.PROCESSING
        await self.db.commit()

        try:
            # Extract entities based on source type
            entities = await self._extract_by_source_type(source)

            # Save entities with rich metadata
            for entity_data in entities:
                # Build rich attributes for traceability
                attributes = entity_data.get('attributes', {})

                # Add source metadata
                if source.customer_name:
                    attributes['customer_name'] = source.customer_name
                if source.customer_segment:
                    attributes['customer_segment'] = source.customer_segment
                if source.customer_email:
                    attributes['customer_email'] = source.customer_email
                if source.source_date:
                    attributes['source_date'] = source.source_date.isoformat()

                # Add source type for context
                attributes['source_type'] = source.source_type.value
                attributes['source_name'] = source.name

                # Limit context snippet to 200 chars
                context_snippet = entity_data.get('context_snippet', '')
                if context_snippet and len(context_snippet) > 200:
                    context_snippet = context_snippet[:197] + '...'

                entity = ExtractedEntity(
                    tenant_id=self.tenant_id,
                    product_id=source.product_id,
                    source_id=source.id,
                    entity_type=entity_data['type'],
                    name=entity_data['name'],
                    description=entity_data['description'],
                    confidence_score=entity_data.get('confidence', 0.8),
                    category=entity_data.get('category'),
                    attributes=attributes,
                    context_snippet=context_snippet,
                )
                self.db.add(entity)

            # Update source status
            source.status = ContextProcessingStatus.COMPLETED
            source.entities_extracted_count = len(entities)
            await self.db.commit()

            return len(entities)

        except Exception as e:
            # Update status to failed
            source.status = ContextProcessingStatus.FAILED
            source.error_message = str(e)
            await self.db.commit()
            raise

    async def _extract_by_source_type(self, source: ContextSource) -> List[Dict[str, Any]]:
        """Extract entities based on source type"""

        # Get content to analyze
        content = self._get_content_for_extraction(source)
        if not content:
            return []

        # Call LLM for extraction
        llm = await self._get_llm_service()

        extraction_prompt = self._build_extraction_prompt(source.source_type, content)

        system_prompt = "You are an expert at extracting structured information from unstructured text."

        response = await llm.generate(
            prompt=extraction_prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=4000,  # Increased for longer entity lists
        )

        # Parse LLM response - extract content from LLMResponse object
        entities = self._parse_extraction_response(response.content)
        return entities

    def _get_content_for_extraction(self, source: ContextSource) -> str:
        """Get the text content from source"""
        if source.content:
            return source.content
        elif source.raw_content:
            return source.raw_content
        elif source.title:
            return source.title
        return ""

    def _build_extraction_prompt(self, source_type: ContextSourceType, content: str) -> str:
        """Build extraction prompt based on source type"""

        base_prompt = f"""
Extract relevant entities from the following {source_type.value} content.

Content:
{content[:4000]}  # Limit content length

Extract the following entity types (if present):
1. Pain Points - Technical/product problems, bugs, broken features
2. Feature Requests - Explicitly requested new capabilities
3. Product Capabilities - Existing features mentioned positively
4. Personas - Specific user types with job titles (e.g., "VP Engineering")
5. Competitors - Named competing products/companies
6. Use Cases - Specific scenarios describing product usage

**CRITICAL RULES (FOLLOW EXACTLY):**

1. **EXTRACT MAXIMUM ONE ENTITY PER FEEDBACK:**
   - Each piece of feedback is about ONE thing - extract only that ONE entity
   - "Dashboard is slow (30 sec)" → ONE pain_point: "Slow dashboard load time (30 seconds)"
   - "Dashboard is fast, team loves it" → ONE product_capability: "Fast dashboard performance"
   - "Need more colors" → ONE feature_request: "More color options for dashboard"
   - DON'T extract multiple entities about the same topic

2. **NEVER EXTRACT:**
   - Generic stakeholders: "our team", "users", "customers", "we" (only extract if named person with title)
   - Feature requests that are just fixes for pain points (e.g., if pain="slow load", don't also extract feature="improve load time")
   - Business consequences as separate entities (churn, lost deals) - put in business_impact attribute only
   - The same concept twice
   - Vague capabilities like "Dashboard performance" when feedback is about something else

3. **SENTIMENT TO TYPE MAPPING:**
   - Praise ("fast", "loves", "great") → product_capability
   - Complaint ("slow", "broken", "unacceptable") → pain_point
   - Bug report ("404", "error", "broken") → pain_point with category="bug"
   - Request ("need", "want", "add") → feature_request if it's NEW, otherwise pain_point if fixing existing

4. **BE SPECIFIC:**
   - Include metrics: "30 seconds", "404 error", "5 times per day"
   - Name the specific feature: "dashboard", "search", "API endpoint"
   - Bad: "Performance issues" → Good: "Slow dashboard load time (30 seconds)"

Return a JSON array with usually ONE entity (sometimes zero, rarely two if truly distinct topics):
[
  {{
    "type": "pain_point|feature_request|product_capability|persona|competitor|use_case",
    "name": "Specific, concise name with metrics if mentioned",
    "description": "Detailed description including business impact if mentioned",
    "confidence": 0.0-1.0,
    "category": "optional category (e.g., 'bug', 'performance', 'usability')",
    "attributes": {{
      "sentiment": "positive|negative|neutral",
      "urgency": "high|medium|low",
      "business_impact": "consequence if mentioned (e.g., 'customer churn', 'lost $100K deal')",
      "metric": "specific measurement if given (e.g., '30 seconds', '404 error')"
    }},
    "context_snippet": "Original text where found (max 200 chars)"
  }}
]

**IMPORTANT:** Return an empty array [] if the content has no extractable entities. Most feedback should produce EXACTLY ONE entity.

**Metadata Guidelines:**
- sentiment: positive (praise), negative (complaint), neutral
- urgency: HIGH if mentions churn/blocking/lost deals, MEDIUM for important issues, LOW for nice-to-haves
- business_impact: Store business consequences here (e.g., "customer churn", "lost $100K deal", "migration blocked")
- metric: Specific measurements mentioned (e.g., "30 seconds", "404 error", "$100K")
- context_snippet: Quote the key phrase from the original text (max 200 chars)
- confidence: Use 0.75 for most clear mentions, 0.6 for inferred, 0.9+ only for direct quotes with attribution
"""
        return base_prompt

    def _parse_extraction_response(self, response: str) -> List[Dict[str, Any]]:
        """Parse LLM response into entity list"""
        try:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                entities = json.loads(json_match.group())
                return entities
            return []
        except Exception as e:
            print(f"Error parsing extraction response: {e}")
            return []


async def extract_entities_from_source(
    db: AsyncSession,
    tenant_id: int,
    source_id: int
) -> int:
    """
    Helper function to extract entities from a source
    """
    service = ContextExtractionService(db, tenant_id)
    return await service.extract_entities_from_source(source_id)
