"""
Prompt Model
Version-controlled prompts for LLM interactions
"""

from sqlalchemy import Column, String, Text, Integer, ForeignKey, Boolean, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from app.models.base import TenantScopedModel


class Prompt(TenantScopedModel):
    """
    Versioned prompt templates for LLM interactions
    Enables A/B testing, versioning, and centralized management
    """

    __tablename__ = "prompt"

    # Tenant association (null = global/system prompt)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)

    # Prompt identification
    key = Column(String(255), nullable=False, index=True)  # e.g., "project_generation_system"
    version = Column(String(50), nullable=False, default="1.0")  # Semantic versioning

    # Prompt content
    system_prompt = Column(Text, nullable=True)  # System message
    user_template = Column(Text, nullable=True)  # User message template with variables

    # Metadata
    description = Column(Text, nullable=True)  # What this prompt does
    category = Column(String(100), nullable=True, index=True)  # e.g., "generation", "analysis"
    tags = Column(JSON, nullable=True)  # List of tags for organization

    # Variables/placeholders in template
    variables = Column(JSON, nullable=True)  # List of variable names used in template
    # Example: ["initiative_title", "themes", "personas"]

    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_default = Column(Boolean, default=False)  # Is this the default version for this key?

    # Performance tracking
    usage_count = Column(Integer, default=0)  # How many times this prompt was used
    avg_response_time = Column(Integer, nullable=True)  # Avg response time in ms
    success_rate = Column(Integer, nullable=True)  # Percentage of successful completions

    # A/B testing
    variant_name = Column(String(100), nullable=True)  # e.g., "control", "variant_a", "variant_b"
    experiment_id = Column(String(100), nullable=True, index=True)

    # Ownership
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Extra metadata
    extra_data = Column(JSON, nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="prompts")
    created_by_user = relationship("User", foreign_keys=[created_by])

    # Unique constraint: one active default per key per tenant
    __table_args__ = (
        UniqueConstraint("tenant_id", "key", "version", name="uq_prompt_tenant_key_version"),
    )

    def __repr__(self):
        return f"<Prompt(key='{self.key}', version='{self.version}', active={self.is_active})>"


class PromptExecution(TenantScopedModel):
    """
    Track prompt executions for analytics and optimization
    """

    __tablename__ = "prompt_execution"

    # Tenant association
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Prompt reference
    prompt_id = Column(Integer, ForeignKey("prompt.id"), nullable=False, index=True)
    prompt_key = Column(String(255), nullable=False, index=True)  # Denormalized for fast queries
    prompt_version = Column(String(50), nullable=False)

    # Execution details
    input_variables = Column(JSON, nullable=True)  # Variables passed to template
    rendered_prompt = Column(Text, nullable=True)  # Final prompt after variable substitution

    # Response
    response_content = Column(Text, nullable=True)
    response_tokens = Column(Integer, nullable=True)
    response_time_ms = Column(Integer, nullable=True)

    # Success tracking
    success = Column(Boolean, nullable=False, default=True)
    error_message = Column(Text, nullable=True)

    # Model details
    model_name = Column(String(100), nullable=True)
    provider = Column(String(50), nullable=True)

    # Context
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Extra metadata
    extra_data = Column(JSON, nullable=True)

    # Relationships
    tenant = relationship("Tenant")
    prompt = relationship("Prompt")
    user = relationship("User")

    def __repr__(self):
        return f"<PromptExecution(prompt_key='{self.prompt_key}', success={self.success})>"
