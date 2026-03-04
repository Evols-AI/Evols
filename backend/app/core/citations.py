"""
Citation System
Links AI-generated content back to source data for transparency
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class CitationSourceType(str, Enum):
    """Types of sources that can be cited"""
    FEEDBACK = "feedback"
    THEME = "theme"
    ACCOUNT = "account"
    INTERVIEW = "interview"
    METRIC = "metric"
    DECISION = "decision"
    INITIATIVE = "initiative"


class Citation(BaseModel):
    """
    A single citation linking content to source data
    """
    source_type: CitationSourceType
    source_id: int
    quote: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0, default=1.0)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def to_display(self) -> str:
        """Generate human-readable citation display"""
        parts = []
        
        if self.source_type == CitationSourceType.FEEDBACK:
            parts.append(f"Feedback #{self.source_id}")
        elif self.source_type == CitationSourceType.THEME:
            parts.append(f"Theme #{self.source_id}")
        elif self.source_type == CitationSourceType.ACCOUNT:
            parts.append(f"Account: {self.metadata.get('account_name', f'#{self.source_id}')}")
        elif self.source_type == CitationSourceType.INTERVIEW:
            parts.append(f"Interview #{self.source_id}")
        
        # Add ARR if available
        if "arr" in self.metadata:
            arr = self.metadata["arr"]
            parts.append(f"${arr:,.0f} ARR")
        
        # Add count if available
        if "count" in self.metadata:
            parts.append(f"{self.metadata['count']} items")
        
        return " | ".join(parts)


class CitedContent(BaseModel):
    """
    Content with citations - the core transparency primitive
    """
    content: str
    citations: List[Citation] = Field(default_factory=list)
    confidence_score: float = Field(ge=0.0, le=1.0, default=1.0)
    
    def add_citation(
        self,
        source_type: CitationSourceType,
        source_id: int,
        quote: Optional[str] = None,
        confidence: float = 1.0,
        **metadata
    ):
        """Add a citation to this content"""
        citation = Citation(
            source_type=source_type,
            source_id=source_id,
            quote=quote,
            confidence=confidence,
            metadata=metadata
        )
        self.citations.append(citation)
        
    def get_citation_summary(self) -> str:
        """Get a summary of all citations"""
        if not self.citations:
            return "[No citations]"
        
        # Group by source type
        by_type: Dict[CitationSourceType, List[Citation]] = {}
        for citation in self.citations:
            if citation.source_type not in by_type:
                by_type[citation.source_type] = []
            by_type[citation.source_type].append(citation)
        
        # Build summary
        parts = []
        
        if CitationSourceType.FEEDBACK in by_type:
            count = len(by_type[CitationSourceType.FEEDBACK])
            parts.append(f"{count} feedback item{'s' if count != 1 else ''}")
        
        if CitationSourceType.ACCOUNT in by_type:
            accounts = by_type[CitationSourceType.ACCOUNT]
            total_arr = sum(c.metadata.get("arr", 0) for c in accounts)
            parts.append(f"${total_arr:,.0f} ARR")
            
        if CitationSourceType.INTERVIEW in by_type:
            count = len(by_type[CitationSourceType.INTERVIEW])
            parts.append(f"{count} interview{'s' if count != 1 else ''}")
        
        summary = " | ".join(parts)
        return f"[{summary}]"


class CitationBuilder:
    """
    Helper class to build cited content
    """
    
    def __init__(self):
        self.content_parts: List[str] = []
        self.citations: List[Citation] = []
        
    def add_content(self, text: str):
        """Add content without citations"""
        self.content_parts.append(text)
        
    def add_cited_content(
        self,
        text: str,
        source_type: CitationSourceType,
        source_id: int,
        quote: Optional[str] = None,
        confidence: float = 1.0,
        **metadata
    ):
        """Add content with a citation"""
        self.content_parts.append(text)
        citation = Citation(
            source_type=source_type,
            source_id=source_id,
            quote=quote,
            confidence=confidence,
            metadata=metadata
        )
        self.citations.append(citation)
        
    def build(self, confidence_score: float = 1.0) -> CitedContent:
        """Build the final CitedContent"""
        content = "\n".join(self.content_parts)
        return CitedContent(
            content=content,
            citations=self.citations,
            confidence_score=confidence_score
        )


def extract_citations_from_feedback(feedback_items: List[Any]) -> List[Citation]:
    """
    Extract citations from a list of feedback items
    
    Args:
        feedback_items: List of Feedback model instances
        
    Returns:
        List of Citation objects
    """
    citations = []
    
    for item in feedback_items:
        citation = Citation(
            source_type=CitationSourceType.FEEDBACK,
            source_id=item.id,
            quote=item.content[:200] if len(item.content) > 200 else item.content,
            confidence=1.0,
            metadata={
                "customer_name": item.customer_name,
                "segment": item.customer_segment,
                "date": str(item.feedback_date) if item.feedback_date else None,
                "category": item.category.value if item.category else None,
            }
        )
        citations.append(citation)
    
    return citations


def extract_citations_from_themes(themes: List[Any]) -> List[Citation]:
    """
    Extract citations from a list of theme items
    
    Args:
        themes: List of Theme model instances
        
    Returns:
        List of Citation objects
    """
    citations = []
    
    for theme in themes:
        citation = Citation(
            source_type=CitationSourceType.THEME,
            source_id=theme.id,
            quote=theme.summary[:200] if theme.summary and len(theme.summary) > 200 else theme.summary,
            confidence=theme.confidence_score or 1.0,
            metadata={
                "title": theme.title,
                "feedback_count": theme.feedback_count,
                "total_arr": theme.total_arr,
                "urgency_score": theme.urgency_score,
            }
        )
        citations.append(citation)
    
    return citations
