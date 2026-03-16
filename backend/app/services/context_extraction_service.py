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
1. Personas - Target user types, job titles, roles
2. Pain Points - Problems, frustrations, challenges mentioned
3. Use Cases - How the product is used, scenarios
4. Feature Requests - Desired features or improvements
5. Product Capabilities - Existing features, APIs, components
6. Stakeholders - Key people mentioned (customers, team members, partners)
7. Competitors - Competing products or companies mentioned
8. Technical Requirements - Technical constraints or requirements

Return a JSON array with this structure:
[
  {{
    "type": "persona|pain_point|use_case|feature_request|product_capability|stakeholder|competitor|technical_requirement",
    "name": "Short name or title",
    "description": "Detailed description",
    "confidence": 0.0-1.0,
    "category": "optional category",
    "attributes": {{
      "speaker_role": "job title if mentioned",
      "company_size": "company size if mentioned",
      "arr_value": numeric ARR if mentioned,
      "sentiment": "positive|negative|neutral",
      "urgency": "high|medium|low"
    }},
    "context_snippet": "Original text where found (max 200 chars)"
  }}
]

**IMPORTANT - Extract Rich Metadata:**
- speaker_role: Job title of person quoted (e.g., "VP Engineering", "CTO", "Product Manager")
- company_size: If mentioned (e.g., "50-200 employees", "Enterprise", "500+ employees")
- arr_value: Annual recurring revenue if mentioned (numeric value)
- sentiment: Whether this is positive, negative, or neutral
- urgency: How urgent/important this seems based on language used
- context_snippet: Keep under 200 characters but include key quote

**CRITICAL - Confidence Scoring Rules (Follow Strictly):**

Reserve 1.0 ONLY for entities with ALL of these:
- Direct quote with exact attribution
- Specific details (job title, company size, metrics)
- Clear context with no ambiguity
Example: "John Smith, CTO at 3,500 employee company DataCorp, said 'We lost $850K deal'"

Use 0.7-0.85 for most entities (this should be your default):
- Clear mention but missing some details
- Role stated but indirect attribution
- Example: "CTOs mentioned", "VP Engineering at mid-market SaaS"

Use 0.5-0.69 for:
- Inferred from behavior or context clues
- Multiple weak signals combined
- Example: "Technical stakeholders", "Engineering leadership indicated"

Use 0.3-0.49 for:
- Single vague mention
- Ambiguous or indirect reference
- Example: "Some engineers", "Team members suggested"

**TARGET DISTRIBUTION:** Aim for average score of 0.65-0.75. Only ~5-10% of entities should score 0.95+. Most should be 0.6-0.85. Be conservative - when in doubt, go lower!
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
