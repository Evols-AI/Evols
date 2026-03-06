"""
LLM Service
Unified interface for multiple LLM providers (OpenAI, Anthropic, Azure, AWS Bedrock)
"""

import os
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel
import asyncio
from loguru import logger

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
except ImportError:
    boto3 = None


class LLMConfig(BaseModel):
    """LLM Configuration"""
    provider: Literal["openai", "anthropic", "azure_openai", "aws_bedrock"]
    api_key: Optional[str] = None
    model: str = "gpt-4"
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
    # AWS Bedrock - Anthropic Claude models
    "anthropic.claude-opus-4-20250514-v1:0": "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "anthropic.claude-3-5-sonnet-20241022-v2:0": "anthropic.claude-3-5-haiku-20241022-v1:0",
    "anthropic.claude-3-sonnet-20240229-v1:0": "anthropic.claude-3-haiku-20240307-v1:0",

    # Anthropic API - Claude models
    "claude-opus-4-20250514": "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-20241022": "claude-3-5-haiku-20241022",
    "claude-3-sonnet-20240229": "claude-3-haiku-20240307",

    # OpenAI - GPT models
    "gpt-4": "gpt-3.5-turbo",
    "gpt-4-turbo": "gpt-3.5-turbo",
    "gpt-4-turbo-preview": "gpt-3.5-turbo",
    "gpt-4o": "gpt-4o-mini",
    "gpt-4o-2024-11-20": "gpt-4o-mini",

    # Add more mappings as needed
}


class LLMResponse(BaseModel):
    """Standardized LLM response"""
    content: str
    model: str
    usage: Dict[str, int]
    finish_reason: str


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
            self.client = session.client('bedrock-runtime')

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
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        use_cheaper_model: bool = False,
        skip_cache: bool = False,
    ) -> LLMResponse:
        """
        Generate text from prompt

        Args:
            prompt: User prompt
            system_prompt: System/instruction prompt
            temperature: Override default temperature
            max_tokens: Override default max_tokens
            use_cheaper_model: If True, use cheaper model tier for simple tasks (cost optimization)
            skip_cache: If True, bypass cache and force fresh generation

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

        # Check cache first (unless skipping)
        if not skip_cache and self.cache:
            cached_response = await self.cache.get(
                prompt, system_prompt, temp, max_tok, model_to_use
            )
            if cached_response:
                return LLMResponse(**cached_response)

        # Generate fresh response
        try:
            if self.provider in ["openai", "azure_openai"]:
                response = await self._generate_openai(prompt, system_prompt, temp, max_tok, model_to_use)
            elif self.provider == "anthropic":
                response = await self._generate_anthropic(prompt, system_prompt, temp, max_tok, model_to_use)
            elif self.provider == "aws_bedrock":
                response = await self._generate_bedrock(prompt, system_prompt, temp, max_tok, model_to_use)
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
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        model: str
    ) -> LLMResponse:
        """Generate with OpenAI (native async)"""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        # Use raw_client for normal generation (instructor-patched client is for structured outputs)
        response = await self.raw_client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        return LLMResponse(
            content=response.choices[0].message.content,
            model=response.model,
            usage={
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            },
            finish_reason=response.choices[0].finish_reason
        )
    
    async def _generate_anthropic(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        model: str
    ) -> LLMResponse:
        """Generate with Anthropic (native async)"""
        system = system_prompt or ""

        # Native async - no thread blocking
        response = await self.client.messages.create(
            model=model,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
        )

        return LLMResponse(
            content=response.content[0].text,
            model=response.model,
            usage={
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens
            },
            finish_reason=response.stop_reason
        )
    
    async def _generate_bedrock(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        model: str
    ) -> LLMResponse:
        """Generate with AWS Bedrock"""
        import json

        # Format request based on model family
        model_id = model
        
        # Build the prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\nHuman: {prompt}\n\nAssistant:"
        else:
            full_prompt = f"Human: {prompt}\n\nAssistant:"
        
        # Prepare request body based on model type
        if "anthropic.claude" in model_id:
            # Anthropic Claude models on Bedrock
            body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": max_tokens,
                "temperature": temperature,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            }
            if system_prompt:
                body["system"] = system_prompt
                
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
        
        # Extract content based on model type
        if "anthropic.claude" in model_id:
            content = response_body['content'][0]['text']
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
            finish_reason=finish_reason
        )
    
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

    # Fetch tenant configuration
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise ValueError(f"Tenant {tenant_id} not found")

    # Get tenant's LLM config
    tenant_config = tenant.llm_config if tenant else None

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

    model = config_source.get("model")
    if not model:
        raise ValueError(
            f"LLM model not configured for provider '{provider}'. "
            "Please specify a model in Settings → LLM Settings."
        )

    # Validate provider-specific credentials
    if provider == "aws_bedrock":
        api_key = None  # AWS uses credentials, not API key
        aws_access_key = config_source.get("aws_access_key_id")
        aws_secret_key = config_source.get("aws_secret_access_key")
        aws_region = config_source.get("aws_region")

        if not aws_access_key or not aws_secret_key:
            raise ValueError(
                "AWS credentials not configured. Please provide aws_access_key_id and aws_secret_access_key "
                "in Settings → LLM Settings to use AWS Bedrock."
            )
        if not aws_region:
            raise ValueError(
                "AWS region not configured. Please specify aws_region in Settings → LLM Settings."
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
    else:
        # OpenAI or Anthropic
        api_key = config_source.get("api_key")
        if not api_key:
            raise ValueError(
                f"{provider.title()} API key not configured. Please provide api_key in Settings → LLM Settings."
            )

    config = LLMConfig(
        provider=provider,
        api_key=api_key,
        model=model,
        temperature=config_source.get("temperature", 0.7),
        max_tokens=config_source.get("max_tokens", 2000),
        # Azure-specific
        azure_endpoint=config_source.get("azure_endpoint"),
        azure_deployment=config_source.get("azure_deployment"),
        # AWS Bedrock-specific (no env fallbacks)
        aws_region=config_source.get("aws_region"),
        aws_access_key_id=config_source.get("aws_access_key_id"),
        aws_secret_access_key=config_source.get("aws_secret_access_key"),
        aws_session_token=config_source.get("aws_session_token"),
    )

    return LLMService(config)


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
