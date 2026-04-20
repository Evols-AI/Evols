"""
LLM Service
Unified interface for multiple LLM providers (OpenAI, Anthropic, Azure, AWS Bedrock)
"""

import os
import json
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel
import asyncio
from loguru import logger

from app.core.config import settings

# Import cache service
try:
    from app.services.llm_cache_service import LLMCacheService
    CACHE_AVAILABLE = True
except ImportError:
    CACHE_AVAILABLE = False
    logger.warning("[LLMService] LLMCacheService not available")

# Optional imports - installed only if needed
try:
    from openai import AsyncOpenAI
    import instructor
except ImportError:
    AsyncOpenAI = None
    instructor = None

try:
    from anthropic import AsyncAnthropic
except ImportError:
    AsyncAnthropic = None

try:
    import boto3
    from botocore.config import Config as BotocoreConfig
except ImportError:
    boto3 = None
    BotocoreConfig = None

try:
    import google.generativeai as genai
    from google.generativeai.types import HarmCategory, HarmBlockThreshold
except ImportError:
    genai = None


class LLMConfig(BaseModel):
    """LLM Configuration"""
    provider: Literal["openai", "anthropic", "azure_openai", "aws_bedrock", "google_gemini"]
    api_key: Optional[str] = None
    model: str = "gpt-5.4"  # Updated to latest GPT-5.4 (March 2026)
    temperature: float = 0.7
    max_tokens: int = 2000

    # Azure-specific
    azure_endpoint: Optional[str] = None
    azure_deployment: Optional[str] = None

    # AWS Bedrock-specific
    aws_region: Optional[str] = None
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_session_token: Optional[str] = None


# Model tier mapping for cost optimization
# Maps premium models to their cheaper alternatives per provider
MODEL_TIERS = {
    # Latest Models (2026) - Cost Optimization Mappings

    # OpenAI - GPT models (2026 → older)
    "gpt-5.4": "gpt-5.2",                   # Latest → Previous version
    "gpt-5.2": "gpt-4o",                    # GPT-5.2 → Previous flagship
    "gpt-4o": "gpt-4o-mini",               # Previous flagship → Mini
    "gpt-4": "gpt-4o-mini",
    "gpt-4-turbo": "gpt-4o-mini",
    "gpt-4-turbo-preview": "gpt-4o-mini",
    "gpt-4o-2024-11-20": "gpt-4o-mini",

    # Anthropic API - Claude models (4.6 → 4.5 → 3.5)
    "claude-opus-4-6": "claude-sonnet-4-6",           # Latest Opus → Latest Sonnet
    "claude-sonnet-4-6": "claude-haiku-4-5-20251001", # Latest Sonnet → Fast option
    "claude-opus-4-20250514": "claude-sonnet-4-6",    # Older Claude 4 → Latest Sonnet
    "claude-3-5-sonnet-20241022": "claude-3-5-haiku-20241022",  # Legacy mapping
    "claude-3-opus-20240229": "claude-3-5-sonnet-20241022",     # Legacy mapping

    # AWS Bedrock - Anthropic Claude models (4.6 inference profiles → 4.5 → 3.5)
    "global.anthropic.claude-sonnet-4-6": "anthropic.claude-sonnet-4-5-20250929-v1:0",  # Global Sonnet → Claude 4.5
    "global.anthropic.claude-opus-4-6-v1": "global.anthropic.claude-sonnet-4-6",  # Global Opus → Global Sonnet
    "us.anthropic.claude-sonnet-4-6": "anthropic.claude-sonnet-4-5-20250929-v1:0",  # US Sonnet → Claude 4.5
    "us.anthropic.claude-opus-4-6-v1": "us.anthropic.claude-sonnet-4-6",  # US Opus → US Sonnet
    "eu.anthropic.claude-sonnet-4-6": "anthropic.claude-sonnet-4-5-20250929-v1:0",  # EU Sonnet → Claude 4.5
    "eu.anthropic.claude-opus-4-6-v1": "eu.anthropic.claude-sonnet-4-6",  # EU Opus → EU Sonnet
    "au.anthropic.claude-sonnet-4-6": "anthropic.claude-sonnet-4-5-20250929-v1:0",  # AU Sonnet → Claude 4.5
    "au.anthropic.claude-opus-4-6-v1": "au.anthropic.claude-sonnet-4-6",  # AU Opus → AU Sonnet
    "anthropic.claude-sonnet-4-5-20250929-v1:0": "anthropic.claude-3-5-sonnet-20241022-v2:0",  # Claude 4.5 → 3.5
    "anthropic.claude-3-5-sonnet-20241022-v2:0": "anthropic.claude-3-5-haiku-20241022-v1:0",
    "anthropic.claude-3-opus-20240229-v1:0": "anthropic.claude-3-sonnet-20240229-v1:0",
    "anthropic.claude-3-sonnet-20240229-v1:0": "anthropic.claude-3-haiku-20240307-v1:0",

    # Google Gemini models (2.5 → 1.5 for production, 3.1 preview not recommended)
    "gemini-2.5-flash": "gemini-2.5-flash-lite",      # Production Flash → Lite
    "gemini-3.1-pro-preview": "gemini-2.5-flash",     # Preview → Production
    "gemini-3.1-flash-lite-preview": "gemini-2.5-flash-lite",  # Preview → Production
    "gemini-1.5-pro": "gemini-1.5-flash",             # Legacy Pro → Legacy Flash
    "gemini-1.5-flash": "gemini-1.5-flash-8b",        # Legacy Flash → Ultra-fast

    # Add more mappings as needed
}


class ToolCall(BaseModel):
    """Function/tool call from LLM"""
    id: str
    type: str = "function"
    function: Dict[str, str]  # {"name": "tool_name", "arguments": "json_string"}


class LLMResponse(BaseModel):
    """Standardized LLM response"""
    content: str
    model: str
    usage: Dict[str, int]
    finish_reason: str
    tool_calls: Optional[List[ToolCall]] = None


class LLMService:
    """
    Unified LLM service supporting multiple providers
    """

    def __init__(self, config: LLMConfig, enable_cache: bool = True):
        self.config = config
        self.provider = config.provider

        # Initialize cache for cost optimization
        if CACHE_AVAILABLE and enable_cache:
            try:
                self.cache = LLMCacheService()
            except Exception as e:
                logger.warning(f"[LLMService] Failed to initialize cache: {e}")
                self.cache = None
        else:
            self.cache = None

        # Initialize clients based on provider
        if self.provider == "openai":
            if AsyncOpenAI is None:
                raise ImportError("openai package is required. Install with: pip install openai")
            if instructor is None:
                raise ImportError("instructor package is required. Install with: pip install instructor")

            # Create base client
            base_client = AsyncOpenAI(api_key=config.api_key)
            # Patch with instructor for structured outputs
            self.client = instructor.from_openai(base_client)
            self.raw_client = base_client

        elif self.provider == "anthropic":
            if AsyncAnthropic is None:
                raise ImportError("anthropic package is required. Install with: pip install anthropic")
            self.client = AsyncAnthropic(api_key=config.api_key)
            self.raw_client = self.client

        elif self.provider == "azure_openai":
            if AsyncOpenAI is None:
                raise ImportError("openai package is required. Install with: pip install openai")
            if instructor is None:
                raise ImportError("instructor package is required. Install with: pip install instructor")

            # Create base client
            base_client = AsyncOpenAI(
                api_key=config.api_key,
                azure_endpoint=config.azure_endpoint,
                azure_deployment=config.azure_deployment,
                api_version="2024-02-15-preview"
            )
            # Patch with instructor for structured outputs
            self.client = instructor.from_openai(base_client)
            self.raw_client = base_client
        elif self.provider == "aws_bedrock":
            if boto3 is None:
                raise ImportError("boto3 package is required. Install with: pip install boto3")
            
            # Initialize boto3 Bedrock client
            session_kwargs = {
                'region_name': config.aws_region or os.getenv('AWS_REGION', 'us-east-1')
            }
            
            if config.aws_access_key_id and config.aws_secret_access_key:
                session_kwargs['aws_access_key_id'] = config.aws_access_key_id
                session_kwargs['aws_secret_access_key'] = config.aws_secret_access_key
            
            if config.aws_session_token:
                session_kwargs['aws_session_token'] = config.aws_session_token
            
            session = boto3.Session(**session_kwargs)
            client_config = None
            if BotocoreConfig:
                client_config = BotocoreConfig(
                    read_timeout=300,  # 5 minutes for long-running function calling
                    connect_timeout=60,  # 1 minute to establish connection
                    retries={'max_attempts': 2}  # Retry once on timeout
                )
            self.client = session.client('bedrock-runtime', config=client_config)
        elif self.provider == "google_gemini":
            if genai is None:
                raise ImportError("google-generativeai package is required. Install with: pip install google-generativeai")

            # Configure the client
            genai.configure(api_key=config.api_key)

            # Initialize the model
            generation_config = {
                "temperature": config.temperature,
                "max_output_tokens": config.max_tokens,
            }

            # Add optional config parameters
            if hasattr(config, 'top_p') and config.top_p is not None:
                generation_config["top_p"] = config.top_p
            if hasattr(config, 'top_k') and config.top_k is not None:
                generation_config["top_k"] = config.top_k

            # Create the model instance
            self.client = genai.GenerativeModel(
                model_name=config.model,
                generation_config=generation_config,
                safety_settings={
                    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
                }
            )

    def get_cheaper_model(self) -> Optional[str]:
        """
        Get the cheaper alternative model for simple tasks.
        Returns None if no cheaper model is available.

        Uses MODEL_TIERS mapping to find cheaper alternatives based on provider.
        """
        current_model = self.config.model

        # Check if there's a cheaper tier available
        cheaper_model = MODEL_TIERS.get(current_model)

        if cheaper_model:
            logger.info(f"[LLMService] Cost optimization: {current_model} → {cheaper_model}")
            return cheaper_model

        # No cheaper model available, use same model
        logger.debug(f"[LLMService] No cheaper model available for {current_model}, using same model")
        return None

    async def generate(
        self,
        prompt: Optional[str] = None,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        use_cheaper_model: bool = False,
        skip_cache: bool = False,
        tools: Optional[List[Dict[str, Any]]] = None,
        messages: Optional[List[Dict[str, str]]] = None,
        tool_choice: Optional[str] = None,
    ) -> LLMResponse:
        """
        Generate text from prompt

        Args:
            prompt: User prompt (ignored if messages provided)
            system_prompt: System/instruction prompt (ignored if messages provided)
            temperature: Override default temperature
            max_tokens: Override default max_tokens
            use_cheaper_model: If True, use cheaper model tier for simple tasks (cost optimization)
            skip_cache: If True, bypass cache and force fresh generation
            tools: List of tools available for function calling
            messages: Full conversation messages array (for function calling with context)

        Returns:
            LLMResponse with generated content
        """
        temp = temperature if temperature is not None else self.config.temperature
        max_tok = max_tokens if max_tokens is not None else self.config.max_tokens

        # Determine which model to use
        model_to_use = self.config.model
        if use_cheaper_model:
            cheaper_model = self.get_cheaper_model()
            if cheaper_model:
                model_to_use = cheaper_model

        # Log tool usage
        if tools:
            logger.info(f"[LLMService] Function calling enabled with tools: {[t.get('function', {}).get('name') for t in tools]}")

        # Check cache first (unless skipping) - skip cache when using tools or messages
        if not skip_cache and not tools and not messages and self.cache:
            cached_response = await self.cache.get(
                prompt, system_prompt, temp, max_tok, model_to_use
            )
            if cached_response:
                return LLMResponse(**cached_response)

        # Generate fresh response
        try:
            if self.provider in ["openai", "azure_openai"]:
                response = await self._generate_openai(prompt, system_prompt, temp, max_tok, model_to_use, tools, messages_array=messages, tool_choice=tool_choice)
            elif self.provider == "anthropic":
                response = await self._generate_anthropic(prompt, system_prompt, temp, max_tok, model_to_use, tools, messages_array=messages)
            elif self.provider == "aws_bedrock":
                response = await self._generate_bedrock(prompt, system_prompt, temp, max_tok, model_to_use, tools, messages_array=messages, tool_choice=tool_choice)
            elif self.provider == "google_gemini":
                response = await self._generate_gemini(prompt, system_prompt, temp, max_tok, model_to_use, tools, messages_array=messages)
            else:
                raise ValueError(f"Unsupported provider: {self.provider}")

            # Cache the response
            if self.cache:
                await self.cache.set(
                    prompt, system_prompt, temp, max_tok, model_to_use,
                    response.model_dump()
                )

            return response

        except Exception as e:
            logger.error(f"LLM generation error: {e}")
            raise
    
    async def _generate_openai(
        self,
        prompt: Optional[str],
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        model: str,
        tools: Optional[List[Dict[str, Any]]] = None,
        messages_array: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[str] = None
    ) -> LLMResponse:
        """Generate with OpenAI (native async)"""
        # Use provided messages array or build from prompt
        if messages_array:
            messages = messages_array
        else:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

        # Build request params
        request_params = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        # Add tools if provided (OpenAI function calling)
        if tools:
            request_params["tools"] = tools
            final_tool_choice = tool_choice or "auto"
            request_params["tool_choice"] = final_tool_choice
            logger.info(f"[LLMService] Setting tool_choice={final_tool_choice} (input was: {tool_choice})")

        # Use raw_client for normal generation (instructor-patched client is for structured outputs)
        response = await self.raw_client.chat.completions.create(**request_params)

        # Extract tool calls if present
        tool_calls = None
        message = response.choices[0].message
        if hasattr(message, 'tool_calls') and message.tool_calls:
            tool_calls = [
                ToolCall(
                    id=tc.id,
                    type=tc.type,
                    function={"name": tc.function.name, "arguments": tc.function.arguments}
                )
                for tc in message.tool_calls
            ]

        return LLMResponse(
            content=message.content or "",
            model=response.model,
            usage={
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            },
            finish_reason=response.choices[0].finish_reason,
            tool_calls=tool_calls
        )
    
    async def _generate_anthropic(
        self,
        prompt: Optional[str],
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        model: str,
        tools: Optional[List[Dict[str, Any]]] = None,
        messages_array: Optional[List[Dict[str, Any]]] = None
    ) -> LLMResponse:
        """Generate with Anthropic (native async)"""
        # Use provided messages array or build from prompt
        if messages_array:
            # Extract system message if present
            system = ""
            messages = []
            for msg in messages_array:
                if msg.get("role") == "system":
                    system = msg.get("content", "")
                else:
                    messages.append(msg)
        else:
            system = system_prompt or ""
            messages = [{"role": "user", "content": prompt}]

        request_params = {
            "model": model,
            "system": system,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        # Add tools if provided (Anthropic tool use)
        if tools:
            # Convert OpenAI format to Anthropic format
            anthropic_tools = []
            for tool in tools:
                if tool.get("type") == "function":
                    func = tool.get("function", {})
                    anthropic_tools.append({
                        "name": func.get("name"),
                        "description": func.get("description"),
                        "input_schema": func.get("parameters", {})
                    })
            request_params["tools"] = anthropic_tools

        # Native async - no thread blocking
        response = await self.client.messages.create(**request_params)

        # Extract tool calls if present
        tool_calls = None
        content_text = ""
        if response.content:
            for block in response.content:
                if block.type == "text":
                    content_text = block.text
                elif block.type == "tool_use":
                    if tool_calls is None:
                        tool_calls = []
                    tool_calls.append(
                        ToolCall(
                            id=block.id,
                            type="function",
                            function={"name": block.name, "arguments": json.dumps(block.input)}
                        )
                    )

        return LLMResponse(
            content=content_text,
            model=response.model,
            usage={
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens
            },
            finish_reason=response.stop_reason,
            tool_calls=tool_calls
        )
    
    async def _generate_bedrock(
        self,
        prompt: Optional[str],
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        model: str,
        tools: Optional[List[Dict[str, Any]]] = None,
        messages_array: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[str] = None
    ) -> LLMResponse:
        """Generate with AWS Bedrock using Converse API"""
        model_id = model

        # Use Converse API for Claude models (more reliable for tool calling)
        # Handles cross-region prefixes: us.anthropic.*, global.anthropic.*, etc.
        if "anthropic.claude" in model_id or "anthropic/claude" in model_id:
            return await self._generate_bedrock_converse(
                prompt, system_prompt, temperature, max_tokens, model_id, tools, messages_array, tool_choice
            )

        # Fallback to InvokeModel for non-Claude models
        return await self._generate_bedrock_invoke_model(
            prompt, system_prompt, temperature, max_tokens, model_id, tools, messages_array
        )

    async def _generate_bedrock_converse(
        self,
        prompt: Optional[str],
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        model_id: str,
        tools: Optional[List[Dict[str, Any]]] = None,
        messages_array: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[str] = None
    ) -> LLMResponse:
        """Generate with AWS Bedrock Converse API (more reliable for tool calling)"""

        # Prepare messages
        if messages_array:
            # Extract system message if present
            system = []
            messages = []
            pending_tool_results: List[Dict[str, Any]] = []

            for msg in messages_array:
                role = msg.get("role")

                if role == "system":
                    system.append({"text": msg.get("content", "")})
                    continue

                # OpenAI tool result messages → Bedrock toolResult blocks inside a user turn
                if role == "tool":
                    pending_tool_results.append({
                        "toolResult": {
                            "toolUseId": msg.get("tool_call_id", ""),
                            "content": [{"text": str(msg.get("content", ""))}],
                        }
                    })
                    continue

                # Flush pending tool results before the next non-tool message
                if pending_tool_results:
                    messages.append({"role": "user", "content": pending_tool_results})
                    pending_tool_results = []

                # Assistant message with tool_calls → Bedrock toolUse blocks
                if role == "assistant" and msg.get("tool_calls"):
                    content_blocks: List[Dict[str, Any]] = []
                    text = msg.get("content") or ""
                    if text:
                        content_blocks.append({"text": text})
                    for tc in msg["tool_calls"]:
                        fn = tc.get("function", {})
                        import json as _json
                        args = fn.get("arguments", "{}")
                        try:
                            args_dict = _json.loads(args) if isinstance(args, str) else args
                        except Exception:
                            args_dict = {}
                        content_blocks.append({
                            "toolUse": {
                                "toolUseId": tc.get("id", ""),
                                "name": fn.get("name", ""),
                                "input": args_dict,
                            }
                        })
                    messages.append({"role": "assistant", "content": content_blocks})
                    continue

                # Normal message
                content = msg.get("content")
                if isinstance(content, str):
                    messages.append({"role": role, "content": [{"text": content}]})
                elif isinstance(content, list):
                    messages.append({"role": role, "content": content})
                else:
                    messages.append(msg)

            # Flush any trailing tool results
            if pending_tool_results:
                messages.append({"role": "user", "content": pending_tool_results})
        else:
            system = [{"text": system_prompt}] if system_prompt else []
            messages = [{"role": "user", "content": [{"text": prompt}]}]

        # Build request parameters
        request_params = {
            "modelId": model_id,
            "messages": messages,
            "inferenceConfig": {
                "maxTokens": max_tokens,
                "temperature": temperature,
            }
        }

        # Add system prompt if present
        if system:
            request_params["system"] = system

        # Add tools if provided (Converse API format)
        if tools:
            # Convert OpenAI format to Converse API format
            converse_tools = []
            for tool in tools:
                if tool.get("type") == "function":
                    func = tool.get("function", {})
                    tool_name = func.get("name")
                    params_schema = func.get("parameters", {})

                    converse_tools.append({
                        "toolSpec": {
                            "name": tool_name,
                            "description": func.get("description"),
                            "inputSchema": {
                                "json": params_schema
                            }
                        }
                    })

            request_params["toolConfig"] = {
                "tools": converse_tools
            }

            # Handle tool_choice - Converse API uses toolChoice
            if tool_choice:
                if tool_choice == "required":
                    # Force tool use - use "any" for Converse API
                    request_params["toolConfig"]["toolChoice"] = {"any": {}}
                elif tool_choice == "auto":
                    request_params["toolConfig"]["toolChoice"] = {"auto": {}}
                # Note: "none" would be {"none": {}}

            logger.info(f"[Bedrock Converse] Using tools: {[t['toolSpec']['name'] for t in converse_tools]}")
            if tool_choice:
                logger.info(f"[Bedrock Converse] Tool choice: {tool_choice}")

        # Call Converse API
        logger.info(f"[Bedrock Converse] Request - max_tokens: {request_params['inferenceConfig']['maxTokens']}, messages: {len(request_params['messages'])}, roles: {[m.get('role') for m in request_params['messages']]}")
        try:
            response = await asyncio.to_thread(
                self.client.converse,
                **request_params
            )
        except Exception as e:
            logger.error(f"[Bedrock Converse] API call failed: {e}")
            raise

        # Parse response
        output = response.get("output", {})
        message = output.get("message", {})
        content_blocks = message.get("content", [])

        # Extract text and tool calls
        text_content = ""
        tool_calls = []

        for block in content_blocks:
            if "text" in block:
                text_content += block["text"]
            elif "toolUse" in block:
                tool_use = block["toolUse"]
                tool_calls.append(
                    ToolCall(
                        id=tool_use.get("toolUseId", ""),
                        type="function",
                        function={
                            "name": tool_use.get("name", ""),
                            "arguments": json.dumps(tool_use.get("input", {}))
                        }
                    )
                )

        # Get usage stats
        usage_data = response.get("usage", {})
        usage = {
            "prompt_tokens": usage_data.get("inputTokens", 0),
            "completion_tokens": usage_data.get("outputTokens", 0),
            "total_tokens": usage_data.get("totalTokens", 0)
        }

        # Get stop reason
        stop_reason = response.get("stopReason", "end_turn")

        logger.info(f"[Bedrock Converse] Response - tokens: {usage}, stop_reason: {stop_reason}, text: {repr(text_content[:500])}, blocks: {content_blocks}")

        return LLMResponse(
            content=text_content,
            model=model_id,
            usage=usage,
            finish_reason=stop_reason,
            tool_calls=tool_calls if tool_calls else None
        )

    async def _generate_bedrock_invoke_model(
        self,
        prompt: Optional[str],
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        model_id: str,
        tools: Optional[List[Dict[str, Any]]] = None,
        messages_array: Optional[List[Dict[str, Any]]] = None
    ) -> LLMResponse:
        """Generate with AWS Bedrock InvokeModel API (fallback for non-Claude models)"""

        # Build the prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\nHuman: {prompt}\n\nAssistant:"
        else:
            full_prompt = f"Human: {prompt}\n\nAssistant:"

        # Prepare request body based on model type
        if "anthropic.claude" in model_id:
            # This shouldn't be called for Claude models (should use Converse API)
            logger.warning(f"[Bedrock] Using InvokeModel for Claude - should use Converse API instead")

            # Use provided messages array or build from prompt
            if messages_array:
                system = ""
                messages = []
                for msg in messages_array:
                    if msg.get("role") == "system":
                        system = msg.get("content", "")
                    else:
                        messages.append(msg)
            else:
                system = system_prompt or ""
                messages = [{"role": "user", "content": prompt}]

            body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": max_tokens,
                "temperature": temperature,
                "messages": messages
            }

            # Add tools if provided
            if tools:
                bedrock_tools = []
                for tool in tools:
                    if tool.get("type") == "function":
                        func = tool.get("function", {})
                        bedrock_tools.append({
                            "name": func.get("name"),
                            "description": func.get("description"),
                            "input_schema": func.get("parameters", {})
                        })
                body["tools"] = bedrock_tools
            if system:
                body["system"] = system
                
        elif "amazon.titan" in model_id:
            # Amazon Titan models
            body = {
                "inputText": full_prompt,
                "textGenerationConfig": {
                    "maxTokenCount": max_tokens,
                    "temperature": temperature,
                    "topP": 0.9,
                }
            }
        elif "ai21.j2" in model_id:
            # AI21 Jurassic models
            body = {
                "prompt": full_prompt,
                "maxTokens": max_tokens,
                "temperature": temperature,
            }
        elif "cohere.command" in model_id:
            # Cohere Command models
            body = {
                "prompt": full_prompt,
                "max_tokens": max_tokens,
                "temperature": temperature,
            }
        elif "meta.llama" in model_id:
            # Meta Llama models
            body = {
                "prompt": full_prompt,
                "max_gen_len": max_tokens,
                "temperature": temperature,
            }
        else:
            # Default format (try Anthropic format)
            body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": max_tokens,
                "temperature": temperature,
                "messages": [{"role": "user", "content": prompt}]
            }
            if system_prompt:
                body["system"] = system_prompt
        
        # Invoke model
        response = await asyncio.to_thread(
            self.client.invoke_model,
            modelId=model_id,
            body=json.dumps(body),
            contentType='application/json',
            accept='application/json'
        )
        
        # Parse response
        response_body = json.loads(response['body'].read())

        # Initialize tool_calls (only Claude models support this)
        tool_calls = None

        # Extract content based on model type
        if "anthropic.claude" in model_id:
            content = ""

            # Parse content blocks
            for block in response_body.get('content', []):
                if block.get('type') == 'text':
                    content = block.get('text', '')
                elif block.get('type') == 'tool_use':
                    if tool_calls is None:
                        tool_calls = []
                    tool_calls.append(
                        ToolCall(
                            id=block.get('id', ''),
                            type="function",
                            function={"name": block.get('name', ''), "arguments": json.dumps(block.get('input', {}))}
                        )
                    )

            usage = {
                "prompt_tokens": response_body.get('usage', {}).get('input_tokens', 0),
                "completion_tokens": response_body.get('usage', {}).get('output_tokens', 0),
                "total_tokens": response_body.get('usage', {}).get('input_tokens', 0) + response_body.get('usage', {}).get('output_tokens', 0)
            }
            finish_reason = response_body.get('stop_reason', 'complete')
        elif "amazon.titan" in model_id:
            content = response_body['results'][0]['outputText']
            usage = {
                "prompt_tokens": response_body.get('inputTextTokenCount', 0),
                "completion_tokens": response_body['results'][0].get('tokenCount', 0),
                "total_tokens": response_body.get('inputTextTokenCount', 0) + response_body['results'][0].get('tokenCount', 0)
            }
            finish_reason = response_body['results'][0].get('completionReason', 'FINISH')
        elif "ai21.j2" in model_id:
            content = response_body['completions'][0]['data']['text']
            usage = {
                "prompt_tokens": 0,  # Not provided by AI21
                "completion_tokens": 0,
                "total_tokens": 0
            }
            finish_reason = response_body['completions'][0].get('finishReason', {}).get('reason', 'complete')
        elif "cohere.command" in model_id:
            content = response_body['generations'][0]['text']
            usage = {
                "prompt_tokens": 0,  # Not provided
                "completion_tokens": 0,
                "total_tokens": 0
            }
            finish_reason = response_body['generations'][0].get('finish_reason', 'COMPLETE')
        elif "meta.llama" in model_id:
            content = response_body['generation']
            usage = {
                "prompt_tokens": response_body.get('prompt_token_count', 0),
                "completion_tokens": response_body.get('generation_token_count', 0),
                "total_tokens": response_body.get('prompt_token_count', 0) + response_body.get('generation_token_count', 0)
            }
            finish_reason = response_body.get('stop_reason', 'complete')
        else:
            # Default extraction
            content = response_body.get('content', [{}])[0].get('text', response_body.get('completion', ''))
            usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            finish_reason = 'complete'
        
        return LLMResponse(
            content=content,
            model=model_id,
            usage=usage,
            finish_reason=finish_reason,
            tool_calls=tool_calls
        )

    async def _generate_gemini(
        self,
        prompt: Optional[str],
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        model: str,
        tools: Optional[List[Dict[str, Any]]] = None,
        messages_array: Optional[List[Dict[str, Any]]] = None
    ) -> LLMResponse:
        """Generate with Google Gemini"""

        # Prepare the input
        if messages_array:
            # Convert messages to Gemini format
            conversation_parts = []
            system_instruction = ""

            for msg in messages_array:
                if msg.get("role") == "system":
                    system_instruction = msg.get("content", "")
                elif msg.get("role") == "user":
                    conversation_parts.append(f"User: {msg.get('content', '')}")
                elif msg.get("role") == "assistant":
                    conversation_parts.append(f"Assistant: {msg.get('content', '')}")

            full_prompt = "\n\n".join(conversation_parts)
            if system_instruction:
                full_prompt = f"{system_instruction}\n\n{full_prompt}"
        else:
            # Single prompt
            full_prompt = prompt or ""
            if system_prompt:
                full_prompt = f"{system_prompt}\n\n{full_prompt}"

        # Update generation config for this request
        generation_config = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }

        # Create model with updated config
        model_instance = genai.GenerativeModel(
            model_name=model,
            generation_config=generation_config,
            safety_settings={
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            }
        )

        try:
            # Generate content
            response = await asyncio.to_thread(
                model_instance.generate_content,
                full_prompt
            )

            # Extract content - handle MAX_TOKENS case properly
            content_text = ""
            finish_reason = "stop"

            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'finish_reason'):
                    finish_reason_val = candidate.finish_reason
                    finish_reason = str(finish_reason_val)

                    # Handle MAX_TOKENS case (finish_reason: 2) - connection is successful
                    if finish_reason_val == 2:  # MAX_TOKENS
                        content_text = "Connection test successful - Response truncated due to token limit."
                        logger.info(f"[Google Gemini] Connection successful, response truncated due to MAX_TOKENS")
                    else:
                        # For other finish reasons, try to get the text
                        try:
                            content_text = response.text if hasattr(response, 'text') else ""
                        except Exception as text_error:
                            content_text = f"Response received but content unavailable: {str(text_error)}"
                            logger.warning(f"[Google Gemini] Could not extract text: {text_error}")
                else:
                    # No finish_reason available, try to get text
                    try:
                        content_text = response.text if hasattr(response, 'text') else ""
                    except Exception as text_error:
                        content_text = f"Response received but content unavailable: {str(text_error)}"
                        logger.warning(f"[Google Gemini] Could not extract text: {text_error}")
            else:
                # No candidates, try direct text access
                try:
                    content_text = response.text if hasattr(response, 'text') else ""
                except Exception as text_error:
                    content_text = f"Response received but content unavailable: {str(text_error)}"
                    logger.warning(f"[Google Gemini] Could not extract text: {text_error}")

            # Extract usage information (if available)
            usage = {
                "prompt_tokens": getattr(response.usage_metadata, 'prompt_token_count', 0) if hasattr(response, 'usage_metadata') else 0,
                "completion_tokens": getattr(response.usage_metadata, 'candidates_token_count', 0) if hasattr(response, 'usage_metadata') else 0,
                "total_tokens": getattr(response.usage_metadata, 'total_token_count', 0) if hasattr(response, 'usage_metadata') else 0
            }

            logger.info(f"[Google Gemini] Response - text length: {len(content_text)}, usage: {usage}")

            return LLMResponse(
                content=content_text,
                model=model,
                usage=usage,
                finish_reason=finish_reason,
                tool_calls=None  # Tool calling support can be added later
            )

        except Exception as e:
            logger.error(f"[Google Gemini] Generation failed: {e}")
            raise
    
    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        config: Optional[Dict[str, Any]] = None
    ) -> Any:
        """
        Chat completion with optional function/tool calling support.

        Args:
            messages: List of chat messages with role and content
            tools: Optional list of tools/functions in OpenAI format
            temperature: Override default temperature
            max_tokens: Override default max tokens
            config: Optional config override (for multi-tenant scenarios)

        Returns:
            Response object with message and optional tool_calls
        """
        temp = temperature if temperature is not None else self.config.temperature
        max_tok = max_tokens if max_tokens is not None else self.config.max_tokens
        model = self.config.model

        # Use OpenAI-style API (most compatible)
        if self.provider in ["openai", "azure_openai"]:
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": temp,
                "max_tokens": max_tok
            }

            if tools:
                kwargs["tools"] = tools

            response = await self.raw_client.chat.completions.create(**kwargs)
            return response

        elif self.provider == "anthropic":
            # Anthropic has native tool calling support
            from anthropic import AsyncAnthropic

            # Convert messages format
            system_msg = None
            anthropic_messages = []
            for msg in messages:
                if msg["role"] == "system":
                    system_msg = msg["content"]
                else:
                    anthropic_messages.append(msg)

            kwargs = {
                "model": model,
                "messages": anthropic_messages,
                "temperature": temp,
                "max_tokens": max_tok
            }

            if system_msg:
                kwargs["system"] = system_msg

            if tools:
                # Convert OpenAI tool format to Anthropic format
                anthropic_tools = []
                for tool in tools:
                    anthropic_tools.append({
                        "name": tool["function"]["name"],
                        "description": tool["function"]["description"],
                        "input_schema": tool["function"]["parameters"]
                    })
                kwargs["tools"] = anthropic_tools

            response = await self.client.messages.create(**kwargs)

            # Convert Anthropic response to OpenAI-like format
            class Message:
                def __init__(self, content, tool_calls=None):
                    self.content = content
                    self.tool_calls = tool_calls or []

            class Choice:
                def __init__(self, message):
                    self.message = message

            class Response:
                def __init__(self, choices):
                    self.choices = choices

            # Extract content and tool calls
            content_text = ""
            tool_calls_list = []

            for block in response.content:
                if hasattr(block, 'text'):
                    content_text += block.text
                elif hasattr(block, 'type') and block.type == 'tool_use':
                    # Convert to OpenAI format
                    class ToolCall:
                        def __init__(self, id, type, function):
                            self.id = id
                            self.type = type
                            self.function = function

                    class Function:
                        def __init__(self, name, arguments):
                            self.name = name
                            self.arguments = arguments

                    import json
                    tool_calls_list.append(ToolCall(
                        id=block.id,
                        type="function",
                        function=Function(
                            name=block.name,
                            arguments=json.dumps(block.input)
                        )
                    ))

            message = Message(content=content_text or None, tool_calls=tool_calls_list if tool_calls_list else None)
            return Response(choices=[Choice(message)])

        else:
            # For other providers, fall back to basic completion
            # Extract last user message
            user_msg = messages[-1]["content"] if messages else ""
            system_msg = next((m["content"] for m in messages if m["role"] == "system"), None)

            response = await self.generate(
                prompt=user_msg,
                system_prompt=system_msg,
                temperature=temp,
                max_tokens=max_tok
            )

            # Convert to OpenAI-like format
            class Message:
                def __init__(self, content):
                    self.content = content
                    self.tool_calls = None

            class Choice:
                def __init__(self, message):
                    self.message = message

            class Response:
                def __init__(self, choices):
                    self.choices = choices

            return Response(choices=[Choice(Message(response.content))])

    async def generate_structured(
        self,
        prompt: str,
        response_model: Any,  # Pydantic BaseModel class or dict schema
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_retries: int = 3,
    ) -> Any:
        """
        Generate structured output with schema validation

        For OpenAI/Azure: Uses Instructor for Pydantic validation
        For Bedrock/Anthropic: Uses JSON mode with manual parsing

        Args:
            prompt: User prompt
            response_model: Pydantic BaseModel class or dict schema defining expected structure
            system_prompt: System prompt
            temperature: Override default temperature (default: 0.3 for structured outputs)
            max_retries: Number of retries on validation failure (default: 3)

        Returns:
            Instance of response_model with validated data (or dict if response_model is dict)

        Raises:
            ValueError: If response doesn't match schema after retries
        """
        import json
        import re

        temp = temperature if temperature is not None else 0.3  # Lower temp for structured outputs

        # For OpenAI/Azure with Pydantic models, use Instructor
        if self.provider in ["openai", "azure_openai"] and not isinstance(response_model, dict):
            if instructor is None:
                raise ImportError("instructor package is required. Install with: pip install instructor")

            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            try:
                response = await self.client.chat.completions.create(
                    model=self.config.model,
                    response_model=response_model,
                    messages=messages,
                    temperature=temp,
                    max_tokens=self.config.max_tokens,
                    max_retries=max_retries,
                )
                logger.debug(f"[LLMService] Structured generation successful (Instructor)")
                return response
            except Exception as e:
                logger.error(f"[LLMService] Instructor generation failed: {e}")
                raise ValueError(f"LLM did not return valid structured response: {e}")

        # For Bedrock/Anthropic or dict schemas, use JSON mode with manual parsing
        else:
            # Build enhanced prompt requesting JSON output
            json_prompt = prompt + "\n\nIMPORTANT: Return your response as valid JSON only, with no additional text or markdown formatting."

            if isinstance(response_model, dict):
                json_prompt += f"\n\nExpected JSON structure:\n```json\n{json.dumps(response_model, indent=2)}\n```"

            try:
                # Use regular generate method
                response = await self.generate(
                    prompt=json_prompt,
                    system_prompt=system_prompt,
                    temperature=temp,
                )

                # Extract JSON from response
                content = response.content.strip()

                # Try to extract JSON from markdown code blocks if present
                json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', content, re.DOTALL)
                if json_match:
                    content = json_match.group(1).strip()

                # Parse JSON
                try:
                    result = json.loads(content)
                    logger.debug(f"[LLMService] Structured generation successful (JSON parsing)")
                    return result
                except json.JSONDecodeError as e:
                    logger.error(f"[LLMService] JSON parsing failed: {e}\nContent: {content[:500]}")
                    raise ValueError(f"LLM did not return valid JSON: {e}")

            except Exception as e:
                logger.error(f"[LLMService] Structured generation failed: {e}")
                raise ValueError(f"Structured generation failed: {e}")


async def get_llm_service_for_tenant(
    tenant_id: int,
    db
) -> LLMService:
    """
    Get LLM service configured for a specific tenant.

    Args:
        tenant_id: Tenant ID
        db: Database session

    Returns:
        Configured LLMService instance

    Raises:
        ValueError: If tenant has no LLM configuration
    """
    from sqlalchemy import select
    from app.models.tenant import Tenant
    from app.core.security import decrypt_llm_config

    # Fetch tenant configuration
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise ValueError(f"Tenant {tenant_id} not found")

    # Get tenant's LLM config and decrypt sensitive fields
    tenant_config = tenant.llm_config if tenant else None
    if tenant_config:
        tenant_config = decrypt_llm_config(tenant_config)

    return get_llm_service(tenant_config=tenant_config)


def get_llm_service(
    tenant_config: Optional[Dict[str, Any]] = None,
    user_config: Optional[Dict[str, Any]] = None
) -> LLMService:
    """
    Factory function to get LLM service based on tenant/user configuration
    Strict BYOK (Bring Your Own Keys) - no environment variable fallbacks

    Args:
        tenant_config: Tenant LLM configuration (required)
        user_config: User LLM configuration (overrides tenant)

    Returns:
        Configured LLMService instance

    Raises:
        ValueError: If no tenant or user config is provided
    """
    # Priority: user config > tenant config (NO env var fallback)
    config_source = user_config or tenant_config

    # Require explicit configuration - no fallbacks
    if not config_source:
        raise ValueError(
            "LLM credentials not configured. Please configure your LLM provider credentials "
            "in Settings → LLM Settings to use AI-powered features."
        )

    # Validate required fields
    provider = config_source.get("provider")
    if not provider:
        raise ValueError(
            "LLM provider not configured. Please specify a provider (openai, anthropic, azure_openai, or aws_bedrock) "
            "in Settings → LLM Settings."
        )

    # Get model - AWS Bedrock uses 'model_id', others use 'model'
    model = config_source.get("model") or config_source.get("model_id")
    if not model:
        raise ValueError(
            f"LLM model not configured for provider '{provider}'. "
            "Please specify a model in Settings → LLM Settings."
        )

    # Validate provider-specific credentials
    if provider == "aws_bedrock":
        api_key = None  # AWS uses credentials, not API key
        # Support both old and new field names for backward compatibility
        aws_access_key = config_source.get("aws_access_key_id") or config_source.get("access_key_id")
        aws_secret_key = config_source.get("aws_secret_access_key") or config_source.get("secret_access_key")
        aws_region = config_source.get("aws_region") or config_source.get("region")
        aws_auth_method = config_source.get("aws_auth_method", "credentials")

        # Check for API key method (simpler authentication)
        if aws_auth_method == "api_key":
            api_key = config_source.get("api_key")
            if not api_key:
                raise ValueError(
                    "AWS Bedrock API key not configured. Please provide api_key in Settings → LLM Settings."
                )
        else:
            # IAM credentials method
            if not aws_access_key or not aws_secret_key:
                raise ValueError(
                    "AWS credentials not configured. Please provide access_key_id and secret_access_key "
                    "in Settings → LLM Settings to use AWS Bedrock."
                )

        if not aws_region:
            raise ValueError(
                "AWS region not configured. Please specify region in Settings → LLM Settings."
            )
    elif provider == "azure_openai":
        api_key = config_source.get("api_key")
        azure_endpoint = config_source.get("azure_endpoint")
        azure_deployment = config_source.get("azure_deployment")

        if not api_key:
            raise ValueError(
                "Azure OpenAI API key not configured. Please provide api_key in Settings → LLM Settings."
            )
        if not azure_endpoint or not azure_deployment:
            raise ValueError(
                "Azure OpenAI configuration incomplete. Please provide azure_endpoint and azure_deployment "
                "in Settings → LLM Settings."
            )
    elif provider == "google_gemini":
        api_key = config_source.get("api_key")
        if not api_key:
            raise ValueError(
                "Google AI Studio API key not configured. Please provide api_key in Settings → LLM Settings."
            )
    else:
        # OpenAI or Anthropic
        api_key = config_source.get("api_key")
        if not api_key:
            raise ValueError(
                f"{provider.title()} API key not configured. Please provide api_key in Settings → LLM Settings."
            )

    # For AWS Bedrock, use the variables we already extracted (supports both old and new field names)
    if provider == "aws_bedrock":
        config = LLMConfig(
            provider=provider,
            api_key=api_key,
            model=model,
            temperature=config_source.get("temperature", 0.7),
            max_tokens=config_source.get("max_tokens", 2000),
            aws_region=aws_region,
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            aws_session_token=config_source.get("aws_session_token"),
        )
    elif provider == "google_gemini":
        config = LLMConfig(
            provider=provider,
            api_key=api_key,
            model=model,
            temperature=config_source.get("temperature", 0.7),
            max_tokens=config_source.get("max_tokens", 2000),
        )
        # Add Gemini-specific parameters
        if hasattr(config, '__dict__'):
            config.__dict__.update({
                'top_p': config_source.get("top_p", 0.95),
                'top_k': config_source.get("top_k", 40),
            })
    else:
        config = LLMConfig(
            provider=provider,
            api_key=api_key,
            model=model,
            temperature=config_source.get("temperature", 0.7),
            max_tokens=config_source.get("max_tokens", 2000),
            # Azure-specific
            azure_endpoint=config_source.get("azure_endpoint"),
            azure_deployment=config_source.get("azure_deployment"),
        )

    return LLMService(config, enable_cache=settings.LLM_CACHE_ENABLED)


# Example usage and prompts for common tasks

THEME_LABELING_SYSTEM_PROMPT = """You are an expert product manager analyzing customer feedback.
Your task is to create clear, concise theme labels that capture the essence of grouped feedback.
Labels should be:
- 3-7 words maximum
- Specific and actionable
- Customer-centric (focus on their problems, not solutions)
- Free of jargon

Always cite specific feedback items that support your labels."""

THEME_SUMMARY_SYSTEM_PROMPT = """You are an expert product manager synthesizing customer feedback.
Your task is to create concise summaries of feedback themes that:
- Highlight the core customer problem
- Mention key use cases or scenarios
- Note any segment-specific patterns
- Are 2-3 sentences maximum

Always maintain transparency by referencing specific feedback items."""

DECISION_OPTIONS_SYSTEM_PROMPT_PM = """You are a strategic product advisor helping a PM make a roadmap decision for an existing product.
Your task is to generate 2-4 distinct strategic options that:
- Address the stated objective
- Have clear tradeoffs between different customer segments
- Leverage existing customer themes and feedback data
- Are realistic given team constraints and time horizon
- Focus on feature prioritization and product direction

For each option, provide:
- Clear title (3-5 words)
- Description (2-3 sentences focusing on product features/initiatives)
- Pros (3-5 bullet points with ARR/customer impact)
- Cons (3-5 bullet points with risks/tradeoffs)
- Expected ARR impact (quantified)
- Risk level (low/medium/high)

Always cite supporting evidence from themes, feedback, and metrics."""

DECISION_OPTIONS_SYSTEM_PROMPT_FOUNDER = """You are a strategic advisor helping a founder make critical startup decisions.
Your task is to generate 2-4 distinct strategic options that:
- Address the stated decision objective
- Have clear strategic tradeoffs
- Consider market dynamics, competition, and customer validation
- Are realistic given startup stage and resources
- Could include product direction, market positioning, GTM strategy, or pivot decisions

For each option, provide:
- Clear title (3-5 words)
- Description (2-3 sentences explaining the strategic direction)
- Pros (3-5 bullet points with market validation, competitive advantages)
- Cons (3-5 bullet points with execution risks, resource requirements)
- Expected business impact (ARR potential or market validation)
- Risk level (low/medium/high)

Ground recommendations in real market data and customer signals."""

# Legacy prompt for backward compatibility
DECISION_OPTIONS_SYSTEM_PROMPT = DECISION_OPTIONS_SYSTEM_PROMPT_PM

PERSONA_GENERATION_SYSTEM_PROMPT = """You are an expert user researcher creating data-driven customer personas.
Your task is to synthesize customer data into realistic persona profiles that:
- Are grounded in real customer feedback and behavior
- Capture key pain points and motivations
- Include buying triggers and decision criteria
- Are useful for product and GTM decisions

Each persona should include:
- Name and role
- Company size and segment
- Key pain points (3-5)
- Goals and motivations
- Buying triggers
- Decision criteria
- Budget authority
- Typical decision timeline

Always base personas on actual customer data and cite sources."""
