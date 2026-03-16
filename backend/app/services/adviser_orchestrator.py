"""
Adviser Orchestrator
The "agent loop" that executes adviser sessions
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
import uuid

from app.models.adviser import (
    Adviser, CustomAdviser, AdviserSession, AdviserMessage,
    AdviserType, AdviserPhase
)
from app.services.adviser_tools import tool_registry
from app.services.llm_service import LLMService
from app.core.config import settings


class AdviserOrchestrator:
    """
    Orchestrates adviser sessions.
    Handles the agent loop: question gathering → task execution → output generation → refinement.
    """

    def __init__(self):
        self.settings = settings

    async def get_adviser_config(
        self,
        adviser_id: int,
        adviser_type: AdviserType,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Load adviser configuration"""
        if adviser_type == AdviserType.DEFAULT:
            result = await db.execute(
                select(Adviser).where(Adviser.id == adviser_id)
            )
            adviser = result.scalar_one_or_none()
        else:
            result = await db.execute(
                select(CustomAdviser).where(CustomAdviser.id == adviser_id)
            )
            adviser = result.scalar_one_or_none()

        if not adviser:
            raise ValueError(f"Adviser not found: {adviser_id}")

        return {
            "id": adviser.id,
            "name": adviser.name,
            "description": adviser.description,
            "icon": adviser.icon,
            "tools": adviser.tools,
            "initial_questions": adviser.initial_questions,
            "task_definitions": adviser.task_definitions,
            "instructions": adviser.instructions,
            "output_template": adviser.output_template
        }

    async def create_session(
        self,
        adviser_id: int,
        adviser_type: AdviserType,
        user_id: int,
        tenant_id: int,
        db: AsyncSession
    ) -> AdviserSession:
        """Create new adviser session"""
        session_id = str(uuid.uuid4())

        session = AdviserSession(
            id=session_id,
            user_id=user_id,
            tenant_id=tenant_id,
            adviser_id=adviser_id,
            adviser_type=adviser_type,
            phase=AdviserPhase.INITIAL_GENERATION
        )

        db.add(session)
        await db.commit()
        await db.refresh(session)

        return session

    async def get_initial_questions(
        self,
        adviser_id: int,
        adviser_type: AdviserType,
        db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """Get initial questions to ask user"""
        config = await self.get_adviser_config(adviser_id, adviser_type, db)
        return config["initial_questions"]

    async def submit_answers(
        self,
        session_id: str,
        answers: Dict[str, Any],
        tenant_id: int,
        tenant_config: Dict[str, Any],
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        User submits answers to initial questions.
        Trigger generation of initial output.
        """
        # Get session
        result = await db.execute(
            select(AdviserSession).where(AdviserSession.id == session_id)
        )
        session = result.scalar_one_or_none()

        if not session:
            raise ValueError("Session not found")

        # Save answers
        session.context_data = answers
        await db.commit()

        # Generate initial output
        output = await self._generate_output(session, tenant_id, tenant_config, db)

        # Update session
        session.output_data = output
        session.phase = AdviserPhase.REFINEMENT
        await db.commit()

        return output

    async def _generate_output(
        self,
        session: AdviserSession,
        tenant_id: int,
        tenant_config: Dict[str, Any],
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Execute adviser tasks and generate output.
        This is the core "agent loop".
        """
        # Load adviser config
        config = await self.get_adviser_config(
            session.adviser_id,
            session.adviser_type,
            db
        )

        # Build context from answers
        context = session.context_data or {}

        # Get available tools
        available_tools = []
        for tool_name in config["tools"]:
            tool = tool_registry.get_tool(tool_name)
            if tool:
                available_tools.append(tool)

        # Build system prompt
        system_prompt = self._build_system_prompt(config, context, available_tools)

        # Execute tasks with LLM
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Please complete the tasks and generate the output."}
        ]

        # Get tool schemas for function calling
        tool_schemas = []
        for tool in available_tools:
            tool_schemas.extend(tool_registry.get_tools_schema())

        # Call LLM with function calling
        response = await self._execute_with_tools(
            messages=messages,
            tools=tool_schemas,
            tenant_id=tenant_id,
            tenant_config=tenant_config,
            db=db
        )

        # Parse and structure output
        output = self._parse_output(response, config.get("output_template"))

        # Save assistant message
        await self._save_message(
            session_id=session.id,
            role="assistant",
            content=response,
            db=db
        )

        return output

    async def _execute_with_tools(
        self,
        messages: List[Dict[str, str]],
        tools: List[Dict[str, Any]],
        tenant_id: int,
        tenant_config: Dict[str, Any],
        db: AsyncSession,
        max_iterations: int = 10
    ) -> str:
        """
        Execute LLM with tool calling in a loop.
        Agent can call tools multiple times until it has enough information.
        """
        # Create LLM service with tenant config
        from app.services.llm_service import get_llm_service_from_config
        llm_service = get_llm_service_from_config(tenant_config=tenant_config)

        iteration = 0
        conversation = messages.copy()

        while iteration < max_iterations:
            # Call LLM
            response = await llm_service.chat_completion(
                messages=conversation,
                tools=tools if tools else None,
                config=tenant_config
            )

            assistant_message = response.choices[0].message

            # Check if LLM wants to call tools
            if hasattr(assistant_message, 'tool_calls') and assistant_message.tool_calls:
                # Add assistant message with tool calls
                conversation.append({
                    "role": "assistant",
                    "content": assistant_message.content or "",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments
                            }
                        }
                        for tc in assistant_message.tool_calls
                    ]
                })

                # Execute tool calls
                for tool_call in assistant_message.tool_calls:
                    function_name = tool_call.function.name
                    function_args = json.loads(tool_call.function.arguments)

                    # Execute tool
                    try:
                        tool_result = await tool_registry.execute_tool(
                            tool_name=function_name,
                            arguments=function_args,
                            tenant_id=tenant_id,
                            db=db
                        )
                        result_content = json.dumps(tool_result)
                    except Exception as e:
                        result_content = json.dumps({"error": str(e)})

                    # Add tool result to conversation
                    conversation.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": result_content
                    })

                iteration += 1
                continue  # Continue loop for next LLM call

            else:
                # No more tool calls, return final response
                return assistant_message.content or ""

        # Max iterations reached
        return "I apologize, but I've reached my processing limit. Let me provide what I have so far."

    def _build_system_prompt(
        self,
        config: Dict[str, Any],
        context: Dict[str, Any],
        tools: List[Any]
    ) -> str:
        """Build system prompt for adviser"""
        prompt = config["instructions"] + "\n\n"

        prompt += "## User Context\n"
        for key, value in context.items():
            prompt += f"- {key}: {value}\n"

        prompt += "\n## Your Tasks\n"
        for i, task in enumerate(config["task_definitions"], 1):
            prompt += f"{i}. {task}\n"

        prompt += "\n## Available Tools\n"
        prompt += "You have access to the following tools to gather data:\n"
        for tool in tools:
            prompt += f"- {tool.name}: {tool.description}\n"

        if config.get("output_template"):
            prompt += f"\n## Output Format\n{config['output_template']}\n"

        prompt += "\nPlease complete all tasks and generate a comprehensive output for the user."

        return prompt

    def _parse_output(self, response: str, template: Optional[str]) -> Dict[str, Any]:
        """Parse LLM response into structured output"""
        # Try to extract JSON if present
        try:
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                json_str = response[json_start:json_end].strip()
                return json.loads(json_str)
            elif "{" in response and "}" in response:
                # Try to find JSON object
                start = response.find("{")
                end = response.rfind("}") + 1
                json_str = response[start:end]
                return json.loads(json_str)
        except:
            pass

        # Fallback: return as text
        return {
            "output_type": "text",
            "content": response
        }

    async def chat_refinement(
        self,
        session_id: str,
        user_message: str,
        tenant_id: int,
        tenant_config: Dict[str, Any],
        db: AsyncSession
    ) -> str:
        """
        Handle refinement conversation.
        User provides free-form feedback to improve the output.
        """
        # Get session
        result = await db.execute(
            select(AdviserSession).where(AdviserSession.id == session_id)
        )
        session = result.scalar_one_or_none()

        if not session:
            raise ValueError("Session not found")

        # Save user message
        await self._save_message(
            session_id=session_id,
            role="user",
            content=user_message,
            db=db
        )

        # Get conversation history
        messages = await self._get_conversation_history(session_id, db)

        # Load adviser config
        config = await self.get_adviser_config(
            session.adviser_id,
            session.adviser_type,
            db
        )

        # Add system context
        system_message = {
            "role": "system",
            "content": f"{config['instructions']}\n\nYou are refining an output based on user feedback. Current output:\n{json.dumps(session.output_data)}"
        }

        full_messages = [system_message] + messages

        # Get tool schemas
        available_tools = []
        for tool_name in config["tools"]:
            tool = tool_registry.get_tool(tool_name)
            if tool:
                available_tools.append(tool)

        tool_schemas = tool_registry.get_tools_schema() if available_tools else None

        # Call LLM with tools
        response = await self._execute_with_tools(
            messages=full_messages,
            tools=tool_schemas,
            tenant_id=tenant_id,
            tenant_config=tenant_config,
            db=db
        )

        # Save assistant response
        await self._save_message(
            session_id=session_id,
            role="assistant",
            content=response,
            db=db
        )

        # Update output if LLM generated a new version
        updated_output = self._parse_output(response, config.get("output_template"))
        if updated_output.get("output_type") != "text":
            session.output_data = updated_output
            await db.commit()

        return response

    async def _save_message(
        self,
        session_id: str,
        role: str,
        content: str,
        tool_calls: Optional[List[Dict]] = None,
        db: AsyncSession = None
    ):
        """Save message to database"""
        # Get current max sequence number
        result = await db.execute(
            select(AdviserMessage)
            .where(AdviserMessage.session_id == session_id)
            .order_by(AdviserMessage.sequence_number.desc())
            .limit(1)
        )
        last_message = result.scalar_one_or_none()
        next_seq = (last_message.sequence_number + 1) if last_message else 1

        message = AdviserMessage(
            session_id=session_id,
            role=role,
            content=content,
            tool_calls=tool_calls,
            sequence_number=next_seq
        )

        db.add(message)
        await db.commit()

    async def _get_conversation_history(
        self,
        session_id: str,
        db: AsyncSession
    ) -> List[Dict[str, str]]:
        """Get conversation history for session"""
        result = await db.execute(
            select(AdviserMessage)
            .where(AdviserMessage.session_id == session_id)
            .order_by(AdviserMessage.sequence_number)
        )
        messages = result.scalars().all()

        return [
            {
                "role": msg.role,
                "content": msg.content
            }
            for msg in messages
        ]


# Export
__all__ = ['AdviserOrchestrator']
