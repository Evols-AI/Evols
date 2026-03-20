"""
Copilot Orchestrator Service
Handles routing messages to appropriate skills and managing conversations
"""

import re
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import os
from loguru import logger
from pathlib import Path

from app.models.skill import Skill, CustomSkill, SkillConversation, SkillMessage, SkillType
from app.models.user import User
from app.models.tenant import Tenant
from app.services.llm_service import get_llm_service
from app.core.security import decrypt_llm_config
from app.services.copilot_function_calling import handle_function_calling, generate_without_tools
from app.services.unified_pm_os import SkillAdapter, KnowledgeManager, MemoryManager


class CopilotOrchestrator:
    """Orchestrates conversations between users and AI skills"""

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

    async def detect_skill(
        self,
        message: str,
        conversation_history: List[SkillMessage] = None
    ) -> Tuple[Optional[int], Optional[str]]:
        """
        Detect which skill should handle this message.
        Returns (skill_id, skill_type) or (None, None) for general conversation.
        """
        # Check for @mention (highest priority)
        mention_match = re.search(r'@(\w+)', message)
        if mention_match:
            skill_name = mention_match.group(1).lower()
            skill = await self._find_skill_by_name(skill_name)
            if skill:
                return (skill[0], skill[1])

        # Auto-classify based on keywords
        skill = await self._classify_by_keywords(message)
        if skill:
            return skill

        # Try LLM-based intelligent routing (fallback)
        skill = await self._classify_by_llm(message)
        if skill:
            return skill

        # Check if we should continue with previous skill
        if conversation_history:
            last_assistant_msg = next(
                (msg for msg in reversed(conversation_history) if msg.role == 'assistant' and msg.skill_id),
                None
            )
            if last_assistant_msg:
                return (last_assistant_msg.skill_id, last_assistant_msg.skill_type)

        return (None, None)

    async def _find_skill_by_name(self, name: str) -> Optional[Tuple[int, str]]:
        """Find skill by name (fuzzy match)"""
        # Try custom skills first
        result = await self.db.execute(
            select(CustomSkill)
            .where(CustomSkill.tenant_id == self.user.tenant_id)
            .where(CustomSkill.is_active == True)
            .where(func.lower(CustomSkill.name).contains(name))
        )
        custom_skill = result.scalars().first()
        if custom_skill:
            return (custom_skill.id, SkillType.CUSTOM)

        # Try default skills
        result = await self.db.execute(
            select(Skill)
            .where(Skill.is_active == True)
            .where(func.lower(Skill.name).contains(name))
        )
        skill = result.scalars().first()
        if skill:
            return (skill.id, SkillType.DEFAULT)

        return None

    async def _classify_by_keywords(self, message: str) -> Optional[Tuple[int, str]]:
        """Classify message using keyword matching"""
        message_lower = message.lower()

        # Define keyword patterns for each skill type
        patterns = {
            'roadmap': ['roadmap', 'prioritize', 'priority', 'quarter', 'planning', 'strategy', 'q1', 'q2', 'q3', 'q4', 'arr', 'revenue'],
            'rice': ['rice', 'score', 'scoring', 'ranking', 'calculate', 'prioritization', 'reach', 'impact', 'confidence', 'effort'],
            'prd': ['prd', 'spec', 'specification', 'requirements', 'user story', 'user stories', 'acceptance criteria', 'feature spec'],
            'persona': [
                # Direct persona mentions
                'persona', 'segment', 'user type', 'user segment', 'audience', 'demographic',
                # Preference/opinion questions (strong indicators)
                'would they prefer', 'would user prefer', 'would customer prefer',
                'does the user want', 'do users want', 'do customers want',
                'user preference', 'customer preference', 'user opinion', 'customer opinion',
                # Specific persona analysis questions
                'what would', 'how would', 'would terry', 'would sarah', 'would john',  # Questions about specific people
                'what does terry', 'what does sarah', 'what does john',  # Analyzing specific people
                'terry prefer', 'sarah prefer', 'john prefer',  # Common first names + prefer
                # Behavioral patterns
                'user behavior', 'customer behavior', 'user needs', 'customer needs',
                'user characteristics', 'customer characteristics', 'user profile', 'customer profile'
            ]
        }

        # Get all active skills for this tenant
        result = await self.db.execute(
            select(CustomSkill)
            .where(CustomSkill.tenant_id == self.user.tenant_id)
            .where(CustomSkill.is_active == True)
        )
        custom_skills = result.scalars().all()

        result = await self.db.execute(
            select(Skill)
            .where(Skill.is_active == True)
        )
        default_skills = result.scalars().all()

        # Check patterns
        for skill_key, keywords in patterns.items():
            if any(keyword in message_lower for keyword in keywords):
                # Try to find matching skill
                for skill in custom_skills:
                    if skill_key in skill.name.lower():
                        return (skill.id, SkillType.CUSTOM)

                for skill in default_skills:
                    if skill_key in skill.name.lower():
                        return (skill.id, SkillType.DEFAULT)

        return None

    async def _classify_by_llm(self, message: str) -> Optional[Tuple[int, str]]:
        """Use LLM to intelligently route message to appropriate skill"""
        try:
            # Get all available skills
            result = await self.db.execute(
                select(CustomSkill)
                .where(CustomSkill.tenant_id == self.user.tenant_id)
                .where(CustomSkill.is_active == True)
            )
            custom_skills = result.scalars().all()

            result = await self.db.execute(
                select(Skill)
                .where(Skill.is_active == True)
            )
            default_skills = result.scalars().all()

            all_skills = []
            for skill in custom_skills:
                all_skills.append({
                    'id': skill.id,
                    'type': SkillType.CUSTOM,
                    'name': skill.name,
                    'description': skill.description
                })
            for skill in default_skills:
                all_skills.append({
                    'id': skill.id,
                    'type': SkillType.DEFAULT,
                    'name': skill.name,
                    'description': skill.description
                })

            if not all_skills:
                return None

            # Build skill list for LLM
            skill_list = "\n".join([
                f"- {s['name']}: {s['description']}"
                for s in all_skills
            ])

            # Ask LLM to classify
            llm = await self.get_llm_service()

            classification_prompt = f"""Given this user message, determine which specialized skill would be BEST to handle it. Only suggest a skill if it's clearly a better fit than general conversation.

User message: "{message}"

Available skills:
{skill_list}

IMPORTANT ROUTING RULES:
- If the message asks about a SPECIFIC PERSON/CUSTOMER by name (e.g., "Would Terry prefer X?", "What does Sarah want?"), use "Persona Analyzer"
- If the message asks about USER PREFERENCES, CUSTOMER OPINIONS, or BEHAVIORAL ANALYSIS, use "Persona Analyzer"
- If the message asks about ROADMAP, PRIORITIZATION, or STRATEGIC PLANNING, use "Roadmap Planner"
- If the message asks to CALCULATE RICE SCORE or SCORE A FEATURE, use appropriate prioritization skill
- If it's a GENERAL QUESTION that doesn't need specialized analysis, return "none"

Respond with ONLY the skill name (exact match from list above) or "none" if general conversation is sufficient.
Do not explain, just output the skill name or "none"."""

            response = await llm.generate(
                prompt=classification_prompt,
                system_prompt="You are a routing classifier. Output only the skill name or 'none'. No explanations.",
                temperature=0.0,
                max_tokens=50
            )

            skill_name = response.content.strip().lower()

            # If LLM says "none", don't route to a skill
            if skill_name == "none" or not skill_name:
                return None

            # Find matching skill
            for skill_data in all_skills:
                if skill_name in skill_data['name'].lower() or skill_data['name'].lower() in skill_name:
                    logger.info(f"[Copilot] LLM routed to skill: {skill_data['name']}")
                    return (skill_data['id'], skill_data['type'])

            return None

        except Exception as e:
            logger.warning(f"[Copilot] LLM-based skill classification failed: {e}")
            return None

    async def load_skill_config(self, skill_id: int, skill_type: str) -> Dict[str, Any]:
        """Load skill configuration - tries file first, falls back to database"""
        if skill_type == SkillType.CUSTOM:
            result = await self.db.execute(
                select(CustomSkill).where(CustomSkill.id == skill_id)
            )
            skill = result.scalars().first()
        else:
            result = await self.db.execute(
                select(Skill).where(Skill.id == skill_id)
            )
            skill = result.scalars().first()

        if not skill:
            return None

        # NEW: Try loading from unified-pm-os SKILL.md file if file_path exists
        if skill_type == SkillType.DEFAULT and hasattr(skill, 'file_path') and skill.file_path:
            unified_pm_os_path = os.getenv('UNIFIED_PM_OS_PATH', '../unified-pm-os')

            try:
                adapter = SkillAdapter(unified_pm_os_path)
                skill_from_file = adapter.load_skill_from_file(skill.file_path)

                logger.info(f"Loaded skill '{skill.name}' from file: {skill.file_path}")

                return {
                    'id': skill.id,
                    'type': skill_type,
                    'name': skill_from_file['name'],
                    'description': skill_from_file.get('description', skill.description),
                    'icon': skill.icon,  # Keep icon from database
                    'instructions': skill_from_file['instructions'],
                    'tools': skill_from_file.get('tools', []),
                    'output_template': skill_from_file.get('output_template'),
                    'category': skill_from_file.get('category', 'unknown')
                }
            except Exception as e:
                logger.warning(f"Failed to load skill from file {skill.file_path}: {e}. Falling back to database.")
                # Fall through to database loading

        # Original database loading
        return {
            'id': skill.id,
            'type': skill_type,
            'name': skill.name,
            'description': skill.description,
            'icon': skill.icon,
            'instructions': skill.instructions,
            'tools': skill.tools,
            'output_template': skill.output_template
        }

    async def get_next_sequence_number(self, conversation_id: str) -> int:
        """Get next sequence number for message"""
        result = await self.db.execute(
            select(func.coalesce(func.max(SkillMessage.sequence_number), 0))
            .where(SkillMessage.conversation_id == conversation_id)
        )
        max_seq = result.scalar()
        return (max_seq or 0) + 1

    async def build_system_prompt(
        self,
        skill_config: Optional[Dict[str, Any]] = None,
        product_id: Optional[int] = None
    ) -> str:
        """Build system prompt for Claude with enhanced context from knowledge and memory"""

        # NEW: Build enhanced context if product_id is provided
        enhanced_context = ""

        if product_id:
            try:
                # Get product knowledge
                km = KnowledgeManager(self.db)
                knowledge = await km.get_product_knowledge(product_id)

                if knowledge and any(knowledge.values()):
                    enhanced_context += "\n## Product Knowledge\n\n"

                    if knowledge.get('strategy_doc'):
                        enhanced_context += f"**Product Strategy:**\n{knowledge['strategy_doc']}\n\n"

                    if knowledge.get('customer_segments_doc'):
                        enhanced_context += f"**Customer Segments:**\n{knowledge['customer_segments_doc']}\n\n"

                    if knowledge.get('competitive_landscape_doc'):
                        enhanced_context += f"**Competitive Landscape:**\n{knowledge['competitive_landscape_doc']}\n\n"

                    if knowledge.get('value_proposition_doc'):
                        enhanced_context += f"**Value Proposition:**\n{knowledge['value_proposition_doc']}\n\n"

                    if knowledge.get('metrics_and_targets_doc'):
                        enhanced_context += f"**Metrics & Targets:**\n{knowledge['metrics_and_targets_doc']}\n\n"

                # Get recent memory/past work
                mm = MemoryManager(self.db)
                recent_work = await mm.get_recent_skill_outputs(product_id, limit=5)

                if recent_work:
                    enhanced_context += "\n## Past Work (Memory)\n\n"
                    enhanced_context += "You have access to recent work done on this product:\n"
                    for work in recent_work:
                        created_date = work['created_at'].strftime('%Y-%m-%d') if work.get('created_at') else 'recent'
                        enhanced_context += f"- **{work['skill_name']}** ({created_date}): {work['summary']}\n"
                    enhanced_context += "\nReference this past work when relevant to provide continuity.\n\n"

            except Exception as e:
                logger.warning(f"Failed to load enhanced context for product {product_id}: {e}")

        if skill_config:
            return f"""You are {skill_config['name']}, an expert AI assistant for product managers.

{skill_config['instructions']}
{enhanced_context}

Remember:
- Be conversational and helpful
- Ask clarifying questions when needed
- Use the available tools to access data
- Provide structured, actionable recommendations
- Cite specific data from the tools
- Reference the product knowledge and past work when relevant to provide personalized, context-aware advice
"""
        else:
            return f"""You are EvolsAI, an expert AI copilot for product managers.
{enhanced_context}

IMPORTANT: You are currently analyzing data for a SPECIFIC PRODUCT. All your queries are automatically scoped to this product only. You will NOT see data from other products.

You have access to comprehensive tools including:

**Product Knowledge:**
- get_product_strategy - Product vision, mission, goals, positioning
- get_customer_segments - Target personas, ICP, market segments
- get_competitive_landscape - Competitors, differentiation, SWOT
- get_value_proposition - USPs, benefits, positioning statement
- get_metrics_and_targets - OKRs, KPIs, business goals
- get_all_product_knowledge - All strategy docs at once

**Past Work & Memory (KEY DIFFERENTIATOR):**
- get_past_skill_work - See recent skill executions (OSTs, PRDs, analyses done before)
- search_past_skill_work - Search past work by keyword (e.g., "retention", "pricing")
- get_skill_memory_details - Get full details of previous work (complete OST, SWOT, etc.)
- get_skill_usage_stats - Understand which skills/work have been prioritized

**Customer Intelligence:**
- get_context_sources - Uploaded feedback, meeting transcripts, surveys, documents
- get_extracted_entities - AI-extracted personas, pain points, features, use cases
- get_entity_summary - Entity counts and categories
- get_themes - Feedback themes and clusters
- get_feedback_items - Raw feedback data
- get_feedback_summary - Feedback statistics

**Product Data:**
- get_personas - Customer personas with vote counts
- get_features - Product features/initiatives with scores
- calculate_rice_score - RICE prioritization calculator

All data you see is product-scoped for data isolation and privacy.

IMPORTANT INSTRUCTIONS:

**Memory & Continuity (KEY):**
1. ALWAYS check past work first when users reference previous analyses or ask follow-up questions:
   - "Build on the OST we created" → get_past_skill_work(category='discovery')
   - "What assumptions did we identify?" → search_past_skill_work('assumptions')
   - "Continue from last week's analysis" → get_past_skill_work(limit=10)
   - "Show me our PRDs" → search_past_skill_work('prd')

2. When starting new work related to past work:
   - For experiments → Check if there's an OST to reference
   - For roadmaps → Check past OKRs, strategy work
   - For PRDs → Check related assumptions, user stories
   - This builds organizational knowledge over time

3. Reference past work in your responses to provide continuity:
   - "Based on the OST we created on 2025-01-15..."
   - "Building on the assumptions identified last month..."
   - "Consistent with the strategy documented in..."

**Customer Intelligence:**
4. When users ask about feedback from specific companies:
   - ALWAYS use customer_name parameter: get_extracted_entities(customer_name='Acme Corp')
   - Present BOTH positive and negative feedback if both exist

5. When analyzing feedback, check entity_type:
   - pain_point = problems, issues (NEGATIVE)
   - product_capability = features they like (POSITIVE)
   - feature_request = requested features (NEUTRAL)

6. You MUST use tools to fetch data - never say you don't have access

You help product managers with:
- Strategic roadmap planning
- Feature prioritization
- PRD writing
- Customer analysis
- Data-driven decision making

Be conversational, ask clarifying questions, and provide actionable insights backed by data from the tools."""

    def format_conversation_history(self, messages: List[SkillMessage]) -> List[Dict[str, str]]:
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
                select(SkillConversation).where(SkillConversation.id == conversation_id)
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
                select(SkillMessage)
                .where(SkillMessage.conversation_id == conversation_id)
                .order_by(SkillMessage.sequence_number)
            )
            history = result.scalars().all()
        else:
            # Create new conversation
            import uuid
            context_data = {'product_id': product_id} if product_id is not None else None
            conversation = SkillConversation(
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
        user_msg = SkillMessage(
            conversation_id=conversation.id,
            role='user',
            content=message,
            sequence_number=await self.get_next_sequence_number(conversation.id)
        )
        self.db.add(user_msg)
        await self.db.flush()

        # Detect skill
        skill_id, skill_type = await self.detect_skill(message, history)

        # Load skill config if applicable
        actual_skill_config = None
        if skill_id:
            actual_skill_config = await self.load_skill_config(skill_id, skill_type)

        # Determine which tools to use (skill tools or default general tools)
        if actual_skill_config:
            tools_config = actual_skill_config
        else:
            # Provide default tools for general copilot
            tools_config = {
                'tools': [
                    'get_context_sources',
                    'get_extracted_entities',
                    'get_entity_summary',
                    'get_themes',
                    'get_feedback_items',
                    'get_feedback_summary',
                    'get_personas',
                    'get_features',
                    'calculate_rice_score',
                    # Memory/past work tools
                    'get_past_skill_work',
                    'get_skill_memory_details',
                    'search_past_skill_work',
                    'get_skill_usage_stats',
                    # Product knowledge tools
                    'get_all_product_knowledge',
                    'get_product_strategy',
                    'get_customer_segments',
                    'get_competitive_landscape',
                    'get_value_proposition',
                    'get_metrics_and_targets'
                ]
            }

        # Build prompt with enhanced context
        system_prompt = await self.build_system_prompt(actual_skill_config, product_id=product_id)
        conversation_history = self.format_conversation_history(history)

        # Get LLM service
        llm_service = await self.get_llm_service()

        # Extract product_id from conversation context if available
        product_id = None
        if conversation and conversation.context_data:
            product_id = conversation.context_data.get('product_id')

        # Check if we have tools to use (now always true with default tools)
        if tools_config and tools_config.get('tools'):
            # Use function calling mode
            assistant_content, tool_calls = await handle_function_calling(
                user_message=message,
                conversation_history=conversation_history,
                system_prompt=system_prompt,
                skill_config=tools_config,
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

        assistant_msg = SkillMessage(
            conversation_id=conversation.id,
            role='assistant',
            content=assistant_content,
            skill_id=skill_id,
            skill_type=skill_type,
            sequence_number=await self.get_next_sequence_number(conversation.id),
            message_metadata=metadata
        )
        self.db.add(assistant_msg)

        # Update conversation timestamp
        from datetime import datetime
        conversation.last_message_at = datetime.utcnow()

        await self.db.commit()

        # NEW: Save skill output to memory for future context
        if actual_skill_config and product_id:
            try:
                mm = MemoryManager(self.db)
                await mm.save_skill_output(
                    product_id=product_id,
                    tenant_id=self.user.tenant_id,
                    skill_name=actual_skill_config['name'],
                    skill_category=actual_skill_config.get('category', 'unknown'),
                    input_data={'message': message, 'conversation_id': conversation.id},
                    output_data={'content': assistant_content},
                    summary=assistant_content[:200] if len(assistant_content) > 200 else assistant_content
                )
                logger.info(f"Saved skill memory for {actual_skill_config['name']}")
            except Exception as e:
                logger.warning(f"Failed to save skill memory: {e}")

        return {
            'conversation_id': conversation.id,
            'message': {
                'id': assistant_msg.id,
                'role': 'assistant',
                'content': assistant_content,
                'skill': actual_skill_config if skill_id else None,
                'created_at': assistant_msg.created_at.isoformat()
            }
        }
