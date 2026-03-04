"""
Feedback Bulk Import Schemas
For extracting multiple feedback items from unstructured documents
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class ExtractedFeedbackItem(BaseModel):
    """Single feedback item extracted from document"""
    title: str = Field(..., description="Brief summary of the feedback")
    content: str = Field(..., description="Full feedback content")
    customer_name: Optional[str] = Field(None, description="Customer/account name if mentioned")
    customer_segment: Optional[str] = Field(None, description="Customer segment (Enterprise, Mid-Market, SMB)")
    category: Optional[str] = Field(None, description="Feedback category")
    confidence: float = Field(..., description="Confidence score (0.0-1.0) for this extraction")


class FeedbackExtractionResponse(BaseModel):
    """Response from document parsing"""
    success: bool
    message: str
    items_extracted: int
    feedback_items: List[ExtractedFeedbackItem]
    warnings: Optional[List[str]] = None
