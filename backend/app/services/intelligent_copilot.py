"""
Intelligent Copilot Service
Cline-style intelligent agent that decides which skill to use based on full context.
No rigid routing - pure intelligence.
"""

import json
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
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

    async def load_skill_config(self, skill_name: str, skill_type: str) -> Dict[str, Any]:
        """Load skill configuration from files or database"""
        if skill_type == SkillType.CUSTOM:
            # Load custom skill from database
            result = await self.db.execute(
                select(CustomSkill)
                .where(CustomSkill.name == skill_name)
                .where(CustomSkill.tenant_id == self.user.tenant_id)
            )
            skill = result.scalars().first()

            if not skill:
                return None

            return {
                'name': skill.name,
                'type': skill_type,
                'description': skill.description,
                'icon': skill.icon,
                'instructions': skill.instructions,
                'tools': skill.tools or [],
                'output_template': skill.output_template
            }
        else:
            # Load framework skill from files
            skill_loader = get_skill_loader()
            logger.info(f"[DEBUG] Loading framework skill: {skill_name}")
            skill_data = skill_loader.get_skill_by_name(skill_name)

            if not skill_data:
                logger.error(f"[DEBUG] Skill '{skill_name}' not found in skill loader")
                all_skills = list(skill_loader.load_all_skills().keys())
                logger.error(f"[DEBUG] Available skills: {all_skills[:10]}...")  # Log first 10 skills
                return None

            logger.info(f"[DEBUG] Successfully loaded skill '{skill_name}' with tools: {skill_data.get('tools', [])}")

            return {
                'name': skill_data['name'],
                'type': skill_type,
                'description': skill_data.get('description', ''),
                'icon': '⚡',  # Default icon
                'instructions': skill_data['instructions'],
                'tools': skill_data.get('tools', []),
                'output_template': skill_data.get('output_template')
            }

    async def build_system_prompt(
        self,
        skill_config: Optional[Dict[str, Any]] = None,
        product_id: Optional[int] = None
    ) -> str:
        """Build system prompt for skill execution"""
        if skill_config:
            # Build system prompt with skill instructions
            aggregator = ContextAggregator(self.db, self.user)
            context = await aggregator.get_lightweight_context()
            context_str = aggregator.format_context_for_prompt(context)

            skill_name = skill_config.get('name', 'skill')
            skill_instructions = skill_config.get('instructions', '')

            return f"""You are Evols, an expert AI assistant for product managers. You are using the {skill_name} skill to help the user.

{skill_instructions}

{context_str}

IMPORTANT: Only call tools when you have enough information. If the user's request is unclear or you need more details, ask clarifying questions first."""
        else:
            # Generic system prompt
            return "You are Evols, an expert AI assistant for product managers."

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

        # Extract conversation_id early to avoid detached session issues after tool calls
        conversation_id_str = conversation.id

        # 2. Load conversation history
        history = await self._load_conversation_history(conversation_id_str)

        # 3. Aggregate lightweight context for skill decision (saves ~4,800 tokens)
        aggregator = ContextAggregator(self.db, self.user, product_id)
        lightweight_context = await aggregator.get_full_context()  # Now returns lightweight skills catalog

        # 4. Save user message
        user_msg = SkillMessage(
            conversation_id=conversation_id_str,
            role='user',
            content=message,
            sequence_number=await self._get_next_sequence_number(conversation_id_str)
        )
        self.db.add(user_msg)
        await self.db.commit()

        try:
            # 5. Let agent decide what to do (skill or general conversation) - using lightweight context
            decision = await self._intelligent_skill_decision(
                message=message,
                history=history,
                context=lightweight_context
            )

            # 6. Execute based on decision
            if decision['use_skill']:
                # Load full skill context only when skill is selected (saves tokens)
                full_skill_context = await aggregator.get_full_skill_details(decision['skill_name'])

                response = await self._execute_with_skill(
                    conversation_id=conversation_id_str,
                    message=message,
                    history=history,
                    skill_name=decision['skill_name'],
                    context=lightweight_context,
                    skill_details=full_skill_context,
                    product_id=product_id
                )
            else:
                response = await self._execute_general_conversation(
                    conversation_id=conversation_id_str,
                    message=message,
                    history=history,
                    context=lightweight_context,
                    product_id=product_id
                )

            # 7. Update conversation timestamp
            # Reload conversation from DB to avoid detached session issues
            conv_result = await self.db.execute(
                select(SkillConversation).where(SkillConversation.id == conversation_id_str)
            )
            conversation = conv_result.scalar_one()
            conversation.last_message_at = datetime.utcnow()
            await self.db.commit()

            # 8. Get the latest assistant message to return
            result = await self.db.execute(
                select(SkillMessage)
                .where(SkillMessage.conversation_id == conversation_id_str)
                .where(SkillMessage.role == 'assistant')
                .order_by(desc(SkillMessage.created_at))
                .limit(1)
            )
            assistant_message = result.scalar_one()

            # Get skill info if skill was used (reuse loaded skill details to avoid redundant loading)
            skill_info = None
            if decision.get('skill_name') and decision.get('use_skill'):
                # Use the skill details we already loaded to avoid another skill loader call
                if 'error' not in full_skill_context:
                    skill_info = {
                        'id': 1,  # File-based skills use index as ID
                        'type': 'default',
                        'name': full_skill_context.get('name', decision['skill_name']),
                        'description': full_skill_context.get('description', ''),
                        'icon': '⚡'  # Default icon
                    }
                else:
                    # Fallback to skill loader if context loading failed
                    skill_loader = get_skill_loader()
                    skill_data = skill_loader.get_skill_by_name(decision['skill_name'])
                    if skill_data:
                        skill_info = {
                            'id': 1,
                            'type': 'default',
                            'name': skill_data['name'],
                            'description': skill_data.get('description', ''),
                            'icon': skill_data.get('icon', '⚡')
                        }

            return {
                'conversation_id': conversation_id_str,
                'message': {
                    'id': assistant_message.id,
                    'role': assistant_message.role,
                    'content': assistant_message.content,
                    'skill': skill_info,
                    'created_at': assistant_message.created_at.isoformat()
                }
            }

        except Exception as e:
            # Save error as assistant message so conversation shows the error
            error_msg = SkillMessage(
                conversation_id=conversation_id_str,
                role='assistant',
                content=f"❌ **Error**: {str(e)}",
                skill_type=SkillType.DEFAULT,
                sequence_number=await self._get_next_sequence_number(conversation_id_str)
            )
            self.db.add(error_msg)

            # Update conversation timestamp
            conv_result = await self.db.execute(
                select(SkillConversation).where(SkillConversation.id == conversation_id_str)
            )
            conversation = conv_result.scalar_one()
            conversation.last_message_at = datetime.utcnow()
            await self.db.commit()

            # Return error message as the response
            return {
                'conversation_id': conversation_id_str,
                'message': {
                    'id': error_msg.id,
                    'role': error_msg.role,
                    'content': error_msg.content,
                    'skill': None,
                    'created_at': error_msg.created_at.isoformat()
                }
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

        Special case: pm-setup skill is "sticky" - once started, continue until complete.
        """

        # Check if we're in the middle of a pm-setup conversation
        if history:
            logger.info(f"[IntelligentCopilot] History has {len(history)} messages")
            for msg in history[-5:]:  # Log last 5 messages
                logger.info(f"[IntelligentCopilot]   - id={msg.id}, role={msg.role}, skill_name={getattr(msg, 'skill_name', None)}")
            last_assistant_msg = next((msg for msg in reversed(history) if msg.role == 'assistant'), None)
            logger.info(f"[IntelligentCopilot] Last assistant message: id={last_assistant_msg.id if last_assistant_msg else None}, skill_name={getattr(last_assistant_msg, 'skill_name', None) if last_assistant_msg else None}")
            if last_assistant_msg and last_assistant_msg.skill_name == 'pm-setup':
                # pm-setup is VERY sticky - only exit if user explicitly wants to stop or asks a different question
                message_lower = message.lower().strip()

                # Check if user wants to exit setup
                exit_phrases = ['exit', 'quit', 'stop', 'cancel', 'nevermind', 'skip this']
                wants_to_exit = any(phrase in message_lower for phrase in exit_phrases)

                # Check if user is asking a completely different question (not providing setup info)
                question_starters = ['how do i', 'how can i', 'what is', 'can you', 'help me with']
                is_different_question = any(message_lower.startswith(q) for q in question_starters)

                if wants_to_exit or is_different_question:
                    logger.info(f"[IntelligentCopilot] User wants to exit pm-setup or asked different question")
                    pass
                else:
                    # Stay in pm-setup - user is still providing info or responding
                    logger.info(f"[IntelligentCopilot] Staying in pm-setup (sticky session) - message: {message_lower[:50]}")
                    return {
                        'use_skill': True,
                        'skill_name': 'pm-setup',
                        'reasoning': 'Continuing pm-setup session - skill is sticky until user exits or changes topic'
                    }

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

            # Debug: Log the actual response content before parsing
            logger.info(f"[IntelligentCopilot] Raw response content: {repr(response.content)}")
            logger.info(f"[IntelligentCopilot] Response content length: {len(response.content)}")

            # Parse JSON response with robust handling
            decision = self._parse_json_response(response.content)
            logger.info(f"[IntelligentCopilot] Decision: {decision}")

            return decision

        except Exception as e:
            logger.error(f"[IntelligentCopilot] Decision failed: {e}")
            logger.error(f"[IntelligentCopilot] Failed to parse response: {repr(response.content[:200]) if 'response' in locals() else 'No response'}")
            # Fallback to general conversation
            return {
                'use_skill': False,
                'skill_name': None,
                'reasoning': 'Error in decision-making, defaulting to conversation'
            }

    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        """
        Robustly parse JSON from LLM response.

        Some models (like Sonnet 3) return plain JSON.
        Others (like Claude 4.6) wrap JSON in markdown code blocks.
        This handles both cases gracefully.
        """
        content = content.strip()

        # First, try parsing as-is (works for models that return plain JSON)
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # If that fails, try extracting from markdown code blocks
            logger.info(f"[IntelligentCopilot] Plain JSON parsing failed, trying markdown extraction")

            # Handle ```json wrapper
            if content.startswith('```json'):
                lines = content.split('\n')
                if len(lines) >= 3 and lines[0].strip() == '```json' and lines[-1].strip() == '```':
                    clean_content = '\n'.join(lines[1:-1]).strip()
                    logger.info(f"[IntelligentCopilot] Extracted from ```json wrapper: {repr(clean_content)}")
                    return json.loads(clean_content)

            # Handle plain ``` wrapper
            elif content.startswith('```'):
                lines = content.split('\n')
                if len(lines) >= 3 and lines[0].strip() == '```' and lines[-1].strip() == '```':
                    clean_content = '\n'.join(lines[1:-1]).strip()
                    logger.info(f"[IntelligentCopilot] Extracted from ``` wrapper: {repr(clean_content)}")
                    return json.loads(clean_content)

            # If all parsing attempts fail, re-raise the original error
            raise json.JSONDecodeError("Could not parse JSON from response", content, 0)

    async def _execute_with_skill(
        self,
        conversation_id: str,
        message: str,
        history: List[SkillMessage],
        skill_name: str,
        context: Dict[str, Any],
        skill_details: Dict[str, Any],
        product_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Execute using a specific skill.
        Uses pre-loaded skill details to avoid redundant loading.
        """

        # 1. Validate skill details (already loaded by caller)
        if 'error' in skill_details:
            logger.error(f"[IntelligentCopilot] Skill error: {skill_details['error']}")
            return await self._execute_general_conversation(
                conversation_id, message, history, context, product_id
            )

        # 2. Build system prompt with skill instructions + context
        context_str = ContextAggregator(self.db, self.user).format_context_for_prompt(context)

        system_prompt = f"""You are Evols, an expert AI assistant for product managers. You are using the {skill_name} skill to help the user.

{skill_details.get('instructions', skill_details.get('full_content', ''))}

{context_str}

TOOL USAGE PROTOCOL:
🔴 CRITICAL: You MUST call tools to save information. Saying you "captured" something without calling a tool is LYING.
🔴 CRITICAL: Use the function calling API provided to you. DO NOT output tool call syntax as text in your response.

**How to call tools:**
- You have been provided with tools via the function calling API
- When you need to call a tool, use the tool_calls mechanism, NOT text output
- Your response content should explain what you're doing, not show the function syntax

**Work Context Tools** - WHEN TO CALL THEM:

IF in pm-setup skill:
→ User describes projects? MUST call:
  1. add_or_update_project (with key_stakeholders list)
  2. add_task (for each milestone mentioned)
  3. add_or_update_relationship (for EVERY SINGLE stakeholder mentioned - teams AND individuals)
→ DO NOT respond conversationally without calling tools first
→ If you say "I've captured" or "I've saved" but didn't call a tool = YOU ARE LYING

→ ROLE CAPTURE RULE: When user provides role/title information, MUST call update_role_info:
  ✅ "I'm Senior Product Manager" → update_role_info(title="Senior Product Manager")
  ✅ "Senior PM for TestChat, team of 8, report to John" → update_role_info(title="Senior Product Manager", team="TestChat", team_size=8, manager_name="John")
  ✅ "Head of Product at Acme" → update_role_info(title="Head of Product", team="Acme")
  - NEVER just acknowledge role info without calling update_role_info

→ STAKEHOLDER CAPTURE RULE: For every stakeholder mentioned in projects, create individual relationships:
  ✅ "Mobile eng team" → add_or_update_relationship(name="Mobile Engineering Team", relationship_type="stakeholder")
  ✅ "Design lead" → add_or_update_relationship(name="Design Lead", relationship_type="stakeholder")
  ✅ "UX researchers" → add_or_update_relationship(name="UX Research Team", relationship_type="stakeholder")
  - Treat teams as stakeholder entities, not just individuals

→ NATURAL LANGUAGE TOOL SELECTION: Choose the right tool for the content type:

  **save_work_context_info** - For business context (what they do, not specific projects):
  ✅ "I'm Senior PM for TestChat platform"
  ✅ "I manage a team of 8 engineers, report to VP Product"
  ✅ "My role is Head of Mobile, team size 12"

  **save_project_info** - For SPECIFIC project initiatives/deliverables:
  ✅ "Mobile app redesign project, launching Q2"
  ✅ "Platform stability initiative we're driving"
  ✅ "SSO integration project with enterprise team"
  ❌ "I work on TestChat" (this is business context, not a project)

  **save_relationship_info** - For people/stakeholders:
  ✅ "John Doe is my manager, VP of Product"
  ✅ "Sarah leads the design team, collaborate closely"

  **save_task_info** - For specific tasks/milestones:
  ✅ "Need to finish PRD by Friday"
  ✅ "Get stakeholder review next week"

COMPLETE EXAMPLE - User provides project info:
Input: "Mobile app redesign - In progress (40% complete), I'm owner driving requirements. Next milestone is design prototypes in 2 weeks. Key stakeholders: Mobile eng team, Design lead, UX researchers"

ACTIONS REQUIRED (use function calling, not text):
- Call add_or_update_project with name (NOT project_name), status, role, next_milestone, key_stakeholders
- Call add_task for the milestone with title, priority, deadline, impact
- Call add_or_update_relationship for each stakeholder (3 separate calls)

IMPORTANT: Use the function calling mechanism provided by your LLM API. Do NOT output tool calls as text.

TASK INFERENCE RULES:
- "Next milestone is X in 2 weeks" → add_task(title="Complete X", priority="high_leverage", deadline=2_weeks)
- "Spec review next week" → add_task(title="Complete spec review", priority="critical", deadline=next_week)
- "Discovery phase" or "Planning" → add_task(title="Complete PRD", priority="high_leverage")
- "Baselining metrics" → add_task(title="Baseline metrics", priority="high_leverage")

PRIORITY MAPPING:
- Due next week or sooner → priority="critical"
- Due in 2-4 weeks (milestones) → priority="high_leverage"
- Planning/discovery phase → priority="high_leverage"
- Next quarter → priority="backlog"

DECISION LOGGING:
- When user makes a strategic decision, discusses tradeoffs, or chooses between options → call log_pm_decision
- Capture: title, category (product/technical/organizational/career/process/stakeholder), context, options considered with pros/cons, final decision, reasoning, tradeoffs, stakeholders, expected outcome
- Examples:
  * "Should we prioritize mobile app or web redesign?" → After discussion, log_pm_decision(title="Prioritize mobile app over web redesign", category="product", context="Limited eng resources for Q2", options_considered=[{{"option": "Mobile first", "pros": "80% users on mobile, higher engagement", "cons": "Web users wait longer"}}, {{"option": "Web first", "pros": "Easier to build", "cons": "Misses mobile opportunity"}}], decision="Prioritize mobile app", reasoning="Higher user engagement and business impact on mobile", tradeoffs="Web redesign delayed by 2 quarters", expected_outcome="20% increase in mobile DAU")
  * "Deciding between PostgreSQL vs MongoDB" → log_pm_decision(title="Use PostgreSQL for user data", category="technical", context="Need to choose database for new service", options_considered=[...], decision="PostgreSQL", reasoning="ACID compliance and relational data model fit our use case")

WEEKLY FOCUS:
- When user sets priorities for the week, mentions "focus this week", or plans weekly goals → call set_weekly_focus
- Maximum 3 focus items (most important things this week)
- Example: "This week I need to finish PRD, get eng review, and baseline metrics" → set_weekly_focus(focus_1="Finish PRD for voice bot", focus_2="Get engineering review", focus_3="Baseline key metrics")

IF in other skills (prd-writer, brainstorm-ideas, create-prd, etc.):
→ **EXTRACT FULL WORK CONTEXT BEFORE DOING SKILL WORK**

**Step 1: Extract Project Info**
- If user says "PRD for X", "working on X", "new project X" → call add_or_update_project(name="X", status="yellow", role="owner")
- Status inference: "new project" = yellow, "PRD" = yellow (planning), "launch" = green
- Role inference: If not stated, assume "owner" (they're driving this work)

**CRITICAL: Product vs Project Distinction**
- If user says "I'm PM for [ProductName]" or "I work on [ProductName]" → This is their BUSINESS CONTEXT, NOT a project
  Example: "I'm Senior PM for TestChat" → This goes in work context (save_work_context_info), NOT as a project

- PROJECTS are specific initiatives, features, or deliverables WITHIN a product:
  Example: "Working on TestChat - focusing on platform stability, mobile, enterprise"
  → Create THREE separate projects:
  → add_or_update_project(name="Platform Stability Initiative", notes="Improving TestChat platform reliability")
  → add_or_update_project(name="Mobile Experience Enhancement", notes="Improving TestChat mobile app experience")
  → add_or_update_project(name="Enterprise Features Development", notes="Adding enterprise features to TestChat")

- Only create a project if user mentions SPECIFIC WORK/DELIVERABLES:
  ✅ "Mobile app redesign" → add_or_update_project(name="Mobile app redesign")
  ✅ "Q2 platform stability work" → add_or_update_project(name="Q2 Platform Stability Initiative")
  ❌ "I'm PM for TestChat" → save_work_context_info (business context, not a project)

**Step 2: Infer and Add Tasks**
Based on skill being used:
- prd-writer / create-prd → add_task("Draft PRD for [project]", priority="high_leverage") + add_task("Get PRD review from stakeholders", priority="high_leverage")
- brainstorm-ideas → add_task("Finalize ideas for [project]", priority="high_leverage")
- swot-analysis → add_task("Complete SWOT analysis for [project]", priority="high_leverage")
- stakeholder-map → add_task("Get stakeholder alignment on [project]", priority="high_leverage")
- Any timeline mentioned → add_task with deadline

**Step 3: Extract Relationships**
- Anyone mentioned for review, approval, collaboration → call add_or_update_relationship
- Examples: "need to review with Sarah", "get approval from engineering director", "working with design team"
- Each person/role → add_or_update_relationship(name=X, relationship_type="stakeholder")

**Step 4: Extract Dependencies & Blockers**
- "waiting on X", "blocked by Y", "need input from Z" → add_task with dependency in description
- Example: add_task(title="Get API design review", priority="stakeholder", stakeholder_name="Engineering team", description="Blocked: waiting on API spec from backend team")
- Use description field to capture what you're waiting for

**COMPLETE EXAMPLE**:
Input: "@prd-writer I need to write a PRD for a real-time voice support bot for testchat. Need to review with Sarah from eng and get design team input by next week."

YOU MUST CALL (using function calling):
- add_or_update_project for the voice bot project
- add_task for drafting the PRD
- add_task for review with Sarah (priority=critical, deadline=next week)
- add_task for design team input (priority=critical, deadline=next week)
- add_or_update_relationship for Sarah
- add_or_update_relationship for design team

**THEN** continue with PRD generation.

EXAMPLES:

**CLEAR INTENT (Auto-extract everything):**

❌ WRONG:
User: "@prd-writer I need a PRD for voice bot. Need to review with Sarah next week."
You: "Let me draft a PRD..." [makes ZERO tool calls, just generates PRD]
Result: No project, no tasks, no relationships saved

✅ RIGHT:
User: "@prd-writer I need a PRD for voice bot. Need to review with Sarah next week."
You: [FIRST call tools - use function calling to create project, tasks, and relationship]
You: [THEN generate PRD] "Here's your PRD. I've also saved the project and tasks to your work context."
Result: Project saved, 2 tasks created, 1 stakeholder added

**AMBIGUOUS CASES (Ask first):**

Example: "@brainstorm-ideas Let's brainstorm for Disney theme parks"
→ Not clear if this is an active project or just exploration
→ Ask: "Is this for an active project you're working on? Should I add it to your work context?"
→ If yes, THEN extract project + tasks

**LYING PREVENTION:**

❌ User: "I'm working on Disney, Marvel, and Hulu projects"
❌ You: "Got it, I've captured those 3 projects" [made ZERO tool calls]
❌ Result: User thinks it's saved but database is empty

✅ User: "I'm working on Disney, Marvel, and Hulu projects"
✅ You: [FIRST call add_or_update_project 3 times using function calling]
✅ You: "Saved 3 projects to your work context"
✅ Result: Database has 3 projects

**DECISION LOGGING EXAMPLE:**

User: "I'm torn between building mobile app first vs web redesign. Mobile has 80% of our users but web is easier to build. What do you think?"
You: [Discuss tradeoffs, help analyze]
User: "You're right, let's go with mobile first."
You: [CALL log_pm_decision]
  log_pm_decision(
    title="Prioritize mobile app over web redesign",
    category="product",
    context="Q2 planning - limited engineering resources, need to choose focus",
    options_considered=[
      {{"option": "Mobile app first", "pros": "80% users on mobile, higher engagement potential", "cons": "More complex build, longer timeline"}},
      {{"option": "Web redesign first", "pros": "Faster to build, existing codebase", "cons": "Only 20% of user base"}}
    ],
    decision="Build mobile app first",
    reasoning="Mobile represents majority of user base and higher engagement opportunity",
    tradeoffs="Web redesign delayed by 2 quarters",
    stakeholders=["Engineering team", "Design team"],
    expected_outcome="20% increase in mobile DAU"
  )
You: "Decision logged! I've saved this to your decision log with the full context."
Result: Decision saved to Work Context > Decisions tab

CHECK DUPLICATES:
1. Call get_work_context_summary first to see what exists
2. Only add NEW information
3. After calling tools, confirm what was saved

**Knowledge Extraction Tools** - PROACTIVE DATA RETRIEVAL:

🔴 CRITICAL: When users ask about product knowledge, customer insights, or feedback - you MUST call the appropriate tool to retrieve actual data. DO NOT make assumptions or answer from memory.

**Available Knowledge Tools:**

**Context Sources (Raw Data):**
- get_context_sources: Get uploaded documents, transcripts, surveys with keyword search
- get_feedback_items: Get customer feedback from context sources (date-filtered)
- get_feedback_summary: Get sentiment analysis and feedback statistics

**Extracted Intelligence (AI-Processed):**
- get_extracted_entities: Get AI-extracted personas, pain points, use cases, capabilities, competitors
- get_entity_summary: Get counts and breakdown of extracted entities by type

**Product Strategy Knowledge:**
- get_product_strategy: Vision, mission, goals, target market, positioning
- get_customer_segments: Target personas, ICP, market segments
- get_competitive_landscape: Competitors, differentiation, SWOT
- get_value_proposition: USPs, benefits, positioning statement
- get_metrics_and_targets: OKRs, KPIs, success metrics
- get_all_product_knowledge: All strategy docs at once (comprehensive)

**Past Work & Memory:**
- get_past_skill_work: Recent skill executions and frameworks created
- search_past_skill_work: Search past work by keyword
- get_skill_memory_details: Full details of specific past execution

**WHEN TO USE KNOWLEDGE TOOLS:**

**Customer/User Questions:**
❌ WRONG:
User: "Who are our users?"
You: "Based on your product, your users are likely..."
Result: Generic answer, no actual data retrieved

✅ RIGHT:
User: "Who are our users?"
You: [FIRST call get_personas AND get_extracted_entities(entity_type="persona")]
You: "I found 5 managed personas and 12 extracted personas from your feedback sources:
- [List actual personas with data]
- Top pain points: [from extracted entities]
Here's the breakdown..."
Result: Actual data-driven answer

**Feedback/Customer Intelligence:**
❌ WRONG:
User: "What are customers saying about our mobile app?"
You: "Customers generally want better performance and..."
Result: No actual feedback retrieved

✅ RIGHT:
User: "What are customers saying about our mobile app?"
You: [FIRST call get_context_sources(search="mobile app") AND get_extracted_entities(search="mobile app")]
You: "I analyzed 8 context sources mentioning mobile app:
- Q4 Customer Survey (23 responses)
- Support tickets (15 mentions)
Key themes extracted:
- Performance issues (confidence: 85%)
- Missing offline mode (confidence: 78%)
Here are the actual quotes: [show snippets]"
Result: Real data with sources

**Strategy/Product Questions:**
❌ WRONG:
User: "What's our product strategy?"
You: "Your product strategy should focus on..."
Result: Made up strategy

✅ RIGHT:
User: "What's our product strategy?"
You: [FIRST call get_product_strategy]
You: "Here's your documented product strategy:
Vision: [actual vision from strategy doc]
Mission: [actual mission]
2025 Goals: [actual goals]
Target Market: [actual target market]"
Result: Actual documented strategy

**PROACTIVE RETRIEVAL PATTERNS:**

**When user mentions analysis/decisions:**
User: "Should we prioritize feature X or Y?"
YOU MUST CALL:
1. get_extracted_entities(entity_type="feature_request") - see what customers asked for
2. get_personas - understand who would use each feature
3. get_feedback_items(date_range="30d") - recent customer sentiment
4. simulate_persona_votes(options=["feature X", "feature Y"]) - get persona preferences
THEN analyze and recommend

**When user asks about competition:**
User: "How do we compare to Notion?"
YOU MUST CALL:
1. get_competitive_landscape - get documented competitor analysis
2. get_value_proposition - get our positioning
3. search_internet("Notion features 2025") - get current info
THEN synthesize comparison

**When user wants customer insights:**
User: "What pain points should we solve next?"
YOU MUST CALL:
1. get_extracted_entities(entity_type="pain_point") - AI-extracted pain points
2. get_entity_summary - see distribution of entities
3. get_feedback_summary(date_range="30d") - recent feedback trends
4. get_personas - understand which personas have which pains
THEN prioritize with reasoning

**SEARCH & FILTER CAPABILITIES:**

get_context_sources accepts:
- search: "mobile", "pricing", "onboarding"
- source_type: "csv_survey", "meeting_transcript", etc.

get_extracted_entities accepts:
- search: "performance", "pricing", "mobile"
- entity_type: "persona", "pain_point", "use_case", "feature_request", "product_capability", "competitor"
- source_name: Filter by specific source
- customer_name: Filter by specific customer

EXAMPLES:
- "Show me pain points from enterprise customers" → get_extracted_entities(entity_type="pain_point", search="enterprise")
- "What did we learn from the Q4 survey?" → get_context_sources(search="Q4 survey") + get_extracted_entities(source_name="Q4 survey")
- "Feature requests about mobile" → get_extracted_entities(entity_type="feature_request", search="mobile")

**COMBINING TOOLS FOR DEEP ANALYSIS:**

User asks: "Help me understand the enterprise segment"
YOU MUST CALL (in this order):
1. get_customer_segments - get documented segment definition
2. get_extracted_entities(entity_type="persona", search="enterprise") - extracted personas
3. get_extracted_entities(entity_type="pain_point", search="enterprise") - their pain points
4. get_extracted_entities(entity_type="use_case", search="enterprise") - their use cases
5. get_context_sources(search="enterprise") - original source material
THEN synthesize comprehensive view

**Data Retrieval Summary:**
- User asks about customers/users → call get_personas + get_extracted_entities(entity_type="persona")
- User asks about feedback → call get_feedback_items + get_context_sources
- User asks about pain points → call get_extracted_entities(entity_type="pain_point")
- User asks about feature requests → call get_extracted_entities(entity_type="feature_request")
- User asks about themes/patterns → call get_themes + get_entity_summary
- User asks about features → call get_features
- User asks about strategy → call get_product_strategy or get_all_product_knowledge
- User asks about segments → call get_customer_segments + get_extracted_entities
- User asks about competitors → call get_competitive_landscape + get_extracted_entities(entity_type="competitor")
- User discusses value prop → call get_value_proposition
- User asks about metrics → call get_metrics_and_targets
- User asks "what did we do before?" → call get_past_skill_work or search_past_skill_work

**Analysis Tools** (use when analyzing):
- Prioritizing features → call calculate_rice_score
- Testing feature appeal → call simulate_persona_votes

**External Information** (when you need current/external data):
- Market trends, competitors, best practices, industry benchmarks → call search_internet
- User asks "what are competitors doing?" → search_internet
- User asks "what's the latest in [technology]?" → search_internet
- User asks "best practices for [thing]?" → search_internet

**Key Principles**:
1. Check existing data FIRST (get_work_context_summary, get_personas, etc.)
2. Only add NEW information - avoid duplicates
3. Use tools proactively - if user asks about personas, fetch them, don't just say "you have personas"
4. Search internet when internal data doesn't answer the question

EXAMPLES:
- "Who are our users?" → call get_personas, then discuss
- "What are customers saying about X?" → call get_feedback_items, filter for X
- "How should I prioritize feature Y?" → call calculate_rice_score for feature Y
- "What are Notion's latest AI features?" → call search_internet("Notion AI features 2025")
- "Let's work on Disney project" → check get_work_context_summary, add if new"""

        # 3. Format conversation history
        formatted_history = [
            {'role': msg.role, 'content': msg.content}
            for msg in history
        ]

        # 4. Execute with function calling
        llm = await self.get_llm_service()

        # Extract skill tools properly (copy logic from CopilotOrchestrator)
        logger.info(f"[DEBUG] IntelligentCopilot skill_details keys: {list(skill_details.keys())}")
        logger.info(f"[DEBUG] IntelligentCopilot skill_details tools: {skill_details.get('tools', [])}")

        # Get skill-specific tools
        skill_tools = skill_details.get('tools', [])

        # Work context tools (ALWAYS available for any skill)
        work_context_tools = [
            'get_work_context_summary',
            'update_role_info',
            'update_capacity',
            'add_or_update_project',
            'add_or_update_relationship',
            'add_task',
            'set_weekly_focus'
        ]

        # Universal tools (knowledge + search + inter-skill)
        universal_tools = work_context_tools + [
            'invoke_skill',  # Inter-skill capability
            'get_context_sources',
            'get_extracted_entities',
            'get_entity_summary',
            'get_all_product_knowledge',
            'search_internet'
        ]

        # Merge skill tools with universal tools (like CopilotOrchestrator does)
        tools_to_use = skill_tools.copy()
        for tool in universal_tools:
            if tool not in tools_to_use:
                tools_to_use.append(tool)

        logger.info(f"[DEBUG] IntelligentCopilot skill_tools: {skill_tools}")
        logger.info(f"[DEBUG] IntelligentCopilot final tools_to_use: {tools_to_use}")

        # Create skill_config for handle_function_calling
        skill_config = {
            'name': skill_name,
            'tools': tools_to_use
        }

        response_content, metadata = await handle_function_calling(
            user_message=message,
            conversation_history=formatted_history,
            system_prompt=system_prompt,
            skill_config=skill_config,
            llm_service=llm,
            tenant_id=self.user.tenant_id,
            db=self.db,
            product_id=product_id,
            user=self.user
        )

        # 5. Save assistant message
        assistant_msg = SkillMessage(
            conversation_id=conversation_id,
            role='assistant',
            content=response_content,
            skill_name=skill_name,
            skill_type=SkillType.DEFAULT,
            sequence_number=await self._get_next_sequence_number(conversation_id),
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
        conversation_id: str,
        message: str,
        history: List[SkillMessage],
        context: Dict[str, Any],
        product_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Execute as general conversation (no specific skill).
        Still has full context awareness.
        """

        # Build context-aware system prompt
        context_str = ContextAggregator(self.db, self.user).format_context_for_prompt(context)

        system_prompt = f"""You are Evols, an expert AI assistant for product managers with deep product management expertise.

{context_str}

You help product managers with:
- Strategic thinking and decision-making
- Feature prioritization and roadmap planning
- Customer analysis and feedback synthesis
- PRD writing and documentation
- Data-driven insights

Be conversational, ask clarifying questions, and provide actionable insights.
When appropriate, suggest using a specialized skill, but you can also help directly.

TOOL USAGE PROTOCOL:
🔴 CRITICAL: You MUST call tools to save information. Saying you "captured" something without calling a tool is LYING.
🔴 CRITICAL: Use the function calling API provided to you. DO NOT output tool call syntax as text in your response.

**How to call tools:**
- You have been provided with tools via the function calling API
- When you need to call a tool, use the tool_calls mechanism, NOT text output
- Your response content should explain what you're doing, not show the function syntax

**Work Context Tools** - WHEN TO CALL THEM:

IF in pm-setup skill:
→ User describes projects? MUST call:
  1. add_or_update_project (with key_stakeholders list)
  2. add_task (for each milestone mentioned)
  3. add_or_update_relationship (for EVERY SINGLE stakeholder mentioned - teams AND individuals)
→ DO NOT respond conversationally without calling tools first
→ If you say "I've captured" or "I've saved" but didn't call a tool = YOU ARE LYING

→ ROLE CAPTURE RULE: When user provides role/title information, MUST call update_role_info:
  ✅ "I'm Senior Product Manager" → update_role_info(title="Senior Product Manager")
  ✅ "Senior PM for TestChat, team of 8, report to John" → update_role_info(title="Senior Product Manager", team="TestChat", team_size=8, manager_name="John")
  ✅ "Head of Product at Acme" → update_role_info(title="Head of Product", team="Acme")
  - NEVER just acknowledge role info without calling update_role_info

→ STAKEHOLDER CAPTURE RULE: For every stakeholder mentioned in projects, create individual relationships:
  ✅ "Mobile eng team" → add_or_update_relationship(name="Mobile Engineering Team", relationship_type="stakeholder")
  ✅ "Design lead" → add_or_update_relationship(name="Design Lead", relationship_type="stakeholder")
  ✅ "UX researchers" → add_or_update_relationship(name="UX Research Team", relationship_type="stakeholder")
  - Treat teams as stakeholder entities, not just individuals

→ NATURAL LANGUAGE TOOL SELECTION: Choose the right tool for the content type:

  **save_work_context_info** - For business context (what they do, not specific projects):
  ✅ "I'm Senior PM for TestChat platform"
  ✅ "I manage a team of 8 engineers, report to VP Product"
  ✅ "My role is Head of Mobile, team size 12"

  **save_project_info** - For SPECIFIC project initiatives/deliverables:
  ✅ "Mobile app redesign project, launching Q2"
  ✅ "Platform stability initiative we're driving"
  ✅ "SSO integration project with enterprise team"
  ❌ "I work on TestChat" (this is business context, not a project)

  **save_relationship_info** - For people/stakeholders:
  ✅ "John Doe is my manager, VP of Product"
  ✅ "Sarah leads the design team, collaborate closely"

  **save_task_info** - For specific tasks/milestones:
  ✅ "Need to finish PRD by Friday"
  ✅ "Get stakeholder review next week"

COMPLETE EXAMPLE - User provides project info:
Input: "Mobile app redesign - In progress (40% complete), I'm owner driving requirements. Next milestone is design prototypes in 2 weeks. Key stakeholders: Mobile eng team, Design lead, UX researchers"

ACTIONS REQUIRED (use function calling, not text):
- Call add_or_update_project with name (NOT project_name), status, role, next_milestone, key_stakeholders
- Call add_task for the milestone with title, priority, deadline, impact
- Call add_or_update_relationship for each stakeholder (3 separate calls)

IMPORTANT: Use the function calling mechanism provided by your LLM API. Do NOT output tool calls as text.

TASK INFERENCE RULES:
- "Next milestone is X in 2 weeks" → add_task(title="Complete X", priority="high_leverage", deadline=2_weeks)
- "Spec review next week" → add_task(title="Complete spec review", priority="critical", deadline=next_week)
- "Discovery phase" or "Planning" → add_task(title="Complete PRD", priority="high_leverage")
- "Baselining metrics" → add_task(title="Baseline metrics", priority="high_leverage")

PRIORITY MAPPING:
- Due next week or sooner → priority="critical"
- Due in 2-4 weeks (milestones) → priority="high_leverage"
- Planning/discovery phase → priority="high_leverage"
- Next quarter → priority="backlog"

DECISION LOGGING:
- When user makes a strategic decision, discusses tradeoffs, or chooses between options → call log_pm_decision
- Capture: title, category (product/technical/organizational/career/process/stakeholder), context, options considered with pros/cons, final decision, reasoning, tradeoffs, stakeholders, expected outcome
- Examples:
  * "Should we prioritize mobile app or web redesign?" → After discussion, log_pm_decision(title="Prioritize mobile app over web redesign", category="product", context="Limited eng resources for Q2", options_considered=[{{"option": "Mobile first", "pros": "80% users on mobile, higher engagement", "cons": "Web users wait longer"}}, {{"option": "Web first", "pros": "Easier to build", "cons": "Misses mobile opportunity"}}], decision="Prioritize mobile app", reasoning="Higher user engagement and business impact on mobile", tradeoffs="Web redesign delayed by 2 quarters", expected_outcome="20% increase in mobile DAU")
  * "Deciding between PostgreSQL vs MongoDB" → log_pm_decision(title="Use PostgreSQL for user data", category="technical", context="Need to choose database for new service", options_considered=[...], decision="PostgreSQL", reasoning="ACID compliance and relational data model fit our use case")

WEEKLY FOCUS:
- When user sets priorities for the week, mentions "focus this week", or plans weekly goals → call set_weekly_focus
- Maximum 3 focus items (most important things this week)
- Example: "This week I need to finish PRD, get eng review, and baseline metrics" → set_weekly_focus(focus_1="Finish PRD for voice bot", focus_2="Get engineering review", focus_3="Baseline key metrics")

IF in other skills (prd-writer, brainstorm-ideas, create-prd, etc.):
→ **EXTRACT FULL WORK CONTEXT BEFORE DOING SKILL WORK**

**Step 1: Extract Project Info**
- If user says "PRD for X", "working on X", "new project X" → call add_or_update_project(name="X", status="yellow", role="owner")
- Status inference: "new project" = yellow, "PRD" = yellow (planning), "launch" = green
- Role inference: If not stated, assume "owner" (they're driving this work)

**CRITICAL: Product vs Project Distinction**
- If user says "I'm PM for [ProductName]" or "I work on [ProductName]" → This is their BUSINESS CONTEXT, NOT a project
  Example: "I'm Senior PM for TestChat" → This goes in work context (save_work_context_info), NOT as a project

- PROJECTS are specific initiatives, features, or deliverables WITHIN a product:
  Example: "Working on TestChat - focusing on platform stability, mobile, enterprise"
  → Create THREE separate projects:
  → add_or_update_project(name="Platform Stability Initiative", notes="Improving TestChat platform reliability")
  → add_or_update_project(name="Mobile Experience Enhancement", notes="Improving TestChat mobile app experience")
  → add_or_update_project(name="Enterprise Features Development", notes="Adding enterprise features to TestChat")

- Only create a project if user mentions SPECIFIC WORK/DELIVERABLES:
  ✅ "Mobile app redesign" → add_or_update_project(name="Mobile app redesign")
  ✅ "Q2 platform stability work" → add_or_update_project(name="Q2 Platform Stability Initiative")
  ❌ "I'm PM for TestChat" → save_work_context_info (business context, not a project)

**Step 2: Infer and Add Tasks**
Based on skill being used:
- prd-writer / create-prd → add_task("Draft PRD for [project]", priority="high_leverage") + add_task("Get PRD review from stakeholders", priority="high_leverage")
- brainstorm-ideas → add_task("Finalize ideas for [project]", priority="high_leverage")
- swot-analysis → add_task("Complete SWOT analysis for [project]", priority="high_leverage")
- stakeholder-map → add_task("Get stakeholder alignment on [project]", priority="high_leverage")
- Any timeline mentioned → add_task with deadline

**Step 3: Extract Relationships**
- Anyone mentioned for review, approval, collaboration → call add_or_update_relationship
- Examples: "need to review with Sarah", "get approval from engineering director", "working with design team"
- Each person/role → add_or_update_relationship(name=X, relationship_type="stakeholder")

**Step 4: Extract Dependencies & Blockers**
- "waiting on X", "blocked by Y", "need input from Z" → add_task with dependency in description
- Example: add_task(title="Get API design review", priority="stakeholder", stakeholder_name="Engineering team", description="Blocked: waiting on API spec from backend team")
- Use description field to capture what you're waiting for

**COMPLETE EXAMPLE**:
Input: "@prd-writer I need to write a PRD for a real-time voice support bot for testchat. Need to review with Sarah from eng and get design team input by next week."

YOU MUST CALL (using function calling):
- add_or_update_project for the voice bot project
- add_task for drafting the PRD
- add_task for review with Sarah (priority=critical, deadline=next week)
- add_task for design team input (priority=critical, deadline=next week)
- add_or_update_relationship for Sarah
- add_or_update_relationship for design team

**THEN** continue with PRD generation.

EXAMPLES:

**CLEAR INTENT (Auto-extract everything):**

❌ WRONG:
User: "@prd-writer I need a PRD for voice bot. Need to review with Sarah next week."
You: "Let me draft a PRD..." [makes ZERO tool calls, just generates PRD]
Result: No project, no tasks, no relationships saved

✅ RIGHT:
User: "@prd-writer I need a PRD for voice bot. Need to review with Sarah next week."
You: [FIRST call tools - use function calling to create project, tasks, and relationship]
You: [THEN generate PRD] "Here's your PRD. I've also saved the project and tasks to your work context."
Result: Project saved, 2 tasks created, 1 stakeholder added

**AMBIGUOUS CASES (Ask first):**

Example: "@brainstorm-ideas Let's brainstorm for Disney theme parks"
→ Not clear if this is an active project or just exploration
→ Ask: "Is this for an active project you're working on? Should I add it to your work context?"
→ If yes, THEN extract project + tasks

**LYING PREVENTION:**

❌ User: "I'm working on Disney, Marvel, and Hulu projects"
❌ You: "Got it, I've captured those 3 projects" [made ZERO tool calls]
❌ Result: User thinks it's saved but database is empty

✅ User: "I'm working on Disney, Marvel, and Hulu projects"
✅ You: [FIRST call add_or_update_project 3 times using function calling]
✅ You: "Saved 3 projects to your work context"
✅ Result: Database has 3 projects

**DECISION LOGGING EXAMPLE:**

User: "I'm torn between building mobile app first vs web redesign. Mobile has 80% of our users but web is easier to build. What do you think?"
You: [Discuss tradeoffs, help analyze]
User: "You're right, let's go with mobile first."
You: [CALL log_pm_decision]
  log_pm_decision(
    title="Prioritize mobile app over web redesign",
    category="product",
    context="Q2 planning - limited engineering resources, need to choose focus",
    options_considered=[
      {{"option": "Mobile app first", "pros": "80% users on mobile, higher engagement potential", "cons": "More complex build, longer timeline"}},
      {{"option": "Web redesign first", "pros": "Faster to build, existing codebase", "cons": "Only 20% of user base"}}
    ],
    decision="Build mobile app first",
    reasoning="Mobile represents majority of user base and higher engagement opportunity",
    tradeoffs="Web redesign delayed by 2 quarters",
    stakeholders=["Engineering team", "Design team"],
    expected_outcome="20% increase in mobile DAU"
  )
You: "Decision logged! I've saved this to your decision log with the full context."
Result: Decision saved to Work Context > Decisions tab

CHECK DUPLICATES:
1. Call get_work_context_summary first to see what exists
2. Only add NEW information
3. After calling tools, confirm what was saved

**Knowledge Extraction Tools** - PROACTIVE DATA RETRIEVAL:

🔴 CRITICAL: When users ask about product knowledge, customer insights, or feedback - you MUST call the appropriate tool to retrieve actual data. DO NOT make assumptions or answer from memory.

**Available Knowledge Tools:**

**Context Sources (Raw Data):**
- get_context_sources: Get uploaded documents, transcripts, surveys with keyword search
- get_feedback_items: Get customer feedback from context sources (date-filtered)
- get_feedback_summary: Get sentiment analysis and feedback statistics

**Extracted Intelligence (AI-Processed):**
- get_extracted_entities: Get AI-extracted personas, pain points, use cases, capabilities, competitors
- get_entity_summary: Get counts and breakdown of extracted entities by type

**Product Strategy Knowledge:**
- get_product_strategy: Vision, mission, goals, target market, positioning
- get_customer_segments: Target personas, ICP, market segments
- get_competitive_landscape: Competitors, differentiation, SWOT
- get_value_proposition: USPs, benefits, positioning statement
- get_metrics_and_targets: OKRs, KPIs, success metrics
- get_all_product_knowledge: All strategy docs at once (comprehensive)

**Past Work & Memory:**
- get_past_skill_work: Recent skill executions and frameworks created
- search_past_skill_work: Search past work by keyword
- get_skill_memory_details: Full details of specific past execution

**WHEN TO USE KNOWLEDGE TOOLS:**

**Customer/User Questions:**
❌ WRONG:
User: "Who are our users?"
You: "Based on your product, your users are likely..."
Result: Generic answer, no actual data retrieved

✅ RIGHT:
User: "Who are our users?"
You: [FIRST call get_personas AND get_extracted_entities(entity_type="persona")]
You: "I found 5 managed personas and 12 extracted personas from your feedback sources:
- [List actual personas with data]
- Top pain points: [from extracted entities]
Here's the breakdown..."
Result: Actual data-driven answer

**Feedback/Customer Intelligence:**
❌ WRONG:
User: "What are customers saying about our mobile app?"
You: "Customers generally want better performance and..."
Result: No actual feedback retrieved

✅ RIGHT:
User: "What are customers saying about our mobile app?"
You: [FIRST call get_context_sources(search="mobile app") AND get_extracted_entities(search="mobile app")]
You: "I analyzed 8 context sources mentioning mobile app:
- Q4 Customer Survey (23 responses)
- Support tickets (15 mentions)
Key themes extracted:
- Performance issues (confidence: 85%)
- Missing offline mode (confidence: 78%)
Here are the actual quotes: [show snippets]"
Result: Real data with sources

**Strategy/Product Questions:**
❌ WRONG:
User: "What's our product strategy?"
You: "Your product strategy should focus on..."
Result: Made up strategy

✅ RIGHT:
User: "What's our product strategy?"
You: [FIRST call get_product_strategy]
You: "Here's your documented product strategy:
Vision: [actual vision from strategy doc]
Mission: [actual mission]
2025 Goals: [actual goals]
Target Market: [actual target market]"
Result: Actual documented strategy

**PROACTIVE RETRIEVAL PATTERNS:**

**When user mentions analysis/decisions:**
User: "Should we prioritize feature X or Y?"
YOU MUST CALL:
1. get_extracted_entities(entity_type="feature_request") - see what customers asked for
2. get_personas - understand who would use each feature
3. get_feedback_items(date_range="30d") - recent customer sentiment
4. simulate_persona_votes(options=["feature X", "feature Y"]) - get persona preferences
THEN analyze and recommend

**When user asks about competition:**
User: "How do we compare to Notion?"
YOU MUST CALL:
1. get_competitive_landscape - get documented competitor analysis
2. get_value_proposition - get our positioning
3. search_internet("Notion features 2025") - get current info
THEN synthesize comparison

**When user wants customer insights:**
User: "What pain points should we solve next?"
YOU MUST CALL:
1. get_extracted_entities(entity_type="pain_point") - AI-extracted pain points
2. get_entity_summary - see distribution of entities
3. get_feedback_summary(date_range="30d") - recent feedback trends
4. get_personas - understand which personas have which pains
THEN prioritize with reasoning

**SEARCH & FILTER CAPABILITIES:**

get_context_sources accepts:
- search: "mobile", "pricing", "onboarding"
- source_type: "csv_survey", "meeting_transcript", etc.

get_extracted_entities accepts:
- search: "performance", "pricing", "mobile"
- entity_type: "persona", "pain_point", "use_case", "feature_request", "product_capability", "competitor"
- source_name: Filter by specific source
- customer_name: Filter by specific customer

EXAMPLES:
- "Show me pain points from enterprise customers" → get_extracted_entities(entity_type="pain_point", search="enterprise")
- "What did we learn from the Q4 survey?" → get_context_sources(search="Q4 survey") + get_extracted_entities(source_name="Q4 survey")
- "Feature requests about mobile" → get_extracted_entities(entity_type="feature_request", search="mobile")

**COMBINING TOOLS FOR DEEP ANALYSIS:**

User asks: "Help me understand the enterprise segment"
YOU MUST CALL (in this order):
1. get_customer_segments - get documented segment definition
2. get_extracted_entities(entity_type="persona", search="enterprise") - extracted personas
3. get_extracted_entities(entity_type="pain_point", search="enterprise") - their pain points
4. get_extracted_entities(entity_type="use_case", search="enterprise") - their use cases
5. get_context_sources(search="enterprise") - original source material
THEN synthesize comprehensive view

**Data Retrieval Summary:**
- User asks about customers/users → call get_personas + get_extracted_entities(entity_type="persona")
- User asks about feedback → call get_feedback_items + get_context_sources
- User asks about pain points → call get_extracted_entities(entity_type="pain_point")
- User asks about feature requests → call get_extracted_entities(entity_type="feature_request")
- User asks about themes/patterns → call get_themes + get_entity_summary
- User asks about features → call get_features
- User asks about strategy → call get_product_strategy or get_all_product_knowledge
- User asks about segments → call get_customer_segments + get_extracted_entities
- User asks about competitors → call get_competitive_landscape + get_extracted_entities(entity_type="competitor")
- User discusses value prop → call get_value_proposition
- User asks about metrics → call get_metrics_and_targets
- User asks "what did we do before?" → call get_past_skill_work or search_past_skill_work

**Analysis Tools** (use when analyzing):
- Prioritizing features → call calculate_rice_score
- Testing feature appeal → call simulate_persona_votes

**External Information** (when you need current/external data):
- Market trends, competitors, best practices, industry benchmarks → call search_internet
- User asks "what are competitors doing?" → search_internet
- User asks "what's the latest in [technology]?" → search_internet
- User asks "best practices for [thing]?" → search_internet

**Key Principles**:
1. Check existing data FIRST (get_work_context_summary, get_personas, etc.)
2. Only add NEW information - avoid duplicates
3. Use tools proactively - if user asks about personas, fetch them, don't just say "you have personas"
4. Search internet when internal data doesn't answer the question

EXAMPLES:
- "Who are our users?" → call get_personas, then discuss
- "What are customers saying about X?" → call get_feedback_items, filter for X
- "How should I prioritize feature Y?" → call calculate_rice_score for feature Y
- "What are Notion's latest AI features?" → call search_internet("Notion AI features 2025")
- "Let's work on Disney project" → check get_work_context_summary, add if new

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
            'get_feedback_summary',
            'get_personas',
            'get_features',
            'get_product_strategy',
            'get_customer_segments',
            'get_competitive_landscape',
            'get_value_proposition',
            'get_metrics_and_targets',
            'get_all_product_knowledge',
            'get_context_sources',
            'get_extracted_entities',
            'get_entity_summary',
            'get_past_skill_work',
            'search_past_skill_work',
            'calculate_rice_score',
            'simulate_persona_votes',
            'search_internet'
        ]

        # Create skill_config for handle_function_calling
        skill_config = {
            'name': 'general-pm-assistant',
            'tools': default_tools
        }

        response_content, metadata = await handle_function_calling(
            user_message=message,
            conversation_history=formatted_history,
            system_prompt=system_prompt,
            skill_config=skill_config,
            llm_service=llm,
            tenant_id=self.user.tenant_id,
            db=self.db,
            product_id=product_id,
            user=self.user
        )

        # Save assistant message
        assistant_msg = SkillMessage(
            conversation_id=conversation_id,
            role='assistant',
            content=response_content,
            skill_name=None,
            skill_type=None,
            sequence_number=await self._get_next_sequence_number(conversation_id),
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
        context_data = {'product_id': product_id} if product_id is not None else None
        conversation = SkillConversation(
            id=str(uuid.uuid4()),
            user_id=self.user.id,
            tenant_id=self.user.tenant_id,
            context_data=context_data,
            session_name="New Conversation",
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
