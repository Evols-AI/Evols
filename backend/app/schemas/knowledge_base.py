"""
Product RAG (Retrieval-Augmented Generation) Schemas
Knowledge Base for product capabilities and documentation
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, HttpUrl
from datetime import datetime
from enum import Enum


class SourceType(str, Enum):
    """Knowledge source type"""
    URL = "url"
    PDF = "pdf"
    GITHUB = "github"
    MCP = "mcp"


class SourceStatus(str, Enum):
    """Processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class KnowledgeSourceCreate(BaseModel):
    """Create knowledge source"""
    name: str = Field(..., min_length=1, max_length=255)
    type: SourceType
    description: Optional[str] = None
    url: Optional[str] = None
    github_repo: Optional[str] = None
    mcp_endpoint: Optional[str] = None


class KnowledgeSourceResponse(BaseModel):
    """Knowledge source response"""
    id: int
    tenant_id: int
    product_id: Optional[int] = None
    name: str
    type: str
    description: Optional[str]
    url: Optional[str]
    github_repo: Optional[str]
    mcp_endpoint: Optional[str]
    status: str
    error_message: Optional[str]
    capabilities_extracted: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CapabilityCategory(str, Enum):
    """Capability category"""
    API = "api"
    FEATURE = "feature"
    COMPONENT = "component"
    SERVICE = "service"
    DATABASE = "database"
    INTEGRATION = "integration"


class CapabilityResponse(BaseModel):
    """Capability response"""
    id: int
    tenant_id: int
    product_id: Optional[int] = None
    source_id: int
    name: str
    description: str
    category: Optional[str]
    endpoints: Optional[List[Dict[str, Any]]]
    dependencies: Optional[List[str]]
    dependents: Optional[List[str]]
    source_url: Optional[str]
    source_section: Optional[str]
    created_at: datetime
    updated_at: datetime

    # Include source details
    source: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class KnowledgeBaseAskRequest(BaseModel):
    """Ask question about Product RAG system"""
    question: str = Field(..., min_length=1)
    source_ids: Optional[List[int]] = None  # Optional: limit to specific sources


class KnowledgeBaseAskResponse(BaseModel):
    """Answer from Product RAG system"""
    answer: str
    citations: List[Dict[str, Any]]  # References to sources
    confidence: Optional[float] = None
