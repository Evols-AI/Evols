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
    """OpenAI provider configuration"""

    provider: Literal["openai"] = "openai"
    api_key: str = Field(..., min_length=1, description="OpenAI API key (sk-...)")
    model: str = Field(default="gpt-5.4", description="Model to use for generation")  # Latest GPT-5.4 (March 2026)
    embedding_model: str = Field(
        default="text-embedding-3-large",
        description="Embedding model for vector search"
    )


class AnthropicConfig(BaseModel):
    """Anthropic Claude provider configuration"""

    provider: Literal["anthropic"] = "anthropic"
    api_key: str = Field(..., min_length=1, description="Anthropic API key")
    model: str = Field(
        default="claude-sonnet-4-6",  # Latest Claude 4.6 Sonnet (Feb 2026)
        description="Claude model version"
    )


class AzureOpenAIConfig(BaseModel):
    """Azure OpenAI provider configuration"""

    provider: Literal["azure_openai"] = "azure_openai"
    api_key: str = Field(..., min_length=1, description="Azure OpenAI API key")
    endpoint: str = Field(..., description="Azure OpenAI endpoint URL")
    deployment_name: str = Field(..., description="Deployment name")
    api_version: str = Field(
        default="2024-02-01",
        description="Azure OpenAI API version"
    )
    embedding_deployment: Optional[str] = Field(
        None,
        description="Embedding deployment name"
    )


class AWSBedrockConfig(BaseModel):
    """AWS Bedrock provider configuration - supports both API key and IAM credentials"""

    provider: Literal["aws_bedrock"] = "aws_bedrock"
    aws_auth_method: Literal["api_key", "credentials"] = Field(
        default="api_key",
        description="Authentication method: api_key or credentials (IAM)"
    )
    # API Key authentication
    api_key: Optional[str] = Field(None, description="AWS Bedrock API key (if using api_key method)")
    # IAM credentials authentication
    access_key_id: Optional[str] = Field(None, description="AWS Access Key ID (if using credentials method)")
    secret_access_key: Optional[str] = Field(None, description="AWS Secret Access Key (if using credentials method)")
    # Common fields
    region: str = Field(default="us-east-1", description="AWS region")
    model_id: str = Field(
        default="global.anthropic.claude-sonnet-4-6",  # Latest Claude 4.6 Sonnet inference profile (Feb 2026)
        description="Bedrock model ID or inference profile (e.g., global.anthropic.claude-sonnet-4-6)"
    )

    def model_post_init(self, __context):
        """Validate that the required fields for the selected auth method are present"""
        if self.aws_auth_method == "api_key":
            if not self.api_key:
                raise ValueError("api_key is required when aws_auth_method is 'api_key'")
        elif self.aws_auth_method == "credentials":
            if not self.access_key_id or not self.secret_access_key:
                raise ValueError("access_key_id and secret_access_key are required when aws_auth_method is 'credentials'")


class GoogleGeminiConfig(BaseModel):
    """Google Gemini provider configuration"""

    provider: Literal["google_gemini"] = "google_gemini"
    api_key: str = Field(..., min_length=1, description="Google AI Studio API key")
    model: str = Field(
        default="gemini-2.5-flash",  # Latest production-ready Gemini model (2026)
        description="Gemini model to use for generation"
    )
    temperature: Optional[float] = Field(
        default=0.7,
        description="Sampling temperature (0.0 to 1.0)"
    )
    top_p: Optional[float] = Field(
        default=0.95,
        description="Top-p sampling parameter"
    )
    top_k: Optional[int] = Field(
        default=40,
        description="Top-k sampling parameter"
    )


# ============================================================================
# API Request/Response Schemas
# ============================================================================

LLMSettingsUpdate = Union[OpenAIConfig, AnthropicConfig, AzureOpenAIConfig, AWSBedrockConfig, GoogleGeminiConfig]


class LLMSettingsResponse(BaseModel):
    """Response schema for LLM settings (with masked API keys)"""

    provider: str
    model: Optional[str] = None
    api_key_masked: Optional[str] = Field(None, description="Masked API key (e.g., sk-...xyz)")
    endpoint: Optional[str] = None
    region: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LLMTestConnectionRequest(BaseModel):
    """Request to test LLM connection before saving"""

    config: LLMSettingsUpdate = Field(..., description="LLM configuration to test")


class LLMTestConnectionResponse(BaseModel):
    """Response from LLM connection test"""

    success: bool
    message: str
    provider: str
    model: Optional[str] = None
    latency_ms: Optional[int] = None


# ============================================================================
# Model Selection Options (for UI dropdowns)
# ============================================================================

OPENAI_MODELS = [
    "gpt-5.4",       # Latest GPT-5.4 (March 2026) - Most advanced model
    "gpt-5.2",       # GPT-5.2 (December 2025)
    "gpt-4o",        # Previous generation flagship (Nov 2024)
    "gpt-4o-mini",   # Fast and cost-effective
    "gpt-4-turbo",   # Legacy but still good
]

OPENAI_EMBEDDING_MODELS = [
    "text-embedding-3-large",   # Best quality embeddings
    "text-embedding-3-small",   # Cost-effective option
]

ANTHROPIC_MODELS = [
    # Claude 4.6 (latest - Feb 2026) - Most advanced generation
    "claude-sonnet-4-6",           # Latest Sonnet - Best balance (DEFAULT)
    "claude-opus-4-6",             # Latest Opus - Most powerful
    "claude-haiku-4-5-20251001",   # Latest Haiku - Fast and cost-effective
    # Claude 4 (previous generation)
    "claude-opus-4-20250514",      # Previous Claude 4
    # Claude 3.5 (legacy but stable)
    "claude-3-5-sonnet-20241022",  # Previous generation Sonnet
    "claude-3-5-haiku-20241022",   # Previous generation Haiku
    # Claude 3 (legacy)
    "claude-3-opus-20240229",      # Older generation
]

AWS_BEDROCK_MODELS = [
    # Claude 4.6 models (latest - Feb 2026) - Use inference profiles for global routing
    "global.anthropic.claude-sonnet-4-6",          # Global Claude 4.6 Sonnet (DEFAULT)
    "global.anthropic.claude-opus-4-6-v1",         # Global Claude 4.6 Opus
    # Regional Claude 4.6 profiles for specific geographic requirements
    "us.anthropic.claude-sonnet-4-6",              # US Claude 4.6 Sonnet
    "us.anthropic.claude-opus-4-6-v1",             # US Claude 4.6 Opus
    "eu.anthropic.claude-sonnet-4-6",              # EU Claude 4.6 Sonnet
    "eu.anthropic.claude-opus-4-6-v1",             # EU Claude 4.6 Opus
    "au.anthropic.claude-sonnet-4-6",              # AU Claude 4.6 Sonnet
    "au.anthropic.claude-opus-4-6-v1",             # AU Claude 4.6 Opus
    # Claude 4.x models (direct model IDs)
    "anthropic.claude-sonnet-4-5-20250929-v1:0",  # Claude 4.5 Sonnet
    "anthropic.claude-sonnet-4-20250514-v1:0",    # Claude 4 Sonnet
    # Claude 3.5 models (previous generation, still excellent)
    "anthropic.claude-3-5-sonnet-20241022-v2:0",   # Previous generation Sonnet
    "anthropic.claude-3-5-haiku-20241022-v1:0",    # Previous generation Haiku - Fast
    # Claude 3 models (legacy - stable, work with Converse API)
    "anthropic.claude-3-sonnet-20240229-v1:0",     # Legacy but stable
    "anthropic.claude-3-opus-20240229-v1:0",       # Legacy most capable
    "anthropic.claude-3-haiku-20240307-v1:0",      # Legacy cost-effective
    # Amazon Titan models
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
    # Gemini 2.5 (latest production - 2026) - Most advanced stable generation
    "gemini-2.5-flash",             # Latest production model - Best overall (DEFAULT)
    "gemini-2.5-flash-lite",        # Latest Flash-Lite - Ultra-fast
    # Gemini 3.1 (preview models - not for production, Gemini 3 Pro deprecated March 2026)
    "gemini-3.1-pro-preview",       # Preview only - use with caution
    "gemini-3.1-flash-lite-preview", # Preview Flash-Lite
    "gemini-3.1-flash-live-preview", # Preview Flash Live - Real-time audio
    # Gemini 1.5 (legacy but stable)
    "gemini-1.5-pro",              # Previous generation Pro
    "gemini-1.5-flash",            # Previous generation Flash
    "gemini-1.5-flash-8b",         # Ultra-fast for simple tasks
    "gemini-1.5-pro-text-only",    # Text-focused variant
    "gemini-1.5-flash-text-only",  # Fast text-only variant
    # Legacy (avoid unless needed)
    "gemini-1.0-pro",              # Much older generation
]


class ModelOptionsResponse(BaseModel):
    """Available model options for each provider"""

    openai_models: list[str] = OPENAI_MODELS
    openai_embedding_models: list[str] = OPENAI_EMBEDDING_MODELS
    anthropic_models: list[str] = ANTHROPIC_MODELS
    aws_bedrock_models: list[str] = AWS_BEDROCK_MODELS
    aws_regions: list[str] = AWS_REGIONS
    google_gemini_models: list[str] = GOOGLE_GEMINI_MODELS
