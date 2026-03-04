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
    model: str = Field(default="gpt-4o", description="Model to use for generation")
    embedding_model: str = Field(
        default="text-embedding-3-small",
        description="Embedding model for vector search"
    )


class AnthropicConfig(BaseModel):
    """Anthropic Claude provider configuration"""

    provider: Literal["anthropic"] = "anthropic"
    api_key: str = Field(..., min_length=1, description="Anthropic API key")
    model: str = Field(
        default="claude-3-5-sonnet-20241022",
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
        default="anthropic.claude-v2",
        description="Bedrock model ID (e.g., anthropic.claude-v2)"
    )

    def model_post_init(self, __context):
        """Validate that the required fields for the selected auth method are present"""
        if self.aws_auth_method == "api_key":
            if not self.api_key:
                raise ValueError("api_key is required when aws_auth_method is 'api_key'")
        elif self.aws_auth_method == "credentials":
            if not self.access_key_id or not self.secret_access_key:
                raise ValueError("access_key_id and secret_access_key are required when aws_auth_method is 'credentials'")


# ============================================================================
# API Request/Response Schemas
# ============================================================================

LLMSettingsUpdate = Union[OpenAIConfig, AnthropicConfig, AzureOpenAIConfig, AWSBedrockConfig]


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
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
]

OPENAI_EMBEDDING_MODELS = [
    "text-embedding-3-small",
    "text-embedding-3-large",
    "text-embedding-ada-002",
]

ANTHROPIC_MODELS = [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
]

AWS_BEDROCK_MODELS = [
    "anthropic.claude-v2",
    "anthropic.claude-v2:1",
    "anthropic.claude-3-sonnet-20240229-v1:0",
    "anthropic.claude-3-haiku-20240307-v1:0",
    "anthropic.claude-instant-v1",
    "amazon.titan-text-express-v1",
    "amazon.titan-text-lite-v1",
    "ai21.j2-ultra-v1",
    "ai21.j2-mid-v1",
    "cohere.command-text-v14",
    "cohere.command-light-text-v14",
    "meta.llama2-70b-chat-v1",
    "meta.llama2-13b-chat-v1",
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


class ModelOptionsResponse(BaseModel):
    """Available model options for each provider"""

    openai_models: list[str] = OPENAI_MODELS
    openai_embedding_models: list[str] = OPENAI_EMBEDDING_MODELS
    anthropic_models: list[str] = ANTHROPIC_MODELS
    aws_bedrock_models: list[str] = AWS_BEDROCK_MODELS
    aws_regions: list[str] = AWS_REGIONS
