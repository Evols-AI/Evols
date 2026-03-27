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

        extraction_prompt = self._build_extraction_prompt(source.source_type, content, source)

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

    def _build_extraction_prompt(self, source_type: ContextSourceType, content: str, source: ContextSource = None) -> str:
        """Build extraction prompt based on source type"""

        # Build metadata context if available
        metadata_context = ""
        if source:
            metadata_parts = []
            if source.customer_name:
                metadata_parts.append(f"Customer: {source.customer_name}")
            if source.customer_segment:
                metadata_parts.append(f"Segment: {source.customer_segment}")
            if source.customer_email:
                metadata_parts.append(f"Email: {source.customer_email}")

            if metadata_parts:
                metadata_context = f"\n\n**Source Metadata:**\n" + "\n".join(f"- {part}" for part in metadata_parts)

        base_prompt = f"""
Extract relevant entities from the following {source_type.value} content.{metadata_context}

Content:
{content[:4000]}  # Limit content length

Extract the following entity types (if present):
1. Pain Points - Technical/product problems, bugs, broken features
2. Feature Requests - Explicitly requested new capabilities
3. Product Capabilities - Existing features mentioned positively
4. Personas - User types/roles inferred from:
   - Explicit job titles (e.g., "VP Engineering", "Product Manager")
   - Behavioral patterns (e.g., "grading papers" → teacher, "managing team" → manager)
   - Context clues (e.g., "150 students" → teacher, "classroom budget" → educator)
   - Technical literacy level (e.g., "What is API key?" → non-technical user)
   - Customer segment metadata when available (e.g., "K-12 Education" → teacher/administrator)
5. Competitors - Named competing products/companies
6. Use Cases - Specific scenarios describing product usage

**CRITICAL RULES (FOLLOW EXACTLY):**

1. **EXTRACT MAXIMUM ONE ENTITY PER FEEDBACK:**
   - Each piece of feedback is about ONE thing - extract only that ONE entity
   - "Dashboard is slow (30 sec)" → ONE pain_point: "Slow dashboard load time (30 seconds)"
   - "Dashboard is fast, team loves it" → ONE product_capability: "Fast dashboard performance"
   - "Need more colors" → ONE feature_request: "More color options for dashboard"
   - "I have 150 students and need to grade papers automatically" → ONE persona: "K-12 Teacher with high workload"
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
   - Role/behavior indicators ("I have 150 students", "classroom budget", "What is API key?") → persona

3a. **WHEN TO EXTRACT PERSONAS:**
   - Extract persona when feedback reveals WHO the user is (role, technical level, context)
   - Key indicators: job context, behavioral patterns, technical literacy, constraints
   - **USE SOURCE METADATA**: If customer segment is provided (e.g., "K-12 Education"), combine it with behavioral clues
   - Examples that should extract personas:
     * "I have 150 students and only $50/month budget" + Segment: "K-12 Education" → persona: "Budget-Constrained K-12 Teacher"
     * "What is an API key? The onboarding asks for one" + low technical literacy → persona: "Non-Technical User"
     * "As a VP of Engineering managing 50 developers..." → persona (explicit role)
   - DON'T extract persona for generic feedback that could come from anyone:
     * "The dashboard is slow" (no role indicators) → pain_point
     * "Need dark mode" (no role indicators) → feature_request

   **IMPORTANT FOR CSV DATA**: When customer segment is provided in metadata (e.g., "K-12 Education", "Enterprise", "Healthcare"),
   use it to infer the persona even if not explicitly stated in the content. Look for behavioral clues that confirm the segment.

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
      "metric": "specific measurement if given (e.g., '30 seconds', '404 error')",

      // FOR PERSONAS ONLY - include these additional fields:
      "job_role": "inferred or stated role (e.g., 'K-12 Teacher', 'VP Engineering')",
      "technical_literacy": "high|medium|low (inferred from questions, terminology)",
      "key_constraints": ["budget constraints", "time constraints", etc],
      "workload_indicators": ["150 students", "50 reports", etc],
      "revenue_contribution": numeric value if mentioned (e.g., 50000 for $50K ARR, 100000 for $100K deal size),
      "usage_frequency": "Daily|Weekly|Monthly" (inferred from usage patterns mentioned like "every day", "check weekly", "monthly review")
    }},
    "context_snippet": "Original text where found (max 200 chars)"
  }}
]

**Example persona extraction with metadata:**
Input:
- Content: "I only have $50/month for my classroom budget, but I need something fast. I have 150 students."
- Metadata: Customer: Terry Davis, Segment: K-12 Education

Output:
[
  {{
    "type": "persona",
    "name": "Budget-Constrained K-12 Teacher",
    "description": "K-12 educator (Terry Davis) managing 150 students with limited classroom budget ($50/month). Needs fast, simple solutions due to high workload and resource constraints.",
    "confidence": 0.85,
    "category": "education",
    "attributes": {{
      "sentiment": "neutral",
      "urgency": "high",
      "job_role": "K-12 Teacher",
      "technical_literacy": "low",
      "key_constraints": ["$50/month budget", "150 students to manage"],
      "workload_indicators": ["150 students"],
      "revenue_contribution": 600,
      "usage_frequency": "Daily"
    }},
    "context_snippet": "I only have $50/month for my classroom budget... I have 150 students."
  }}
]

**Another example with technical literacy:**
Input:
- Content: "What is an API key? The onboarding is asking me for one but I have no idea what that is."
- Metadata: Segment: K-12 Education

Output:
[
  {{
    "type": "persona",
    "name": "Non-Technical K-12 Educator",
    "description": "K-12 educator with low technical literacy. Struggles with technical concepts like API keys. Needs simplified onboarding and clear, non-technical instructions.",
    "confidence": 0.80,
    "category": "education",
    "attributes": {{
      "sentiment": "negative",
      "urgency": "high",
      "job_role": "K-12 Educator",
      "technical_literacy": "low",
      "key_constraints": ["Limited technical knowledge", "Needs simple interfaces"],
      "workload_indicators": []
    }},
    "context_snippet": "What is an API key? The onboarding is asking me for one..."
  }}
]

**Example with revenue and usage patterns:**
Input:
- Content: "As VP of Engineering at our $50M ARR company, I check the dashboard every morning. Our team of 50 engineers needs real-time data."
- Metadata: Segment: Enterprise

Output:
[
  {{
    "type": "persona",
    "name": "Enterprise VP of Engineering",
    "description": "VP of Engineering at high-revenue company ($50M ARR) managing 50 engineers. Daily user requiring real-time data access. High technical literacy and authority to make purchasing decisions.",
    "confidence": 0.90,
    "category": "enterprise",
    "attributes": {{
      "sentiment": "neutral",
      "urgency": "medium",
      "job_role": "VP of Engineering",
      "technical_literacy": "high",
      "key_constraints": ["Needs real-time data", "Managing large team"],
      "workload_indicators": ["50 engineers"],
      "revenue_contribution": 50000000,
      "usage_frequency": "Daily"
    }},
    "context_snippet": "As VP of Engineering at our $50M ARR company, I check the dashboard every morning..."
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
- revenue_contribution (personas only): Extract numeric ARR/MRR/deal size if mentioned (e.g., "$50K ARR" → 50000, "$2M contract" → 2000000)
- usage_frequency (personas only): Infer from usage patterns ("every day"/"daily" → Daily, "weekly check-in" → Weekly, "monthly review" → Monthly)
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
