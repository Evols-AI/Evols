"""
Function calling support for Copilot
Implements agent loop for tool execution
"""

from typing import List, Dict, Any, Optional, Tuple
from loguru import logger
import json
from app.services.skill_tools import tool_registry


async def handle_function_calling(
    user_message: str,
    conversation_history: List[Dict],
    system_prompt: str,
    skill_config: Dict,
    llm_service,
    tenant_id: int,
    db,
    product_id: Optional[int] = None
) -> Tuple[str, Optional[List[Dict]]]:
    """
    Handle function calling agent loop.
    Returns (final_response, tool_calls_made)
    """
    # Get available tools for this skill
    available_tools = skill_config.get('tools', [])
    if not available_tools:
        # No tools, fallback to regular mode
        return await generate_without_tools(user_message, conversation_history, system_prompt, llm_service)

    # Build tool schemas for LLM
    tool_schemas = []
    for tool_name in available_tools:
        tool = tool_registry.get_tool(tool_name)
        if tool:
            tool_schemas.append({
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            param.name: {
                                "type": param.type,
                                "description": param.description,
                                **({"enum": param.enum} if param.enum else {}),
                                **({"items": param.items} if param.items else {})
                            }
                            for param in tool.parameters
                        },
                        "required": [p.name for p in tool.parameters if p.required]
                    }
                }
            })

    logger.info(f"[Function Calling] Built {len(tool_schemas)} tool schemas: {[t['function']['name'] for t in tool_schemas]}")

    # Agent loop
    messages = [{"role": "system", "content": system_prompt}]
    for msg in conversation_history:
        messages.append({"role": msg['role'], "content": msg['content']})
    messages.append({"role": "user", "content": user_message})

    tool_calls_made = []
    max_iterations = 5

    for iteration in range(max_iterations):
        try:
            logger.info(f"[Function Calling] Iteration {iteration + 1}/{max_iterations}")

            # Call LLM with function calling
            response = await llm_service.generate(
                messages=messages,
                max_tokens=4096,
                temperature=0.7,
                tools=tool_schemas if tool_schemas else None
            )

            logger.info(f"[Function Calling] LLM response - has tool_calls attr: {hasattr(response, 'tool_calls')}, tool_calls value: {getattr(response, 'tool_calls', None)}, finish_reason: {response.finish_reason}")

            # Check if LLM wants to call a function
            if hasattr(response, 'tool_calls') and response.tool_calls:
                logger.info(f"[Function Calling] LLM requested {len(response.tool_calls)} tool call(s)")

                # Execute tool calls
                for tool_call in response.tool_calls:
                    tool_name = tool_call.function['name']
                    tool_args = json.loads(tool_call.function['arguments'])

                    # Save original args before execute_tool mutates them (injects db, tenant_id)
                    tool_args_for_logging = tool_args.copy()

                    logger.info(f"[Function Calling] Executing tool: {tool_name} with args: {tool_args_for_logging}")

                    try:
                        # Execute tool (this mutates tool_args to add db, tenant_id, and optionally product_id)
                        tool_result = await tool_registry.execute_tool(
                            tool_name=tool_name,
                            arguments=tool_args,
                            tenant_id=tenant_id,
                            db=db,
                            product_id=product_id
                        )

                        # Ensure result is JSON-serializable by doing a round-trip
                        # This catches any SQLAlchemy objects or other non-serializable data
                        try:
                            # First try without default to catch non-serializable objects
                            serialized = json.dumps(tool_result)
                            tool_result = json.loads(serialized)
                        except (TypeError, ValueError) as e:
                            logger.error(f"[Function Calling] Tool result not JSON-serializable: {e}")
                            logger.error(f"[Function Calling] Problematic result type: {type(tool_result)}")
                            logger.error(f"[Function Calling] Result preview: {str(tool_result)[:200]}")
                            # Fallback: try with default=str to convert problematic objects
                            try:
                                serialized = json.dumps(tool_result, default=str)
                                tool_result = json.loads(serialized)
                                logger.warning(f"[Function Calling] Converted non-serializable objects to strings")
                            except Exception as e2:
                                logger.error(f"[Function Calling] Even default=str failed: {e2}")
                                tool_result = {"error": f"Tool returned non-serializable data: {str(e)}"}

                        tool_calls_made.append({
                            "tool": tool_name,
                            "arguments": tool_args_for_logging,  # Use original args, not mutated ones
                            "result": tool_result
                        })

                        logger.info(f"[Function Calling] Tool {tool_name} executed successfully")

                    except Exception as e:
                        logger.error(f"[Function Calling] Tool execution failed: {e}")
                        tool_calls_made.append({
                            "tool": tool_name,
                            "arguments": tool_args_for_logging,  # Use original args, not mutated ones
                            "error": str(e)
                        })
                        tool_result = {"error": str(e)}

                # Format tool results for the LLM
                # OpenAI format: assistant message with tool_calls, then tool messages
                # Anthropic format: assistant message, then user message with tool results
                provider = llm_service.provider

                if provider in ["openai", "azure_openai"]:
                    # OpenAI format
                    messages.append({
                        "role": "assistant",
                        "content": response.content or "",
                        "tool_calls": [{"id": tc.id, "function": {"name": tc.function['name'], "arguments": tc.function['arguments']}} for tc in response.tool_calls]
                    })
                    for tc in response.tool_calls:
                        # Find the result for this tool call
                        tc_result = next((t for t in tool_calls_made if t['tool'] == tc.function['name']), None)
                        if tc_result:
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tc.id,
                                "name": tc.function['name'],
                                "content": json.dumps(tc_result.get('result', tc_result.get('error')), default=str)
                            })
                else:
                    # Anthropic/Bedrock format
                    # Assistant message with tool_use blocks (already in response.content as blocks)
                    # Then user message with tool_result blocks
                    tool_results = []
                    for tc in response.tool_calls:
                        tc_result = next((t for t in tool_calls_made if t['tool'] == tc.function['name']), None)
                        if tc_result:
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": tc.id,
                                "content": json.dumps(tc_result.get('result', tc_result.get('error')), default=str)
                            })

                    # Add assistant message (with tool_use) - need to reconstruct content blocks
                    # Only add text block if there's actual content (Bedrock rejects empty text blocks)
                    content_blocks = []
                    if response.content:
                        content_blocks.append({"type": "text", "text": response.content})

                    content_blocks.extend([
                        {
                            "type": "tool_use",
                            "id": tc.id,
                            "name": tc.function['name'],
                            "input": json.loads(tc.function['arguments'])
                        }
                        for tc in response.tool_calls
                    ])

                    messages.append({
                        "role": "assistant",
                        "content": content_blocks
                    })

                    # Add user message with tool results
                    messages.append({
                        "role": "user",
                        "content": tool_results
                    })

                # Continue loop to get final response
                continue

            # No more tool calls, return final response
            logger.info(f"[Function Calling] LLM provided final response after {iteration + 1} iterations")
            return response.content, tool_calls_made

        except Exception as e:
            logger.error(f"[Function Calling] Error in iteration {iteration}: {e}")
            # Fallback to regular mode
            return f"I encountered an error while processing your request: {str(e)}", tool_calls_made

    # Max iterations reached
    logger.warning(f"[Function Calling] Max iterations reached")
    return "I've gathered all the necessary information but need more iterations to provide a complete response. Please try rephrasing your question.", tool_calls_made


async def generate_without_tools(
    user_message: str,
    conversation_history: List[Dict],
    system_prompt: str,
    llm_service
) -> Tuple[str, None]:
    """Generate response without function calling"""
    full_prompt = f"{system_prompt}\n\n"
    for msg in conversation_history:
        role = msg['role'].title()
        full_prompt += f"{role}: {msg['content']}\n\n"
    full_prompt += f"User: {user_message}\n\nAssistant:"

    response = await llm_service.generate(
        prompt=full_prompt,
        max_tokens=4096,
        temperature=0.7
    )
    return response.content, None
