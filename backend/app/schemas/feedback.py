"""
Feedback Schemas
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import date, datetime
from app.models.feedback import FeedbackCategory, FeedbackSource


class FeedbackBase(BaseModel):
    """Base feedback schema"""

    source: FeedbackSource
    content: str
    title: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_segment: Optional[str] = None
    feedback_date: Optional[date] = None


class FeedbackCreate(FeedbackBase):
    """Feedback creation schema"""

    account_id: Optional[int] = None
    category: Optional[FeedbackCategory] = None
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class FeedbackBulkUpload(BaseModel):
    """Bulk feedback upload from CSV"""

    feedback_items: List[FeedbackCreate]


class FeedbackUpdate(BaseModel):
    """Feedback update schema"""

    title: Optional[str] = None
    category: Optional[FeedbackCategory] = None
    theme_id: Optional[int] = None
    tags: Optional[List[str]] = None


class FeedbackResponse(FeedbackBase):
    """Feedback response schema"""

    id: int
    tenant_id: int
    product_id: Optional[int] = None
    category: Optional[FeedbackCategory] = None
    auto_category: Optional[FeedbackCategory] = None
    account_id: Optional[int] = None
    theme_id: Optional[int] = None
    theme_confidence: Optional[float] = None
    sentiment_score: Optional[float] = None
    urgency_score: Optional[float] = None
    impact_score: Optional[float] = None
    tags: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FeedbackFilter(BaseModel):
    """Feedback filtering parameters"""

    category: Optional[FeedbackCategory] = None
    segment: Optional[str] = None
    theme_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    min_urgency: Optional[float] = Field(None, ge=0.0, le=1.0)
    tags: Optional[List[str]] = None
