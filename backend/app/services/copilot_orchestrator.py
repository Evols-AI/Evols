"""
Copilot Orchestrator Service
Handles routing messages to appropriate advisers and managing conversations
"""

import re
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import os
from loguru import logger

from app.models.adviser import Adviser, CustomAdviser, AdviserConversation, AdviserMessage, AdviserType
from app.models.user import User
from app.models.tenant import Tenant
from app.services.llm_service import get_llm_service
from app.core.security import decrypt_llm_config
from app.services.copilot_function_calling import handle_function_calling, generate_without_tools


class CopilotOrchestrator:
    """Orchestrates conversations between users and AI advisers"""

    def __init__(self, db: AsyncSession, user: User):
        self.db = db
        self.user = user
        self.llm_service = None  # Will be initialized on first use

    async def get_llm_service(self):
        """Get or initialize LLM service with tenant configuration"""
        if self.llm_service:
            return self.llm_service

        # Get tenant's LLM configuration
        result = await self.db.execute(
            select(Tenant).where(Tenant.id == self.user.tenant_id)
        )
        tenant = result.scalar_one_or_none()

        # Use tenant config if available, otherwise use environment variables
        if tenant and tenant.llm_config:
            decrypted_config = decrypt_llm_config(tenant.llm_config)
            self.llm_service = get_llm_service(tenant_config=decrypted_config)
        else:
            # Fall back to environment variables
            self.llm_service = get_llm_service()

        return self.llm_service

    async def detect_adviser(
        self,
        message: str,
        conversation_history: List[AdviserMessage] = None
    ) -> Tuple[Optional[int], Optional[str]]:
        """
        Detect which adviser should handle this message.
        Returns (adviser_id, adviser_type) or (None, None) for general conversation.
        """
        # Check for @mention
        mention_match = re.search(r'@(\w+)', message)
        if mention_match:
            adviser_name = mention_match.group(1).lower()
            adviser = await self._find_adviser_by_name(adviser_name)
            if adviser:
                return (adviser[0], adviser[1])

        # Auto-classify based on keywords
        adviser = await self._classify_by_keywords(message)
        if adviser:
            return adviser

        # Check if we should continue with previous adviser
        if conversation_history:
            last_assistant_msg = next(
                (msg for msg in reversed(conversation_history) if msg.role == 'assistant' and msg.skill_id),
                None
            )
            if last_assistant_msg:
                return (last_assistant_msg.skill_id, last_assistant_msg.skill_type)

        return (None, None)

    async def _find_adviser_by_name(self, name: str) -> Optional[Tuple[int, str]]:
        """Find adviser by name (fuzzy match)"""
        # Try custom advisers first
        result = await self.db.execute(
            select(CustomAdviser)
            .where(CustomAdviser.tenant_id == self.user.tenant_id)
            .where(CustomAdviser.is_active == True)
            .where(func.lower(CustomAdviser.name).contains(name))
        )
        custom_adviser = result.scalars().first()
        if custom_adviser:
            return (custom_adviser.id, AdviserType.CUSTOM)

        # Try default advisers
        result = await self.db.execute(
            select(Adviser)
            .where(Adviser.is_active == True)
            .where(func.lower(Adviser.name).contains(name))
        )
        adviser = result.scalars().first()
        if adviser:
            return (adviser.id, AdviserType.DEFAULT)

        return None

    async def _classify_by_keywords(self, message: str) -> Optional[Tuple[int, str]]:
        """Classify message using keyword matching"""
        message_lower = message.lower()

        # Define keyword patterns for each adviser type
        patterns = {
            'roadmap': ['roadmap', 'prioritize', 'priority', 'quarter', 'planning', 'strategy', 'q1', 'q2', 'q3', 'q4', 'arr', 'revenue'],
            'rice': ['rice', 'score', 'scoring', 'ranking', 'calculate', 'prioritization', 'reach', 'impact', 'confidence', 'effort'],
            'prd': ['prd', 'spec', 'specification', 'requirements', 'user story', 'user stories', 'acceptance criteria', 'feature spec'],
            'persona': ['persona', 'segment', 'customer', 'user type', 'user segment', 'audience', 'demographic']
        }

        # Get all active advisers for this tenant
        result = await self.db.execute(
            select(CustomAdviser)
            .where(CustomAdviser.tenant_id == self.user.tenant_id)
            .where(CustomAdviser.is_active == True)
        )
        custom_advisers = result.scalars().all()

        result = await self.db.execute(
            select(Adviser)
            .where(Adviser.is_active == True)
        )
        default_advisers = result.scalars().all()

        # Check patterns
        for adviser_key, keywords in patterns.items():
            if any(keyword in message_lower for keyword in keywords):
                # Try to find matching adviser
                for adviser in custom_advisers:
                    if adviser_key in adviser.name.lower():
                        return (adviser.id, AdviserType.CUSTOM)

                for adviser in default_advisers:
                    if adviser_key in adviser.name.lower():
                        return (adviser.id, AdviserType.DEFAULT)

        return None

    async def load_adviser_config(self, adviser_id: int, adviser_type: str) -> Dict[str, Any]:
        """Load adviser configuration"""
        if adviser_type == AdviserType.CUSTOM:
            result = await self.db.execute(
                select(CustomAdviser).where(CustomAdviser.id == adviser_id)
            )
            adviser = result.scalars().first()
        else:
            result = await self.db.execute(
                select(Adviser).where(Adviser.id == adviser_id)
            )
            adviser = result.scalars().first()

        if not adviser:
            return None

        return {
            'id': adviser.id,
            'type': adviser_type,
            'name': adviser.name,
            'description': adviser.description,
            'icon': adviser.icon,
            'instructions': adviser.instructions,
            'tools': adviser.tools,
            'output_template': adviser.output_template
        }

    async def get_next_sequence_number(self, conversation_id: str) -> int:
        """Get next sequence number for message"""
        result = await self.db.execute(
            select(func.coalesce(func.max(AdviserMessage.sequence_number), 0))
            .where(AdviserMessage.conversation_id == conversation_id)
        )
        max_seq = result.scalar()
        return (max_seq or 0) + 1

    def build_system_prompt(self, adviser_config: Optional[Dict[str, Any]] = None) -> str:
        """Build system prompt for Claude"""
        if adviser_config:
            return f"""You are {adviser_config['name']}, an expert AI assistant for product managers.

{adviser_config['instructions']}

Remember:
- Be conversational and helpful
- Ask clarifying questions when needed
- Use the available tools to access data
- Provide structured, actionable recommendations
- Cite specific data from the tools
"""
        else:
            return """You are EvolsAI, an expert AI copilot for product managers.

You help product managers with various tasks including:
- Strategic roadmap planning
- Feature prioritization
- PRD writing
- Customer analysis
- Data-driven decision making

When a user's request is specific to one of these areas, you'll automatically switch to the appropriate specialized adviser mode.

Be conversational, ask clarifying questions, and provide actionable insights backed by data."""

    def format_conversation_history(self, messages: List[AdviserMessage]) -> List[Dict[str, str]]:
        """Format conversation history for Claude API"""
        formatted = []
        for msg in messages:
            formatted.append({
                'role': msg.role,
                'content': msg.content
            })
        return formatted

    async def generate_conversation_name(self, first_message: str) -> str:
        """Generate a name for the conversation based on first message"""
        # Simple truncation for now, could use Claude later
        if len(first_message) <= 50:
            return first_message
        return first_message[:47] + "..."

    async def chat(
        self,
        conversation_id: Optional[str],
        message: str,
        stream: bool = False,
        product_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Main chat method that handles message routing and response generation
        """
        # Load or create conversation
        if conversation_id:
            result = await self.db.execute(
                select(AdviserConversation).where(AdviserConversation.id == conversation_id)
            )
            conversation = result.scalars().first()

            if not conversation or conversation.user_id != self.user.id:
                raise ValueError("Conversation not found or access denied")

            # Update product_id in context_data if provided
            if product_id is not None:
                if conversation.context_data is None:
                    conversation.context_data = {}
                conversation.context_data['product_id'] = product_id

            # Load message history
            result = await self.db.execute(
                select(AdviserMessage)
                .where(AdviserMessage.conversation_id == conversation_id)
                .order_by(AdviserMessage.sequence_number)
            )
            history = result.scalars().all()
        else:
            # Create new conversation
            import uuid
            context_data = {'product_id': product_id} if product_id is not None else None
            conversation = AdviserConversation(
                id=str(uuid.uuid4()),
                user_id=self.user.id,
                tenant_id=self.user.tenant_id,
                session_name=await self.generate_conversation_name(message),
                context_data=context_data
            )
            self.db.add(conversation)
            await self.db.flush()
            history = []

        # Save user message
        user_msg = AdviserMessage(
            conversation_id=conversation.id,
            role='user',
            content=message,
            sequence_number=await self.get_next_sequence_number(conversation.id)
        )
        self.db.add(user_msg)
        await self.db.flush()

        # Detect adviser
        adviser_id, adviser_type = await self.detect_adviser(message, history)

        # Load adviser config if applicable
        adviser_config = None
        if adviser_id:
            adviser_config = await self.load_adviser_config(adviser_id, adviser_type)

        # Build prompt
        system_prompt = self.build_system_prompt(adviser_config)
        conversation_history = self.format_conversation_history(history)

        # Get LLM service
        llm_service = await self.get_llm_service()

        # Extract product_id from conversation context if available
        product_id = None
        if conversation and conversation.context_data:
            product_id = conversation.context_data.get('product_id')

        # Check if adviser has tools
        if adviser_config and adviser_config.get('tools'):
            # Use function calling mode
            assistant_content, tool_calls = await handle_function_calling(
                user_message=message,
                conversation_history=conversation_history,
                system_prompt=system_prompt,
                adviser_config=adviser_config,
                llm_service=llm_service,
                tenant_id=self.user.tenant_id,
                db=self.db,
                product_id=product_id
            )
        else:
            # Regular mode without tools
            assistant_content, tool_calls = await generate_without_tools(
                user_message=message,
                conversation_history=conversation_history,
                system_prompt=system_prompt,
                llm_service=llm_service
            )

        # Save assistant message
        metadata = {}
        if tool_calls:
            # Ensure tool_calls is JSON-serializable before saving to database
            import json
            try:
                # Test serialization
                serialized = json.dumps(tool_calls)
                metadata['tool_calls'] = json.loads(serialized)
            except (TypeError, ValueError) as e:
                logger.error(f"[Copilot] Tool calls not JSON-serializable: {e}")
                # Fallback: try with default=str
                try:
                    serialized = json.dumps(tool_calls, default=str)
                    metadata['tool_calls'] = json.loads(serialized)
                    logger.warning(f"[Copilot] Converted tool_calls metadata with default=str")
                except Exception as e2:
                    logger.error(f"[Copilot] Even default=str failed for metadata: {e2}")
                    metadata['tool_calls'] = [{"error": "Tool calls could not be serialized"}]

        assistant_msg = AdviserMessage(
            conversation_id=conversation.id,
            role='assistant',
            content=assistant_content,
            skill_id=adviser_id,
            skill_type=adviser_type,
            sequence_number=await self.get_next_sequence_number(conversation.id),
            message_metadata=metadata
        )
        self.db.add(assistant_msg)

        # Update conversation timestamp
        from datetime import datetime
        conversation.last_message_at = datetime.utcnow()

        await self.db.commit()

        return {
            'conversation_id': conversation.id,
            'message': {
                'id': assistant_msg.id,
                'role': 'assistant',
                'content': assistant_content,
                'adviser': adviser_config if adviser_id else None,
                'created_at': assistant_msg.created_at.isoformat()
            }
        }
