"""
LLM Service
Unified interface for multiple LLM providers via litellm.
litellm translates all provider wire formats so we don't have to.
"""

import json
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel
from loguru import logger

import litellm
from litellm import acompletion

from app.core.config import settings

try:
    from app.services.llm_cache_service import LLMCacheService
    CACHE_AVAILABLE = True
except ImportError:
    CACHE_AVAILABLE = False
    logger.warning("[LLMService] LLMCacheService not available")

try:
    from openai import AsyncOpenAI
    import instructor
except ImportError:
    AsyncOpenAI = None
    instructor = None

# Suppress litellm's verbose success logging
litellm.suppress_debug_info = True

# Register short Bedrock model aliases so callers don't need to know
# the full cross-region inference profile IDs.
litellm.register_model({
    "claude-sonnet-4-6":          {"max_tokens": 8096, "max_input_tokens": 200000, "litellm_provider": "bedrock", "mode": "chat"},
    "claude-opus-4-7":            {"max_tokens": 8096, "max_input_tokens": 200000, "litellm_provider": "bedrock", "mode": "chat"},
    "claude-haiku-4-5":           {"max_tokens": 8096, "max_input_tokens": 200000, "litellm_provider": "bedrock", "mode": "chat"},
})

_BEDROCK_SHORT_TO_FULL: Dict[str, str] = {
    "claude-haiku-4-5-20251001":  "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    "claude-haiku-4-5":           "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    "claude-sonnet-4-6":          "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "claude-sonnet-4-6-20250514": "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "claude-sonnet-4":            "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "claude-opus-4-7":            "us.anthropic.claude-opus-4-1-20250805-v1:0",
    "claude-opus-4":              "us.anthropic.claude-opus-4-1-20250805-v1:0",
}


def normalize_bedrock_model(model: str) -> str:
    """Expand short Claude names to full Bedrock cross-region inference profile IDs."""
    if model in _BEDROCK_SHORT_TO_FULL:
        return _BEDROCK_SHORT_TO_FULL[model]
    if "." in model or "/" in model:
        return model
    return "us.anthropic.claude-sonnet-4-20250514-v1:0"


class LLMConfig(BaseModel):
    """LLM Configuration"""
    provider: Literal[
        "openai", "anthropic", "azure_openai", "aws_bedrock", "google_gemini",
        "groq", "mistral", "cohere", "together_ai", "ollama",
        "deepseek", "xai", "openrouter",
    ]
    api_key: Optional[str] = None
    model: str = "gpt-5.4"
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

    # Ollama-specific
    ollama_base_url: Optional[str] = None


# Model tier mapping for cost optimisation — used by get_cheaper_model()
MODEL_TIERS = {
    "gpt-5.4": "gpt-5.2",
    "gpt-5.2": "gpt-4o",
    "gpt-4o": "gpt-4o-mini",
    "gpt-4": "gpt-4o-mini",
    "gpt-4-turbo": "gpt-4o-mini",
    "gpt-4-turbo-preview": "gpt-4o-mini",
    "gpt-4o-2024-11-20": "gpt-4o-mini",

    "claude-opus-4-6": "claude-sonnet-4-6",
    "claude-sonnet-4-6": "claude-haiku-4-5-20251001",
    "claude-opus-4-20250514": "claude-sonnet-4-6",
    "claude-3-5-sonnet-20241022": "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229": "claude-3-5-sonnet-20241022",

    "global.anthropic.claude-sonnet-4-6": "anthropic.claude-sonnet-4-5-20250929-v1:0",
    "global.anthropic.claude-opus-4-6-v1": "global.anthropic.claude-sonnet-4-6",
    "us.anthropic.claude-sonnet-4-6": "anthropic.claude-sonnet-4-5-20250929-v1:0",
    "us.anthropic.claude-opus-4-6-v1": "us.anthropic.claude-sonnet-4-6",
    "eu.anthropic.claude-sonnet-4-6": "anthropic.claude-sonnet-4-5-20250929-v1:0",
    "eu.anthropic.claude-opus-4-6-v1": "eu.anthropic.claude-sonnet-4-6",
    "au.anthropic.claude-sonnet-4-6": "anthropic.claude-sonnet-4-5-20250929-v1:0",
    "au.anthropic.claude-opus-4-6-v1": "au.anthropic.claude-sonnet-4-6",
    "anthropic.claude-sonnet-4-5-20250929-v1:0": "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "anthropic.claude-3-5-sonnet-20241022-v2:0": "anthropic.claude-3-5-haiku-20241022-v1:0",
    "anthropic.claude-3-opus-20240229-v1:0": "anthropic.claude-3-sonnet-20240229-v1:0",
    "anthropic.claude-3-sonnet-20240229-v1:0": "anthropic.claude-3-haiku-20240307-v1:0",

    "gemini-2.5-flash": "gemini-2.5-flash-lite",
    "gemini-3.1-pro-preview": "gemini-2.5-flash",
    "gemini-3.1-flash-lite-preview": "gemini-2.5-flash-lite",
    "gemini-1.5-pro": "gemini-1.5-flash",
    "gemini-1.5-flash": "gemini-1.5-flash-8b",
}


class ToolCall(BaseModel):
    """Function/tool call from LLM"""
    id: str
    type: str = "function"
    function: Dict[str, str]  # {"name": "tool_name", "arguments": "json_string"}


class LLMResponse(BaseModel):
    """Standardised LLM response"""
    content: str
    model: str
    usage: Dict[str, int]
    finish_reason: str
    tool_calls: Optional[List[ToolCall]] = None


def _litellm_model(config: LLMConfig) -> str:
    """
    Convert internal provider/model to the litellm model string.
    litellm uses prefixes: "bedrock/", "gemini/", "azure/", etc.
    OpenAI and Anthropic model names are passed through as-is.
    """
    p = config.provider
    m = config.model

    if p == "aws_bedrock":
        return f"bedrock/{m}"
    if p == "google_gemini":
        return f"gemini/{m}"
    if p == "azure_openai":
        # litellm wants "azure/<deployment_name>"
        return f"azure/{config.azure_deployment or m}"
    if p == "groq":
        return f"groq/{m}"
    if p == "mistral":
        return f"mistral/{m}"
    if p == "cohere":
        return f"cohere/{m}"
    if p == "together_ai":
        return f"together_ai/{m}"
    if p == "ollama":
        return f"ollama/{m}"
    # deepseek, xai, openrouter — model strings already carry their prefix
    # (e.g. "deepseek/deepseek-v3.2", "xai/grok-4", "openrouter/deepseek/deepseek-r1")
    if p in ("deepseek", "xai", "openrouter"):
        return m
    # openai / anthropic — pass model name directly
    return m


def _litellm_kwargs(config: LLMConfig) -> Dict[str, Any]:
    """Build the extra kwargs litellm needs per provider (credentials, endpoints)."""
    p = config.provider
    kwargs: Dict[str, Any] = {}

    if p == "aws_bedrock":
        if config.aws_access_key_id:
            kwargs["aws_access_key_id"] = config.aws_access_key_id
        if config.aws_secret_access_key:
            kwargs["aws_secret_access_key"] = config.aws_secret_access_key
        if config.aws_session_token:
            kwargs["aws_session_token"] = config.aws_session_token
        kwargs["aws_region_name"] = config.aws_region or "us-east-1"
    elif p == "azure_openai":
        kwargs["api_key"] = config.api_key
        kwargs["api_base"] = config.azure_endpoint
        kwargs["api_version"] = "2024-02-15-preview"
    elif p == "ollama":
        kwargs["api_base"] = config.ollama_base_url or "http://localhost:11434"
    else:
        kwargs["api_key"] = config.api_key

    return kwargs


def _parse_litellm_response(response: Any, model_name: str) -> LLMResponse:
    """Convert a litellm ModelResponse to our internal LLMResponse."""
    message = response.choices[0].message
    finish_reason = response.choices[0].finish_reason or "stop"

    tool_calls = None
    if getattr(message, "tool_calls", None):
        tool_calls = [
            ToolCall(
                id=tc.id,
                type=tc.type,
                function={"name": tc.function.name, "arguments": tc.function.arguments},
            )
            for tc in message.tool_calls
        ]

    usage = {}
    if response.usage:
        usage = {
            "prompt_tokens": response.usage.prompt_tokens or 0,
            "completion_tokens": response.usage.completion_tokens or 0,
            "total_tokens": response.usage.total_tokens or 0,
        }

    return LLMResponse(
        content=message.content or "",
        model=response.model or model_name,
        usage=usage,
        finish_reason=finish_reason,
        tool_calls=tool_calls,
    )


class LLMService:
    """Unified LLM service — delegates all provider calls to litellm."""

    def __init__(self, config: LLMConfig, enable_cache: bool = True):
        self.config = config
        self.provider = config.provider

        if CACHE_AVAILABLE and enable_cache:
            try:
                self.cache = LLMCacheService()
            except Exception as e:
                logger.warning(f"[LLMService] Failed to initialise cache: {e}")
                self.cache = None
        else:
            self.cache = None

        # Keep an instructor-patched OpenAI client only for generate_structured
        # on OpenAI/Azure, where Instructor's Pydantic validation is valuable.
        self._instructor_client = None
        if config.provider in ("openai", "azure_openai") and AsyncOpenAI and instructor:
            try:
                if config.provider == "azure_openai":
                    base = AsyncOpenAI(
                        api_key=config.api_key,
                        azure_endpoint=config.azure_endpoint,
                        azure_deployment=config.azure_deployment,
                        api_version="2024-02-15-preview",
                    )
                else:
                    base = AsyncOpenAI(api_key=config.api_key)
                self._instructor_client = instructor.from_openai(base)
            except Exception as e:
                logger.warning(f"[LLMService] Could not init instructor client: {e}")

    def get_cheaper_model(self) -> Optional[str]:
        cheaper = MODEL_TIERS.get(self.config.model)
        if cheaper:
            logger.info(f"[LLMService] Cost optimisation: {self.config.model} → {cheaper}")
        return cheaper

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
        temp = temperature if temperature is not None else self.config.temperature
        max_tok = max_tokens if max_tokens is not None else self.config.max_tokens

        model_to_use = self.config.model
        if use_cheaper_model:
            cheaper = self.get_cheaper_model()
            if cheaper:
                model_to_use = cheaper

        if tools:
            logger.info(f"[LLMService] Tool calling: {[t.get('function', {}).get('name') for t in tools]}")

        if not skip_cache and not tools and not messages and self.cache:
            cached = await self.cache.get(prompt, system_prompt, temp, max_tok, model_to_use)
            if cached:
                return LLMResponse(**cached)

        # Build messages list
        if messages:
            msg_list = messages
        else:
            msg_list = []
            if system_prompt:
                msg_list.append({"role": "system", "content": system_prompt})
            msg_list.append({"role": "user", "content": prompt})

        litellm_model = _litellm_model(LLMConfig(**{**self.config.model_dump(), "model": model_to_use}))
        kwargs = _litellm_kwargs(self.config)
        kwargs.update({"temperature": temp, "max_tokens": max_tok})

        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = tool_choice or "auto"

        try:
            response = await acompletion(model=litellm_model, messages=msg_list, **kwargs)
        except Exception as e:
            logger.error(f"[LLMService] Generation error ({litellm_model}): {e}")
            raise

        result = _parse_litellm_response(response, litellm_model)

        if self.cache and not tools and not messages:
            await self.cache.set(prompt, system_prompt, temp, max_tok, model_to_use, result.model_dump())

        return result

    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        config: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """
        OpenAI-compatible chat completion.
        Returns an object with .choices[0].message.content and .choices[0].message.tool_calls
        so all existing callers work without changes.
        """
        return await self.generate(
            messages=messages,
            tools=tools,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    async def generate_structured(
        self,
        prompt: str,
        response_model: Any,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_retries: int = 3,
    ) -> Any:
        """
        Structured output with schema validation.
        Uses Instructor for OpenAI/Azure (Pydantic models), JSON parsing for all others.
        """
        import re

        temp = temperature if temperature is not None else 0.3

        if self.provider in ("openai", "azure_openai") and self._instructor_client and not isinstance(response_model, dict):
            msgs = []
            if system_prompt:
                msgs.append({"role": "system", "content": system_prompt})
            msgs.append({"role": "user", "content": prompt})
            try:
                return await self._instructor_client.chat.completions.create(
                    model=self.config.model,
                    response_model=response_model,
                    messages=msgs,
                    temperature=temp,
                    max_tokens=self.config.max_tokens,
                    max_retries=max_retries,
                )
            except Exception as e:
                raise ValueError(f"LLM did not return valid structured response: {e}")

        # JSON-mode fallback for all other providers
        json_prompt = prompt + "\n\nIMPORTANT: Return your response as valid JSON only, with no additional text or markdown."
        if isinstance(response_model, dict):
            json_prompt += f"\n\nExpected JSON structure:\n```json\n{json.dumps(response_model, indent=2)}\n```"

        response = await self.generate(prompt=json_prompt, system_prompt=system_prompt, temperature=temp)
        content = response.content.strip()

        json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', content, re.DOTALL)
        if json_match:
            content = json_match.group(1).strip()

        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            raise ValueError(f"LLM did not return valid JSON: {e}")


async def get_llm_service_for_tenant(tenant_id: int, db) -> LLMService:
    from sqlalchemy import select
    from app.models.tenant import Tenant
    from app.core.security import decrypt_llm_config

    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise ValueError(f"Tenant {tenant_id} not found")

    tenant_config = decrypt_llm_config(tenant.llm_config) if tenant.llm_config else None
    return get_llm_service(tenant_config=tenant_config)


def get_llm_service(
    tenant_config: Optional[Dict[str, Any]] = None,
    user_config: Optional[Dict[str, Any]] = None,
) -> LLMService:
    """
    Factory — builds LLMService from tenant/user BYOK config stored in Postgres.
    Strict BYOK: raises if no config provided.
    """
    config_source = user_config or tenant_config

    if not config_source:
        raise ValueError(
            "LLM credentials not configured. Please configure your LLM provider in Settings → LLM Settings."
        )

    provider = config_source.get("provider")
    if not provider:
        raise ValueError("LLM provider not configured. Please set a provider in Settings → LLM Settings.")

    model = config_source.get("model") or config_source.get("model_id")
    if not model:
        raise ValueError(f"LLM model not configured for provider '{provider}'. Set a model in Settings → LLM Settings.")

    # Provider-specific credential validation
    if provider == "aws_bedrock":
        aws_auth_method = config_source.get("aws_auth_method", "credentials")
        aws_access_key = config_source.get("aws_access_key_id") or config_source.get("access_key_id")
        aws_secret_key = config_source.get("aws_secret_access_key") or config_source.get("secret_access_key")
        aws_region = config_source.get("aws_region") or config_source.get("region")
        if aws_auth_method == "api_key":
            if not config_source.get("api_key"):
                raise ValueError("AWS Bedrock API key not configured. Provide api_key in Settings → LLM Settings.")
        else:
            if not aws_access_key or not aws_secret_key:
                raise ValueError("AWS credentials not configured. Provide access_key_id and secret_access_key in Settings → LLM Settings.")
        if not aws_region:
            raise ValueError("AWS region not configured. Set region in Settings → LLM Settings.")

        return LLMService(LLMConfig(
            provider=provider,
            model=model,
            temperature=config_source.get("temperature", 0.7),
            max_tokens=config_source.get("max_tokens", 2000),
            aws_region=aws_region,
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            aws_session_token=config_source.get("aws_session_token"),
        ), enable_cache=settings.LLM_CACHE_ENABLED)

    elif provider == "azure_openai":
        if not config_source.get("api_key"):
            raise ValueError("Azure OpenAI API key not configured. Set api_key in Settings → LLM Settings.")
        if not config_source.get("azure_endpoint") or not config_source.get("azure_deployment"):
            raise ValueError("Azure OpenAI configuration incomplete. Set azure_endpoint and azure_deployment in Settings → LLM Settings.")
        return LLMService(LLMConfig(
            provider=provider,
            api_key=config_source.get("api_key"),
            model=model,
            temperature=config_source.get("temperature", 0.7),
            max_tokens=config_source.get("max_tokens", 2000),
            azure_endpoint=config_source.get("azure_endpoint"),
            azure_deployment=config_source.get("azure_deployment"),
        ), enable_cache=settings.LLM_CACHE_ENABLED)

    elif provider == "ollama":
        return LLMService(LLMConfig(
            provider=provider,
            model=model,
            temperature=config_source.get("temperature", 0.7),
            max_tokens=config_source.get("max_tokens", 2000),
            ollama_base_url=config_source.get("ollama_base_url"),
        ), enable_cache=settings.LLM_CACHE_ENABLED)

    else:
        # openai, anthropic, google_gemini, groq, mistral, cohere, together_ai, deepseek, xai, openrouter
        api_key = config_source.get("api_key")
        if not api_key:
            raise ValueError(f"{provider} API key not configured. Set api_key in Settings → LLM Settings.")
        return LLMService(LLMConfig(
            provider=provider,
            api_key=api_key,
            model=model,
            temperature=config_source.get("temperature", 0.7),
            max_tokens=config_source.get("max_tokens", 2000),
        ), enable_cache=settings.LLM_CACHE_ENABLED)


# ── System prompts (unchanged) ────────────────────────────────────────────────

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
