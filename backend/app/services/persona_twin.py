"""
Persona Digital Twin Service
Creates AI-powered personas that can answer questions and vote on decisions
"""

from typing import List, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime

from app.models.persona import Persona
from app.models.feedback import Feedback
from app.services.llm_service import get_llm_service


class PersonaTwinService:
    """Service for simulating persona behavior using LLM"""

    def __init__(self, tenant_config: Optional[Dict[str, any]] = None):
        """
        Initialize PersonaTwin service with optional tenant LLM configuration

        Args:
            tenant_config: Optional tenant-specific LLM configuration (decrypted)
        """
        self.tenant_config = tenant_config

    async def get_persona_knowledge(
        self,
        persona: Persona,
        db: AsyncSession,
        limit: int = 20
    ) -> Dict[str, any]:
        """
        Retrieve persona's knowledge base from feedback data

        Args:
            persona: Persona object
            db: Database session
            limit: Max feedback items to retrieve

        Returns:
            Knowledge base dictionary with feedback and stats
        """
        # Get feedback for this persona's segment
        query = select(Feedback).where(
            and_(
                Feedback.tenant_id == persona.tenant_id,
                Feedback.customer_segment == persona.segment
            )
        ).order_by(Feedback.created_at.desc()).limit(limit)

        # If persona has industry filter, add that
        if persona.industry:
            # Filter by industry in extra_data
            result = await db.execute(query)
            all_feedback = result.scalars().all()
            feedback_items = [
                fb for fb in all_feedback
                if fb.extra_data and fb.extra_data.get('industry') == persona.industry
            ][:limit]
        else:
            result = await db.execute(query)
            feedback_items = result.scalars().all()

        # Aggregate feedback themes
        themes = {}
        categories = {}
        pain_points = []

        for fb in feedback_items:
            # Count categories
            if fb.category:
                cat = fb.category.value
                categories[cat] = categories.get(cat, 0) + 1

            # Extract pain points (complaints, bugs, feature requests)
            if fb.category and fb.category.value in ['bug', 'complaint', 'feature_request']:
                pain_points.append(fb.content[:200])  # First 200 chars

        return {
            'feedback_count': len(feedback_items),
            'feedback_items': feedback_items,
            'categories': categories,
            'top_pain_points': pain_points[:5],
            'segment': persona.segment,
            'industry': persona.industry,
        }

    def _build_persona_context(
        self,
        persona: Persona,
        knowledge: Dict[str, any]
    ) -> str:
        """Build rich context about the persona for the LLM"""

        context_parts = [
            f"You are roleplaying as a customer persona: {persona.name}",
            f"\nPersona Description: {persona.description}",
            f"\nSegment: {knowledge['segment']}",
        ]

        if knowledge.get('industry'):
            context_parts.append(f"Industry: {knowledge['industry']}")

        context_parts.append(f"\nBased on {knowledge['feedback_count']} feedback items from real customers in this segment.")

        # Add category distribution
        if knowledge['categories']:
            cat_str = ", ".join([f"{cat}: {count}" for cat, count in knowledge['categories'].items()])
            context_parts.append(f"\nFeedback categories: {cat_str}")

        # Add top pain points
        if knowledge['top_pain_points']:
            context_parts.append("\n\nTop pain points from feedback:")
            for i, pain in enumerate(knowledge['top_pain_points'][:3], 1):
                context_parts.append(f"{i}. {pain}")

        # Add recent feedback examples
        if knowledge['feedback_items']:
            context_parts.append("\n\nRecent feedback examples:")
            for fb in knowledge['feedback_items'][:5]:
                context_parts.append(f"- [{fb.category.value if fb.category else 'general'}] {fb.content[:150]}...")

        context_parts.append("\n\nRespond as this persona would, using their perspective and priorities. Be specific and reference actual feedback patterns when relevant.")

        return "\n".join(context_parts)

    async def ask_persona(
        self,
        persona: Persona,
        question: str,
        db: AsyncSession,
    ) -> Dict[str, any]:
        """
        Ask a persona a question and get their AI-powered response

        Args:
            persona: Persona object
            question: Question to ask
            db: Database session

        Returns:
            Response dict with answer, reasoning, and citations
        """
        # Get persona knowledge
        knowledge = await self.get_persona_knowledge(persona, db)

        # Build context
        context = self._build_persona_context(persona, knowledge)

        try:
            # Get LLM service with tenant configuration
            llm = get_llm_service(tenant_config=self.tenant_config)

            # Generate response using modern LLM service
            llm_response = await llm.generate(
                prompt=question,
                system_prompt=context,
                temperature=0.7,
                max_tokens=500,
            )

            response = llm_response.content

            # Extract citations (feedback that informed the response)
            citations = []
            for fb in knowledge['feedback_items'][:3]:
                citations.append({
                    'feedback_id': fb.id,
                    'content': fb.content[:100] + "...",
                    'category': fb.category.value if fb.category else None,
                })

            return {
                'persona_id': persona.id,
                'persona_name': persona.name,
                'question': question,
                'response': response,
                'reasoning': f"Based on {knowledge['feedback_count']} feedback items from {knowledge['segment']} customers",
                'confidence': min(0.6 + (knowledge['feedback_count'] / 50), 0.95),
                'citations': citations,
                'timestamp': datetime.utcnow(),
            }

        except Exception as e:
            return {
                'persona_id': persona.id,
                'persona_name': persona.name,
                'question': question,
                'response': f"I apologize, but I'm unable to respond at this time. {str(e)}",
                'reasoning': "Error generating response",
                'confidence': 0.0,
                'citations': [],
                'timestamp': datetime.utcnow(),
            }

    async def vote_on_options(
        self,
        persona: Persona,
        question: str,
        options: List[Dict[str, str]],
        db: AsyncSession,
    ) -> Dict[str, any]:
        """
        Have a persona vote on multiple options

        Args:
            persona: Persona object
            question: Decision question
            options: List of options with 'id' and 'description'
            db: Database session

        Returns:
            Vote result with choice, reasoning, and confidence
        """
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"=== VOTE START for {persona.name} (ID: {persona.id}) ===")
        logger.info(f"Question: {question}")
        logger.info(f"Options: {options}")

        # Get persona knowledge
        knowledge = await self.get_persona_knowledge(persona, db)
        logger.info(f"Knowledge retrieved: {knowledge['feedback_count']} feedback items")

        # Build context
        context = self._build_persona_context(persona, knowledge)
        logger.info(f"Context built (length: {len(context)} chars)")

        # Format options
        options_text = "\n".join([
            f"Option {opt['id']}: {opt['description']}"
            for opt in options
        ])

        prompt = f"""Decision Question: {question}

Available Options:
{options_text}

As this persona, which option would you choose and why?

Consider:
1. Your segment's priorities and pain points
2. Patterns from actual customer feedback
3. What would provide the most value to customers like you

Respond in this format:
CHOICE: [Option ID]
REASONING: [Your detailed reasoning based on feedback patterns]
CONFIDENCE: [Low/Medium/High]"""

        logger.info(f"About to call LLM for {persona.name}")

        try:
            # Get LLM service with tenant configuration
            llm = get_llm_service(tenant_config=self.tenant_config)

            # Generate response using modern LLM service
            llm_response = await llm.generate(
                prompt=prompt,
                system_prompt=context,
                temperature=0.6,  # Slightly lower for more consistent voting
                max_tokens=400,
            )

            logger.info(f"LLM call completed for {persona.name}")
            logger.info(f"Raw LLM response for {persona.name}: {llm_response.content}")

            response = llm_response.content

            # Parse response
            lines = response.split('\n')
            choice = None
            reasoning = ""
            confidence_str = "Medium"

            for line in lines:
                if line.startswith('CHOICE:'):
                    raw_choice = line.replace('CHOICE:', '').strip()
                    # Extract just the option ID (A, B, C, etc.)
                    # Handle formats like "A", "Option A", "[A]", etc.
                    import re
                    match = re.search(r'\b([A-Z])\b', raw_choice)
                    if match:
                        choice = match.group(1)
                    else:
                        choice = raw_choice
                    logger.info(f"Parsed choice for {persona.name}: '{choice}' from raw: '{raw_choice}'")
                elif line.startswith('REASONING:'):
                    reasoning = line.replace('REASONING:', '').strip()
                elif line.startswith('CONFIDENCE:'):
                    confidence_str = line.replace('CONFIDENCE:', '').strip()

            # Convert confidence to numeric
            confidence_map = {'Low': 0.4, 'Medium': 0.7, 'High': 0.9}
            confidence = confidence_map.get(confidence_str, 0.7)

            # Extract citations
            citations = []
            for fb in knowledge['feedback_items'][:2]:
                citations.append({
                    'feedback_id': fb.id,
                    'content': fb.content[:100] + "...",
                })

            result = {
                'persona_id': persona.id,
                'persona_name': persona.name,
                'segment': persona.segment,
                'choice': choice,
                'reasoning': reasoning,
                'confidence': confidence,
                'citations': citations,
            }
            logger.info(f"=== VOTE RESULT for {persona.name}: choice={choice} ===")
            return result

        except Exception as e:
            logger.error(f"=== VOTE ERROR for {persona.name}: {str(e)} ===")
            logger.exception(e)  # This will log the full stack trace
            return {
                'persona_id': persona.id,
                'persona_name': persona.name,
                'segment': persona.segment,
                'choice': None,
                'reasoning': f"Unable to vote: {str(e)}",
                'confidence': 0.0,
                'citations': [],
            }


# Global instance
persona_twin_service = PersonaTwinService()
