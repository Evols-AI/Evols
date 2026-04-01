"""
Function calling support for Copilot
Implements agent loop for tool execution
"""

from typing import List, Dict, Any, Optional, Tuple
from loguru import logger
import json
import re
from app.services.skill_tools import tool_registry


def _clean_response_formatting(response: str) -> str:
    """
    Clean and format LLM response for end users.
    Removes internal reasoning tags, tool mentions, HTML tags, and formatting issues.
    """
    if not response:
        return response

    original = response

    # 1. Extract <result> content if present (internal reasoning wrapper)
    result_match = re.search(r'<result>(.*?)</result>', response, re.DOTALL | re.IGNORECASE)
    if result_match:
        response = result_match.group(1).strip()
        logger.info("[Response Cleaning] Extracted <result> content from XML wrapper")

    # 2. Remove internal reasoning tags
    reasoning_tags = [
        r'<search_quality_reflection>.*?</search_quality_reflection>',
        r'<search_quality_score>.*?</search_quality_score>',
        r'<thinking>.*?</thinking>',
        r'<analysis>.*?</analysis>',
    ]
    for tag_pattern in reasoning_tags:
        response = re.sub(tag_pattern, '', response, flags=re.DOTALL | re.IGNORECASE)

    # 3. Remove tool usage mentions (noise for users)
    tool_mention_patterns = [
        r'The\s+\w+\s+tool\s+(provided|returned|gave|showed).*?\.(\s|$)',
        r'I(?:\'ll| will)\s+(?:use|call|invoke)\s+(?:the\s+)?\w+\s+tool.*?\.(\s|$)',
        r'Using\s+(?:the\s+)?\w+\s+tool.*?\.(\s|$)',
        r'I\s+(?:called|used|invoked)\s+(?:the\s+)?\w+\s+tool.*?\.(\s|$)',
        r'After\s+(?:calling|using|invoking)\s+(?:the\s+)?\w+\s+tool.*?\.(\s|$)',
    ]
    for pattern in tool_mention_patterns:
        response = re.sub(pattern, '', response, flags=re.IGNORECASE)

    # 4. Convert HTML tags to markdown
    # Headers: <h1> -> #, <h2> -> ##, <h3> -> ###, etc.
    response = re.sub(r'<h1>(.*?)</h1>', r'# \1', response, flags=re.IGNORECASE)
    response = re.sub(r'<h2>(.*?)</h2>', r'## \1', response, flags=re.IGNORECASE)
    response = re.sub(r'<h3>(.*?)</h3>', r'### \1', response, flags=re.IGNORECASE)
    response = re.sub(r'<h4>(.*?)</h4>', r'#### \1', response, flags=re.IGNORECASE)

    # Bold and italic: <strong> -> **, <em> -> *
    response = re.sub(r'<strong>(.*?)</strong>', r'**\1**', response, flags=re.IGNORECASE)
    response = re.sub(r'<b>(.*?)</b>', r'**\1**', response, flags=re.IGNORECASE)
    response = re.sub(r'<em>(.*?)</em>', r'*\1*', response, flags=re.IGNORECASE)
    response = re.sub(r'<i>(.*?)</i>', r'*\1*', response, flags=re.IGNORECASE)

    # Lists: <ul> and <ol> tags
    response = re.sub(r'<ul>\s*', '\n', response, flags=re.IGNORECASE)
    response = re.sub(r'</ul>\s*', '\n', response, flags=re.IGNORECASE)
    response = re.sub(r'<ol>\s*', '\n', response, flags=re.IGNORECASE)
    response = re.sub(r'</ol>\s*', '\n', response, flags=re.IGNORECASE)
    response = re.sub(r'<li>\s*', '- ', response, flags=re.IGNORECASE)
    response = re.sub(r'</li>\s*', '\n', response, flags=re.IGNORECASE)

    # Paragraphs: <p> tags
    response = re.sub(r'<p>\s*', '\n\n', response, flags=re.IGNORECASE)
    response = re.sub(r'</p>\s*', '\n', response, flags=re.IGNORECASE)

    # Line breaks: <br>
    response = re.sub(r'<br\s*/?>', '\n', response, flags=re.IGNORECASE)

    # Code: <code> -> `
    response = re.sub(r'<code>(.*?)</code>', r'`\1`', response, flags=re.IGNORECASE)

    # 5. Remove any remaining HTML/XML tags
    response = re.sub(r'<[^>]+>', '', response)

    # 6. Clean up whitespace issues
    # Remove extra blank lines (more than 2 consecutive newlines)
    response = re.sub(r'\n\n\n+', '\n\n', response)

    # Remove trailing/leading whitespace per line
    lines = response.split('\n')
    lines = [line.rstrip() for line in lines]
    response = '\n'.join(lines)

    # Remove blank lines after numbered lists or bullets
    response = re.sub(r'(\d+\.)\s*\n+([A-Z])', r'\1 \2', response)
    response = re.sub(r'([-*])\s*\n+([A-Z])', r'\1 \2', response)

    # 7. Final cleanup
    response = response.strip()

    if response != original:
        logger.info("[Response Cleaning] Applied formatting cleanup (removed tool mentions, converted HTML, fixed whitespace)")

    return response


# Legacy function name for backwards compatibility
def _extract_result_from_response(response: str) -> str:
    """Legacy function name - calls _clean_response_formatting"""
    return _clean_response_formatting(response)


async def handle_function_calling(
    user_message: str,
    conversation_history: List[Dict],
    system_prompt: str,
    skill_config: Dict,
    llm_service,
    tenant_id: int,
    db,
    product_id: Optional[int] = None,
    user = None
) -> Tuple[str, Optional[List[Dict]]]:
    """
    Handle function calling agent loop.
    Returns (final_response, tool_calls_made)
    """
    # Extract user_id upfront to avoid detached session issues
    user_id = user.id if user else None

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

    # Get provider early for message formatting
    provider = llm_service.provider

    # Check if provider supports function calling
    function_calling_supported = provider in ["openai", "azure_openai", "aws_bedrock", "anthropic"]
    if not function_calling_supported:
        logger.warning(f"[Function Calling] Provider '{provider}' does not support function calling, falling back to basic generation")
        return await generate_without_tools(user_message, conversation_history, system_prompt, llm_service)

    # Agent loop
    messages = [{"role": "system", "content": system_prompt}]
    for msg in conversation_history:
        messages.append({"role": msg['role'], "content": msg['content']})
    messages.append({"role": "user", "content": user_message})

    tool_calls_made = []
    max_iterations = 15  # Increased to support skills that call many tools (e.g., pm-setup)
    search_calls_made = 0  # Track internet searches to prevent excessive searches
    max_search_calls = 4   # Limit to 4 searches per skill execution to prevent timeouts

    for iteration in range(max_iterations):
        try:
            logger.info(f"[Function Calling] Iteration {iteration + 1}/{max_iterations}")

            # Let AI decide tool usage based on strong skill instructions
            tool_choice = None
            skill_name = skill_config.get('name', '')
            logger.info(f"[Function Calling] Skill name: {skill_name}, iteration: {iteration}")

            # Call LLM with function calling
            logger.info(f"[Function Calling] Calling LLM with tool_choice={tool_choice}")
            response = await llm_service.generate(
                messages=messages,
                max_tokens=4096,
                temperature=0.7,
                tools=tool_schemas if tool_schemas else None,
                tool_choice=tool_choice
            )

            logger.info(f"[Function Calling] LLM response - has tool_calls attr: {hasattr(response, 'tool_calls')}, tool_calls value: {getattr(response, 'tool_calls', None)}, finish_reason: {response.finish_reason}")
            logger.info(f"[Function Calling] LLM response content preview: {response.content[:500] if response.content else 'None'}")

            # Check if LLM wants to call a function
            if hasattr(response, 'tool_calls') and response.tool_calls:
                logger.info(f"[Function Calling] LLM requested {len(response.tool_calls)} tool call(s)")

                # Execute tool calls
                for tool_call in response.tool_calls:
                    tool_name = tool_call.function['name']
                    tool_args = json.loads(tool_call.function['arguments'])

                    # Save original args before execute_tool mutates them (injects db, tenant_id)
                    tool_args_for_logging = tool_args.copy()

                    # Validate tool name before execution (AWS Bedrock requires [a-zA-Z0-9_-]+)
                    if not re.match(r'^[a-zA-Z0-9_-]+$', tool_name):
                        logger.error(f"[Function Calling] Invalid tool name '{tool_name}' - contains invalid characters. Skipping.")
                        tool_result = {"error": f"Invalid tool name: {tool_name}"}
                        tool_calls_made.append({
                            "tool": tool_name,
                            "arguments": tool_args,
                            "error": f"Invalid tool name: {tool_name}"
                        })
                        # Add error to tool_calls_made so it gets formatted properly later
                        tool_calls_made.append({
                            "tool": tool_name,
                            "arguments": tool_args,
                            "error": f"Tool '{tool_name}' does not exist. Available tools: {', '.join(available_tools)}",
                            "tool_call_id": tool_call.id
                        })
                        continue

                    # Check if this is a search tool and we've reached the limit
                    if tool_name == 'search_internet':
                        if search_calls_made >= max_search_calls:
                            logger.warning(f"[Function Calling] Search limit reached ({search_calls_made}/{max_search_calls}). Skipping search: {tool_args_for_logging}")
                            tool_result = {
                                "error": f"Search limit reached ({max_search_calls} searches per skill). Please work with the data you already have.",
                                "query": tool_args_for_logging.get('query', ''),
                                "answer": "Search limit reached - using existing information",
                                "results": []
                            }
                            tool_calls_made.append({
                                "tool": tool_name,
                                "arguments": tool_args_for_logging,
                                "result": tool_result
                            })
                            # Tool result stored in tool_calls_made array - will be formatted later
                            # Don't add to messages here to avoid duplication
                            continue
                        else:
                            search_calls_made += 1
                            logger.info(f"[Function Calling] Search call #{search_calls_made}/{max_search_calls}")

                    logger.info(f"[Function Calling] Executing tool: {tool_name} with args: {tool_args_for_logging}")

                    try:
                        # Execute tool (this mutates tool_args to add db, tenant_id, and optionally product_id, user_id)
                        tool_result = await tool_registry.execute_tool(
                            tool_name=tool_name,
                            arguments=tool_args,
                            tenant_id=tenant_id,
                            db=db,
                            product_id=product_id,
                            user_id=user_id
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

                        # Check if tool returned an error (success: false)
                        if isinstance(tool_result, dict) and tool_result.get('success') == False:
                            error_msg = tool_result.get('error', 'Unknown error')
                            logger.error(f"[Function Calling] Tool {tool_name} returned error: {error_msg}")
                        else:
                            logger.info(f"[Function Calling] Tool {tool_name} executed successfully")

                    except Exception as e:
                        logger.error(f"[Function Calling] Tool execution failed: {e}")
                        # Provide a graceful error message that doesn't disrupt skill execution
                        graceful_error = f"Tool {tool_name} encountered an issue but this doesn't prevent continuing with the main task."
                        tool_calls_made.append({
                            "tool": tool_name,
                            "arguments": tool_args_for_logging,  # Use original args, not mutated ones
                            "error": str(e),
                            "result": {"success": False, "error": graceful_error, "note": "Main task can continue despite this tool failure"}
                        })
                        tool_result = {"success": False, "error": graceful_error, "note": "Main task can continue despite this tool failure"}

                # Format tool results for the LLM - provider-specific formats
                # OpenAI/Azure format: assistant message with tool_calls, then tool messages
                # Anthropic InvokeModel format: assistant message with tool_use blocks, then user message with tool_result blocks
                # Bedrock Converse format: assistant message with toolUse blocks, then user message with toolResult blocks
                # Google Gemini: Function calling not yet implemented

                if provider in ["openai", "azure_openai"]:
                    # OpenAI/Azure OpenAI format
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
                elif provider == "aws_bedrock":
                    # Bedrock Converse API format
                    # Assistant message with toolUse blocks, then user message with toolResult blocks
                    tool_results = []
                    for tc in response.tool_calls:
                        tc_result = next((t for t in tool_calls_made if t['tool'] == tc.function['name']), None)
                        if tc_result:
                            # Converse API requires content as array of text/json blocks
                            result_content = json.dumps(tc_result.get('result', tc_result.get('error')), default=str)
                            tool_results.append({
                                "toolResult": {
                                    "toolUseId": tc.id,
                                    "content": [{"text": result_content}]
                                }
                            })

                    # Add assistant message (with toolUse blocks)
                    content_blocks = []
                    if response.content:
                        content_blocks.append({"text": response.content})

                    content_blocks.extend([
                        {
                            "toolUse": {
                                "toolUseId": tc.id,
                                "name": tc.function['name'],
                                "input": json.loads(tc.function['arguments'])
                            }
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
                elif provider == "google_gemini":
                    # Google Gemini function calling not yet implemented
                    # This should never be reached since Gemini doesn't return tool calls
                    logger.warning(f"[Function Calling] Google Gemini function calling not yet implemented")
                    messages.append({
                        "role": "assistant",
                        "content": response.content or "Function calling is not yet supported for Google Gemini."
                    })
                elif provider == "anthropic":
                    # Anthropic InvokeModel format (direct API, not Bedrock)
                    tool_results = []
                    for tc in response.tool_calls:
                        tc_result = next((t for t in tool_calls_made if t['tool'] == tc.function['name']), None)
                        if tc_result:
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": tc.id,
                                "content": json.dumps(tc_result.get('result', tc_result.get('error')), default=str)
                            })
                else:
                    # Fallback for unknown providers
                    logger.error(f"[Function Calling] Unsupported provider for function calling: {provider}")
                    messages.append({
                        "role": "assistant",
                        "content": response.content or f"Function calling is not supported for provider: {provider}"
                    })

                    # Add assistant message (with tool_use) - need to reconstruct content blocks
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

            # Detect if LLM is writing about calling tools instead of actually calling them
            fake_tool_patterns = [
                r'@\w+\(',  # @get_something(
                r'Call:',
                r'call\(',
                r'\[This will return',
                r'\[This tool will',
                r'I will call',
                r'Let me call',
                r'I\'ll invoke',
                # Check for actual tool names being output as text
                r'add_or_update_project\(',
                r'add_task\(',
                r'add_or_update_relationship\(',
                r'update_role_info\(',
                r'set_weekly_focus\(',
                r'log_pm_decision\(',
            ]

            is_fake_call = False
            for pattern in fake_tool_patterns:
                if re.search(pattern, response.content or ''):
                    is_fake_call = True
                    logger.error(f"[Function Calling] ⚠️ LLM is DESCRIBING tool calls instead of MAKING them!")
                    logger.error(f"[Function Calling] Pattern detected: {pattern}")
                    logger.error(f"[Function Calling] Content preview: {response.content[:500]}")
                    break

            if is_fake_call:
                # Return error message to user explaining what went wrong
                return (
                    "I apologize, but I encountered an issue generating your PRD. "
                    "Please try using the skill directly with: @create-prd [your feature description]\n\n"
                    "This will ensure I properly gather your product context and work information to create a complete PRD.",
                    tool_calls_made
                )

            # Clean up response - extract only the <result> content if XML tags present
            cleaned_response = _extract_result_from_response(response.content)
            return cleaned_response, tool_calls_made

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

    # Apply response cleaning
    cleaned_content = _clean_response_formatting(response.content)
    return cleaned_content, None
