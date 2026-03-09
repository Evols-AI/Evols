from sqlalchemy import Column, String, Text, DateTime
from datetime import datetime
from app.core.database import Base

class SupportTicket(Base):
    """
    SupportTicket model to store contact form submissions.
    """
    __tablename__ = "support_tickets"

    id = Column(String(36), primary_key=True, index=True) # Usually ULID or UUID
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    topic = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(50), default="open", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
