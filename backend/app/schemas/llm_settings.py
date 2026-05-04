"""
LLM Settings Schemas
Pydantic schemas for tenant-specific LLM configuration (BYOK - Bring Your Own Keys)
"""

from typing import Optional, Literal, Union
from pydantic import BaseModel, Field
from datetime import datetime


# ============================================================================
# Provider-Specific Configuration Schemas
# ============================================================================

class OpenAIConfig(BaseModel):
    provider: Literal["openai"] = "openai"
    api_key: str = Field(..., min_length=1, description="OpenAI API key (sk-...)")
    model: str = Field(default="gpt-5.4", description="Model to use for generation")
    embedding_model: str = Field(
        default="text-embedding-3-large",
        description="Embedding model for vector search"
    )


class AnthropicConfig(BaseModel):
    provider: Literal["anthropic"] = "anthropic"
    api_key: str = Field(..., min_length=1, description="Anthropic API key")
    model: str = Field(default="claude-sonnet-4-6", description="Claude model version")


class AzureOpenAIConfig(BaseModel):
    provider: Literal["azure_openai"] = "azure_openai"
    api_key: str = Field(..., min_length=1, description="Azure OpenAI API key")
    endpoint: str = Field(..., description="Azure OpenAI endpoint URL")
    deployment_name: str = Field(..., description="Deployment name")
    api_version: str = Field(default="2024-02-01", description="Azure OpenAI API version")
    embedding_deployment: Optional[str] = Field(None, description="Embedding deployment name")


class AWSBedrockConfig(BaseModel):
    provider: Literal["aws_bedrock"] = "aws_bedrock"
    aws_auth_method: Literal["api_key", "credentials"] = Field(
        default="api_key",
        description="Authentication method: api_key or credentials (IAM)"
    )
    api_key: Optional[str] = Field(None, description="AWS Bedrock API key (api_key method)")
    access_key_id: Optional[str] = Field(None, description="AWS Access Key ID (credentials method)")
    secret_access_key: Optional[str] = Field(None, description="AWS Secret Access Key (credentials method)")
    region: str = Field(default="us-east-1", description="AWS region")
    model_id: str = Field(
        default="global.anthropic.claude-sonnet-4-6",
        description="Bedrock model ID or inference profile"
    )

    def model_post_init(self, __context):
        if self.aws_auth_method == "api_key":
            if not self.api_key:
                raise ValueError("api_key is required when aws_auth_method is 'api_key'")
        elif self.aws_auth_method == "credentials":
            if not self.access_key_id or not self.secret_access_key:
                raise ValueError("access_key_id and secret_access_key are required when aws_auth_method is 'credentials'")


class GoogleGeminiConfig(BaseModel):
    provider: Literal["google_gemini"] = "google_gemini"
    api_key: str = Field(..., min_length=1, description="Google AI Studio API key")
    model: str = Field(default="gemini-2.5-flash", description="Gemini model")
    temperature: Optional[float] = Field(default=0.7)
    top_p: Optional[float] = Field(default=0.95)
    top_k: Optional[int] = Field(default=40)


class GroqConfig(BaseModel):
    provider: Literal["groq"] = "groq"
    api_key: str = Field(..., min_length=1, description="Groq API key")
    model: str = Field(default="llama-3.3-70b-versatile", description="Groq model")


class MistralConfig(BaseModel):
    provider: Literal["mistral"] = "mistral"
    api_key: str = Field(..., min_length=1, description="Mistral API key")
    model: str = Field(default="mistral-large-latest", description="Mistral model")


class CohereConfig(BaseModel):
    provider: Literal["cohere"] = "cohere"
    api_key: str = Field(..., min_length=1, description="Cohere API key")
    model: str = Field(default="command-r-plus", description="Cohere model")


class TogetherAIConfig(BaseModel):
    provider: Literal["together_ai"] = "together_ai"
    api_key: str = Field(..., min_length=1, description="Together AI API key")
    model: str = Field(default="meta-llama/Llama-3-70b-chat-hf", description="Together AI model")


class OllamaConfig(BaseModel):
    provider: Literal["ollama"] = "ollama"
    model: str = Field(default="llama3.2", description="Ollama model name")
    ollama_base_url: str = Field(
        default="http://localhost:11434",
        description="Ollama server URL (must be reachable from Evols backend)"
    )


class DeepSeekConfig(BaseModel):
    provider: Literal["deepseek"] = "deepseek"
    api_key: str = Field(..., min_length=1, description="DeepSeek API key")
    model: str = Field(default="deepseek/deepseek-v3.2", description="DeepSeek model")


class XAIConfig(BaseModel):
    provider: Literal["xai"] = "xai"
    api_key: str = Field(..., min_length=1, description="xAI API key")
    model: str = Field(default="xai/grok-4", description="xAI Grok model")


class OpenRouterConfig(BaseModel):
    provider: Literal["openrouter"] = "openrouter"
    api_key: str = Field(..., min_length=1, description="OpenRouter API key")
    model: str = Field(default="openrouter/deepseek/deepseek-r1", description="OpenRouter model")


# ============================================================================
# API Request/Response Schemas
# ============================================================================

LLMSettingsUpdate = Union[
    OpenAIConfig,
    AnthropicConfig,
    AzureOpenAIConfig,
    AWSBedrockConfig,
    GoogleGeminiConfig,
    GroqConfig,
    MistralConfig,
    CohereConfig,
    TogetherAIConfig,
    OllamaConfig,
    DeepSeekConfig,
    XAIConfig,
    OpenRouterConfig,
]


class LLMSettingsResponse(BaseModel):
    provider: str
    model: Optional[str] = None
    api_key_masked: Optional[str] = Field(None, description="Masked API key (e.g., sk-...xyz)")
    endpoint: Optional[str] = None
    region: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LLMTestConnectionRequest(BaseModel):
    config: LLMSettingsUpdate = Field(..., description="LLM configuration to test")


class LLMTestConnectionResponse(BaseModel):
    success: bool
    message: str
    provider: str
    model: Optional[str] = None
    latency_ms: Optional[int] = None


# ============================================================================
# Model lists for UI dropdowns
# ============================================================================

OPENAI_MODELS = [
    "gpt-5.4",
    "gpt-5.2",
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
]

OPENAI_EMBEDDING_MODELS = [
    "text-embedding-3-large",
    "text-embedding-3-small",
]

ANTHROPIC_MODELS = [
    "claude-sonnet-4-6",
    "claude-opus-4-6",
    "claude-haiku-4-5-20251001",
    "claude-opus-4-20250514",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
]

AWS_BEDROCK_MODELS = [
    "global.anthropic.claude-sonnet-4-6",
    "global.anthropic.claude-opus-4-6-v1",
    "us.anthropic.claude-sonnet-4-6",
    "us.anthropic.claude-opus-4-6-v1",
    "eu.anthropic.claude-sonnet-4-6",
    "eu.anthropic.claude-opus-4-6-v1",
    "au.anthropic.claude-sonnet-4-6",
    "au.anthropic.claude-opus-4-6-v1",
    "anthropic.claude-sonnet-4-5-20250929-v1:0",
    "anthropic.claude-sonnet-4-20250514-v1:0",
    "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "anthropic.claude-3-5-haiku-20241022-v1:0",
    "anthropic.claude-3-sonnet-20240229-v1:0",
    "anthropic.claude-3-opus-20240229-v1:0",
    "anthropic.claude-3-haiku-20240307-v1:0",
    "amazon.titan-text-express-v1",
    "amazon.titan-text-lite-v1",
]

AWS_REGIONS = [
    "us-east-1",
    "us-west-2",
    "us-west-1",
    "eu-west-1",
    "eu-central-1",
    "ap-northeast-1",
    "ap-southeast-1",
    "ap-southeast-2",
]

GOOGLE_GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-3.1-flash-live-preview",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.0-pro",
]

GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama-3.2-90b-vision-preview",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
]

MISTRAL_MODELS = [
    "mistral-large-latest",
    "mistral-medium-latest",
    "mistral-small-latest",
    "codestral-latest",
    "open-mixtral-8x22b",
]

COHERE_MODELS = [
    "command-r-plus",
    "command-r",
    "command",
    "command-light",
]

TOGETHER_AI_MODELS = [
    "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "meta-llama/Llama-3.1-8B-Instruct-Turbo",
    "mistralai/Mixtral-8x7B-Instruct-v0.1",
    "togethercomputer/CodeLlama-34b-Instruct",
]

DEEPSEEK_MODELS = [
    "deepseek/deepseek-v3.2",
    "deepseek/deepseek-v3",
    "deepseek/deepseek-r1",
    "deepseek/deepseek-reasoner",
    "deepseek/deepseek-chat",
]

XAI_MODELS = [
    "xai/grok-4",
    "xai/grok-4-fast-reasoning",
    "xai/grok-3",
    "xai/grok-3-mini",
    "xai/grok-3-mini-fast",
    "xai/grok-2-1212",
]

OPENROUTER_MODELS = [
    "openrouter/deepseek/deepseek-r1",
    "openrouter/deepseek/deepseek-r1-0528",
    "openrouter/deepseek/deepseek-chat-v3.1",
    "openrouter/deepseek/deepseek-v3.2",
    "openrouter/meta-llama/llama-3.3-70b-instruct",
    "openrouter/meta-llama/llama-3.1-405b-instruct",
    "openrouter/qwen/qwen3-235b-a22b",
    "openrouter/qwen/qwen3-30b-a3b",
    "openrouter/microsoft/phi-4",
    "openrouter/mistralai/mistral-large",
    "openrouter/google/gemini-2.5-flash",
    "openrouter/google/gemini-2.5-pro",
    "openrouter/openai/gpt-5",
    "openrouter/anthropic/claude-sonnet-4-5",
    "openrouter/x-ai/grok-4",
]


class ModelOptionsResponse(BaseModel):
    openai_models: list[str] = OPENAI_MODELS
    openai_embedding_models: list[str] = OPENAI_EMBEDDING_MODELS
    anthropic_models: list[str] = ANTHROPIC_MODELS
    aws_bedrock_models: list[str] = AWS_BEDROCK_MODELS
    aws_regions: list[str] = AWS_REGIONS
    google_gemini_models: list[str] = GOOGLE_GEMINI_MODELS
    groq_models: list[str] = GROQ_MODELS
    mistral_models: list[str] = MISTRAL_MODELS
    cohere_models: list[str] = COHERE_MODELS
    together_ai_models: list[str] = TOGETHER_AI_MODELS
    deepseek_models: list[str] = DEEPSEEK_MODELS
    xai_models: list[str] = XAI_MODELS
    openrouter_models: list[str] = OPENROUTER_MODELS
