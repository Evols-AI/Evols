"""Login Audit Log model — records every authentication attempt."""

from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, DateTime
from datetime import datetime

from app.models.base import BaseModel


class LoginAuditLog(BaseModel):
    __tablename__ = "login_audit_logs"

    # Who
    email = Column(String(255), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # How
    method = Column(String(32), nullable=False)   # "email" | "google" | "github" | "password_reset"
    success = Column(Boolean, nullable=False, index=True)
    failure_reason = Column(String(255), nullable=True)  # e.g. "invalid_password", "deactivated"

    # Where / when
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
