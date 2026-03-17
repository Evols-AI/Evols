"""
Application Configuration
Centralized configuration management using Pydantic Settings
"""

from typing import List, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )

    # Application
    APP_NAME: str = "Evols"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Database
    # Note: Use plain postgresql:// format - it will be auto-converted to postgresql+asyncpg:// for async operations
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/evols"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10

    # Redis & Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    USE_CELERY: bool = Field(
        default=True,
        description="Enable Celery for durable background tasks. Set to False for local dev without Redis/Celery."
    )

    # JWT & Security
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Field-level encryption for API keys and secrets
    FIELD_ENCRYPTION_KEY: Optional[str] = None  # Generate with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'

    # RBAC & Admin
    SUPER_ADMIN_CREATION_TOKEN: Optional[str] = None  # Token required to create first SUPER_ADMIN user

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            return [i.strip() for i in v.split(",")]
        return v

    # LLM Configuration
    # NOTE: LLM API keys are NOT stored in environment variables.
    # Each tenant configures their own API keys via Settings → LLM Settings in the UI.
    # Keys are encrypted and stored in the database per tenant (BYOK - Bring Your Own Keys).

    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: str = "noreply@evols.ai"
    FRONTEND_URL: str = "http://localhost:3000"  # Frontend URL for email links

    # File Upload
    MAX_UPLOAD_SIZE_MB: int = 100
    ALLOWED_UPLOAD_EXTENSIONS: List[str] = [".csv", ".xlsx", ".json"]

    # Feature Flags
    ENABLE_PERSONA_TWINS: bool = True
    ENABLE_DECISION_BRIEFS: bool = True
    ENABLE_KNOWLEDGE_GRAPH_VIZ: bool = True

    # Analytics
    SENTRY_DSN: Optional[str] = None
    POSTHOG_API_KEY: Optional[str] = None


# Create global settings instance
settings = Settings()
