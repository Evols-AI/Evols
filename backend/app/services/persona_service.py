"""
Persona Service
Auto-generate digital twin personas from customer segments, with full citations
"""

import json
from typing import List, Dict, Any, Optional
from collections import defaultdict
from loguru import logger

from app.services.llm_service import LLMService, get_llm_service, PERSONA_GENERATION_SYSTEM_PROMPT
from app.core.citations import CitedContent, Citation, CitationSourceType


class PersonaResult:
    """A generated persona digital twin with citations"""

    def __init__(
        self,
        name: str,
        role: str,
        segment: str,
        company_size_range: str,
        key_pain_points: List[str],
        goals: List[str],
        buying_triggers: List[str],
        feature_priorities: List[str],
        budget_authority: str,
        decision_time_days: int,
        confidence_score: float,
        based_on_feedback_count: int,
        based_on_account_count: int,
        profile_summary: CitedContent,
        raw_profile: Dict[str, Any],
    ):
        self.name = name
        self.role = role
        self.segment = segment
        self.company_size_range = company_size_range
        self.key_pain_points = key_pain_points
        self.goals = goals
        self.buying_triggers = buying_triggers
        self.feature_priorities = feature_priorities
        self.budget_authority = budget_authority
        self.decision_time_days = decision_time_days
        self.confidence_score = confidence_score
        self.based_on_feedback_count = based_on_feedback_count
        self.based_on_account_count = based_on_account_count
        self.profile_summary = profile_summary
        self.raw_profile = raw_profile


class PersonaSimulationResult:
    """Result of simulating a persona's response to a question"""

    def __init__(
        self,
        persona_name: str,
        question: str,
        response: str,
        reasoning: str,
        confidence: float,
        citations: List[Citation],
    ):
        self.persona_name = persona_name
        self.question = question
        self.response = response
        self.reasoning = reasoning
        self.confidence = confidence
        self.citations = citations


class PersonaVoteResult:
    """Result of persona voting on decision options"""

    def __init__(
        self,
        persona_name: str,
        segment: str,
        votes: List[Dict[str, Any]],  # [{option_id, option_title, score, reasoning}]
        top_choice: str,
        confidence: float,
    ):
        self.persona_name = persona_name
        self.segment = segment
        self.votes = votes
        self.top_choice = top_choice
        self.confidence = confidence


class PersonaService:
    """
    Generates and simulates customer persona digital twins.
    Each persona is grounded in real feedback and account data.
    """

    def __init__(self, llm_service: Optional[LLMService] = None, tenant_config: Optional[Dict[str, Any]] = None):
        self.llm = llm_service or get_llm_service(tenant_config=tenant_config)
        self.tenant_config = tenant_config

    # ------------------------------------------------------------------ #
    # Persona generation
    # ------------------------------------------------------------------ #

    async def generate_personas(
        self,
        feedback_items: List[Any],
        accounts: Optional[List[Any]] = None,
        progress_callback=None,
    ) -> List[PersonaResult]:
        """
        Auto-generate personas by clustering feedback by segment and synthesizing profiles.

        Args:
            feedback_items: Feedback ORM instances.
            accounts: Account ORM instances.
            progress_callback: async fn(float, str) for progress updates.

        Returns:
            List of PersonaResult, one per segment with enough data.
        """
        accounts = accounts or []

        async def _progress(p: float, msg: str):
            if progress_callback:
                await progress_callback(p, msg)
            logger.info(f"[PersonaService] {int(p * 100)}% – {msg}")

        # Group feedback by segment
        await _progress(0.1, "Grouping customers by segment…")
        segment_feedback = defaultdict(list)
        for item in feedback_items:
            seg = item.customer_segment or "Unknown"
            segment_feedback[seg].append(item)

        # Build account lookup
        account_lookup: Dict[str, List[Any]] = defaultdict(list)
        for acct in accounts:
            seg = getattr(acct, "segment", None) or "Unknown"
            account_lookup[seg].append(acct)

        # Generate one persona per segment (min 3 feedback items)
        segments = [s for s, items in segment_feedback.items() if len(items) >= 3]
        personas: List[PersonaResult] = []

        for idx, segment in enumerate(segments):
            progress = 0.15 + 0.8 * (idx / max(len(segments), 1))
            await _progress(progress, f"Building persona for segment: {segment}…")

            persona = await self._build_persona(
                segment=segment,
                feedback_items=segment_feedback[segment],
                segment_accounts=account_lookup.get(segment, []),
            )
            if persona:
                personas.append(persona)

        await _progress(1.0, f"Done – generated {len(personas)} personas.")
        return personas

    async def _build_persona(
        self,
        segment: str,
        feedback_items: List[Any],
        segment_accounts: List[Any],
    ) -> Optional[PersonaResult]:
        """Build one persona for a segment using the LLM."""

        # Aggregate pain points from feedback text
        sample_feedback = "\n".join(
            f"- {item.content[:250]}" for item in feedback_items[:20]
        )

        # Account metadata
        account_names = list({
            getattr(a, "name", "Unknown") for a in segment_accounts[:10]
        })
        total_arr = sum(
            getattr(a, "arr", 0) or 0 for a in segment_accounts
        )

        prompt = f"""Create a detailed persona for the "{segment}" customer segment.

Data available:
- {len(feedback_items)} feedback items from this segment
- {len(segment_accounts)} accounts (total ARR: ${total_arr:,.0f})
- Example accounts: {", ".join(account_names[:5]) or "N/A"}

Sample feedback from this segment:
{sample_feedback}

Respond with JSON:
{{
  "name": "<Persona name, e.g. 'Mid-Market Ops Director'>",
  "role": "<Primary job title>",
  "segment": "{segment}",
  "company_size_range": "<e.g. 50-200 employees>",
  "key_pain_points": ["<pain 1>", "<pain 2>", "<pain 3>"],
  "goals": ["<goal 1>", "<goal 2>"],
  "buying_triggers": ["<trigger 1>", "<trigger 2>"],
  "feature_priorities": ["<feature 1>", "<feature 2>", "<feature 3>"],
  "budget_authority": "<e.g. $10K-50K>",
  "decision_time_days": <integer>,
  "profile_summary": "<2-3 sentence summary of this persona>"
}}"""

        try:
            result = await self.llm.generate_structured(
                prompt=prompt,
                response_model={
                    "name": "string",
                    "role": "string",
                    "segment": "string",
                    "company_size_range": "string",
                    "key_pain_points": ["string"],
                    "goals": ["string"],
                    "buying_triggers": ["string"],
                    "feature_priorities": ["string"],
                    "budget_authority": "string",
                    "decision_time_days": 0,
                    "profile_summary": "string",
                },
                system_prompt=PERSONA_GENERATION_SYSTEM_PROMPT,
            )
        except Exception as e:
            logger.error(f"Persona generation failed for segment '{segment}': {e}")
            return None

        # Build citations
        citations = [
            Citation(
                source_type=CitationSourceType.FEEDBACK,
                source_id=item.id,
                quote=item.content[:200],
                confidence=1.0,
                metadata={"segment": segment, "customer_name": item.customer_name},
            )
            for item in feedback_items[:10]
        ]

        confidence = min(
            0.5 + (len(feedback_items) / 40) + (len(segment_accounts) / 20),
            1.0,
        )

        profile_cited = CitedContent(
            content=result.get("profile_summary", ""),
            citations=citations,
            confidence_score=confidence,
        )

        return PersonaResult(
            name=result.get("name", f"{segment} Persona"),
            role=result.get("role", ""),
            segment=segment,
            company_size_range=result.get("company_size_range", ""),
            key_pain_points=result.get("key_pain_points", []),
            goals=result.get("goals", []),
            buying_triggers=result.get("buying_triggers", []),
            feature_priorities=result.get("feature_priorities", []),
            budget_authority=result.get("budget_authority", ""),
            decision_time_days=int(result.get("decision_time_days", 60)),
            confidence_score=confidence,
            based_on_feedback_count=len(feedback_items),
            based_on_account_count=len(segment_accounts),
            profile_summary=profile_cited,
            raw_profile=result,
        )

    # ------------------------------------------------------------------ #
    # Persona simulation
    # ------------------------------------------------------------------ #

    async def simulate_response(
        self,
        persona: Any,          # Persona ORM or PersonaResult
        question: str,
        related_feedback: Optional[List[Any]] = None,
    ) -> PersonaSimulationResult:
        """
        Simulate how a persona would respond to a question or scenario.

        Args:
            persona: Persona with profile data.
            question: The question / scenario to simulate.
            related_feedback: Optional relevant feedback to ground the response.

        Returns:
            PersonaSimulationResult with response, reasoning and citations.
        """
        # Build persona context
        profile = getattr(persona, "profile", None) or {}
        pain_points = (
            getattr(persona, "key_pain_points", None)
            or profile.get("key_pain_points", [])
        )
        priorities = (
            getattr(persona, "feature_priorities", None)
            or profile.get("feature_priorities", [])
        )
        segment = getattr(persona, "segment", "Unknown")
        name = getattr(persona, "name", "Persona")
        budget = getattr(persona, "budget_authority", "Unknown")

        # Relevant feedback context
        feedback_context = ""
        citations: List[Citation] = []
        if related_feedback:
            sample = related_feedback[:5]
            feedback_context = "\n".join(
                f'- [{i.customer_segment}] "{i.content[:200]}"' for i in sample
            )
            citations = [
                Citation(
                    source_type=CitationSourceType.FEEDBACK,
                    source_id=i.id,
                    quote=i.content[:200],
                    confidence=0.9,
                    metadata={"segment": i.customer_segment},
                )
                for i in sample
            ]

        prompt = f"""You are simulating the perspective of a customer persona called "{name}" in the "{segment}" segment.

Persona profile:
- Key pain points: {", ".join(pain_points[:4])}
- Feature priorities: {", ".join(priorities[:4])}
- Budget authority: {budget}

{f"Supporting evidence from real customers like this persona:{chr(10)}{feedback_context}" if feedback_context else ""}

Question / scenario: "{question}"

Respond as this persona would, grounded in their known priorities and pain points.
Respond with JSON:
{{
  "response": "<2-4 sentence response from the persona's perspective>",
  "reasoning": "<1-2 sentence explanation of why they feel this way>",
  "confidence": <0.0-1.0 float>
}}"""

        try:
            result = await self.llm.generate_structured(
                prompt=prompt,
                response_model={"response": "string", "reasoning": "string", "confidence": 0.0},
            )
            return PersonaSimulationResult(
                persona_name=name,
                question=question,
                response=result.get("response", ""),
                reasoning=result.get("reasoning", ""),
                confidence=float(result.get("confidence", 0.7)),
                citations=citations,
            )
        except Exception as e:
            logger.error(f"Persona simulation failed: {e}")
            return PersonaSimulationResult(
                persona_name=name,
                question=question,
                response="Simulation failed – please retry.",
                reasoning=str(e),
                confidence=0.0,
                citations=[],
            )

    # ------------------------------------------------------------------ #
    # Trade-off voting
    # ------------------------------------------------------------------ #

    async def vote_on_options(
        self,
        persona: Any,
        options: List[Dict[str, Any]],  # [{id, title, description}]
        related_feedback: Optional[List[Any]] = None,
    ) -> PersonaVoteResult:
        """
        Have a persona 'vote' on 2-4 decision options with reasoning.

        Returns:
            PersonaVoteResult with ranked votes and top choice.
        """
        name = getattr(persona, "name", "Persona")
        segment = getattr(persona, "segment", "Unknown")
        pain_points = getattr(persona, "key_pain_points", [])
        priorities = getattr(persona, "feature_priorities", [])
        budget = getattr(persona, "budget_authority", "Unknown")

        options_text = "\n".join(
            f"Option {opt['id']}: {opt['title']}\n  {opt.get('description', '')}"
            for opt in options
        )

        prompt = f"""You are voting as persona "{name}" (segment: {segment}).

Your priorities:
- Pain points: {", ".join(pain_points[:3])}
- Feature priorities: {", ".join(priorities[:3])}
- Budget: {budget}

The following {len(options)} options are on the table:
{options_text}

Score each option from 0.0-1.0 based on how well it addresses your needs.
Respond with JSON:
{{
  "votes": [
    {{"option_id": "<id>", "option_title": "<title>", "score": 0.0, "reasoning": "<1 sentence>"}}
  ],
  "top_choice": "<option_id of best option>",
  "confidence": <0.0-1.0>
}}"""

        try:
            result = await self.llm.generate_structured(
                prompt=prompt,
                response_model={
                    "votes": [{"option_id": "", "option_title": "", "score": 0.0, "reasoning": ""}],
                    "top_choice": "",
                    "confidence": 0.0,
                },
            )
            return PersonaVoteResult(
                persona_name=name,
                segment=segment,
                votes=result.get("votes", []),
                top_choice=result.get("top_choice", ""),
                confidence=float(result.get("confidence", 0.7)),
            )
        except Exception as e:
            logger.error(f"Persona voting failed: {e}")
            return PersonaVoteResult(
                persona_name=name,
                segment=segment,
                votes=[],
                top_choice="",
                confidence=0.0,
            )
