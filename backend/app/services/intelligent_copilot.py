"""
Intelligent Copilot Service
Cline-style intelligent agent that decides which skill to use based on full context.
No rigid routing - pure intelligence.
"""

import json
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from loguru import logger
from datetime import datetime

from app.models.user import User
from app.models.skill import SkillConversation, SkillMessage, SkillType, CustomSkill
from app.services.llm_service import get_llm_service
from app.services.skill_loader_service import get_skill_loader
from app.services.context_aggregator import ContextAggregator
from app.services.copilot_function_calling import handle_function_calling


class IntelligentCopilot:
    """
    Intelligent copilot that mimics Cline's approach:
    1. Read all available context
    2. Decide what to do intelligently
    3. Execute with full awareness
    """

    def __init__(self, db: AsyncSession, user: User):
        self.db = db
        self.user = user
        self.llm_service = None

    async def get_llm_service(self):
        """Get or initialize LLM service"""
        if self.llm_service:
            return self.llm_service

        from app.models.tenant import Tenant
        from app.core.security import decrypt_llm_config

        result = await self.db.execute(
            select(Tenant).where(Tenant.id == self.user.tenant_id)
        )
        tenant = result.scalar_one_or_none()

        if tenant and tenant.llm_config:
            decrypted_config = decrypt_llm_config(tenant.llm_config)
            self.llm_service = get_llm_service(tenant_config=decrypted_config)
        else:
            self.llm_service = get_llm_service()

        return self.llm_service

    async def chat(
        self,
        conversation_id: Optional[str],
        message: str,
        stream: bool = False,
        product_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Main chat method with intelligent skill routing.

        Unlike traditional routing:
        - No keyword matching
        - No rigid classification
        - Agent decides based on full context
        """

        # 1. Load or create conversation
        conversation = await self._get_or_create_conversation(conversation_id, product_id)

        # 2. Load conversation history
        history = await self._load_conversation_history(conversation.id)

        # 3. Aggregate ALL context (like Cline reads workspace)
        aggregator = ContextAggregator(self.db, self.user, product_id)
        full_context = await aggregator.get_full_context()

        # 4. Save user message
        user_msg = SkillMessage(
            conversation_id=conversation.id,
            role='user',
            content=message,
            sequence_number=await self._get_next_sequence_number(conversation.id)
        )
        self.db.add(user_msg)
        await self.db.commit()

        # 5. Let agent decide what to do (skill or general conversation)
        decision = await self._intelligent_skill_decision(
            message=message,
            history=history,
            context=full_context
        )

        # 6. Execute based on decision
        if decision['use_skill']:
            response = await self._execute_with_skill(
                conversation=conversation,
                message=message,
                history=history,
                skill_name=decision['skill_name'],
                context=full_context
            )
        else:
            response = await self._execute_general_conversation(
                conversation=conversation,
                message=message,
                history=history,
                context=full_context
            )

        # 7. Update conversation timestamp
        conversation.last_message_at = datetime.utcnow()
        await self.db.commit()

        return {
            'conversation_id': conversation.id,
            'message': response['content'],
            'skill_used': decision.get('skill_name'),
            'metadata': response.get('metadata', {})
        }

    async def _intelligent_skill_decision(
        self,
        message: str,
        history: List[SkillMessage],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Let Claude decide which skill to use (or none).
        This is the intelligence - no rigid rules.
        """

        # Build decision prompt
        decision_prompt = f"""You are an intelligent PM assistant. Based on the user's message and context, decide if you should use a specialized skill or handle it conversationally.

USER MESSAGE:
{message}

{context['skills_catalog']}

DECISION CRITERIA:
- Use a skill if the request clearly matches a skill's purpose
- DON'T use a skill for:
  * Quick questions or clarifications
  * Follow-ups to previous work
  * Brainstorming or ideation
  * General advice
- When in doubt, handle conversationally

Respond in JSON format:
{{
  "use_skill": true/false,
  "skill_name": "exact-skill-name" or null,
  "reasoning": "brief explanation"
}}"""

        llm = await self.get_llm_service()

        try:
            response = await llm.generate(
                prompt=decision_prompt,
                system_prompt="You are a decision-making assistant. Output only valid JSON.",
                temperature=0.0,
                max_tokens=150
            )

            # Parse JSON response
            decision = json.loads(response.content.strip())
            logger.info(f"[IntelligentCopilot] Decision: {decision}")

            return decision

        except Exception as e:
            logger.error(f"[IntelligentCopilot] Decision failed: {e}")
            # Fallback to general conversation
            return {
                'use_skill': False,
                'skill_name': None,
                'reasoning': 'Error in decision-making, defaulting to conversation'
            }

    async def _execute_with_skill(
        self,
        conversation: SkillConversation,
        message: str,
        history: List[SkillMessage],
        skill_name: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute using a specific skill.
        Load skill's full instructions and relevant context.
        """

        # 1. Load skill configuration
        skill_loader = get_skill_loader()
        skill_data = skill_loader.get_skill_by_name(skill_name)

        if not skill_data:
            logger.error(f"[IntelligentCopilot] Skill not found: {skill_name}")
            return await self._execute_general_conversation(
                conversation, message, history, context
            )

        # 2. Build system prompt with skill instructions + context
        context_str = ContextAggregator(self.db, self.user).format_context_for_prompt(context)

        system_prompt = f"""# Skill: {skill_data['name']}

{skill_data['instructions']}

{context_str}

IMPORTANT: You have access to function calling tools. Use them when needed."""

        # 3. Format conversation history
        formatted_history = [
            {'role': msg.role, 'content': msg.content}
            for msg in history
        ]

        # 4. Execute with function calling
        llm = await self.get_llm_service()

        tools_to_use = skill_data.get('tools', []) + [
            'get_work_context_summary',
            'update_role_info',
            'add_or_update_project',
            'add_task'
        ]

        response_content, metadata = await handle_function_calling(
            llm_service=llm,
            message=message,
            conversation_history=formatted_history,
            system_prompt=system_prompt,
            tools=tools_to_use,
            db=self.db,
            user=self.user,
            product_id=conversation.product_id
        )

        # 5. Save assistant message
        assistant_msg = SkillMessage(
            conversation_id=conversation.id,
            role='assistant',
            content=response_content,
            skill_name=skill_name,
            skill_type=SkillType.DEFAULT,
            sequence_number=await self._get_next_sequence_number(conversation.id),
            message_metadata=metadata
        )
        self.db.add(assistant_msg)
        await self.db.commit()

        return {
            'content': response_content,
            'metadata': metadata
        }

    async def _execute_general_conversation(
        self,
        conversation: SkillConversation,
        message: str,
        history: List[SkillMessage],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute as general conversation (no specific skill).
        Still has full context awareness.
        """

        # Build context-aware system prompt
        context_str = ContextAggregator(self.db, self.user).format_context_for_prompt(context)

        system_prompt = f"""You are an intelligent PM assistant with deep product management expertise.

{context_str}

You help product managers with:
- Strategic thinking and decision-making
- Feature prioritization and roadmap planning
- Customer analysis and feedback synthesis
- PRD writing and documentation
- Data-driven insights

Be conversational, ask clarifying questions, and provide actionable insights.
When appropriate, suggest using a specialized skill, but you can also help directly.

IMPORTANT: You have access to function calling tools to get data and context."""

        # Format history
        formatted_history = [
            {'role': msg.role, 'content': msg.content}
            for msg in history
        ]

        # Execute with function calling
        llm = await self.get_llm_service()

        default_tools = [
            'get_work_context_summary',
            'get_themes',
            'get_feedback_items',
            'get_personas',
            'get_features',
            'get_product_strategy',
            'get_customer_segments',
            'calculate_rice_score'
        ]

        response_content, metadata = await handle_function_calling(
            llm_service=llm,
            message=message,
            conversation_history=formatted_history,
            system_prompt=system_prompt,
            tools=default_tools,
            db=self.db,
            user=self.user,
            product_id=conversation.product_id
        )

        # Save assistant message
        assistant_msg = SkillMessage(
            conversation_id=conversation.id,
            role='assistant',
            content=response_content,
            skill_name=None,
            skill_type=None,
            sequence_number=await self._get_next_sequence_number(conversation.id),
            message_metadata=metadata
        )
        self.db.add(assistant_msg)
        await self.db.commit()

        return {
            'content': response_content,
            'metadata': metadata
        }

    async def _get_or_create_conversation(
        self,
        conversation_id: Optional[str],
        product_id: Optional[int]
    ) -> SkillConversation:
        """Get existing conversation or create new one"""
        if conversation_id:
            result = await self.db.execute(
                select(SkillConversation).where(SkillConversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()
            if conversation:
                return conversation

        # Create new conversation
        import uuid
        conversation = SkillConversation(
            id=str(uuid.uuid4()),
            user_id=self.user.id,
            tenant_id=self.user.tenant_id,
            product_id=product_id,
            name="New Conversation",
            last_message_at=datetime.utcnow()
        )
        self.db.add(conversation)
        await self.db.commit()

        return conversation

    async def _load_conversation_history(self, conversation_id: str) -> List[SkillMessage]:
        """Load conversation history"""
        result = await self.db.execute(
            select(SkillMessage)
            .where(SkillMessage.conversation_id == conversation_id)
            .order_by(SkillMessage.sequence_number)
        )
        return result.scalars().all()

    async def _get_next_sequence_number(self, conversation_id: str) -> int:
        """Get next sequence number for message"""
        result = await self.db.execute(
            select(func.coalesce(func.max(SkillMessage.sequence_number), 0))
            .where(SkillMessage.conversation_id == conversation_id)
        )
        max_seq = result.scalar()
        return (max_seq or 0) + 1
