"""
Job Model
Background job tracking for long-running AI operations
"""

from sqlalchemy import Column, String, Text, Integer, ForeignKey, Float, JSON, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from enum import Enum
import uuid

from app.models.base import TenantScopedModel


class JobStatus(str, Enum):
    """Job execution status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobType(str, Enum):
    """Types of background jobs"""
    CLUSTERING = "CLUSTERING"
    THEME_GENERATION = "THEME_GENERATION"
    THEME_REFRESH = "THEME_REFRESH"
    PERSONA_GENERATION = "PERSONA_GENERATION"
    DECISION_GENERATION = "DECISION_GENERATION"
    NARRATIVE_GENERATION = "NARRATIVE_GENERATION"
    PROJECT_GENERATION = "PROJECT_GENERATION"
    DATA_INGESTION = "DATA_INGESTION"
    FEEDBACK_CSV_UPLOAD = "FEEDBACK_CSV_UPLOAD"
    EXPORT = "EXPORT"


class Job(TenantScopedModel):
    """
    Background job for tracking long-running operations
    Provides progress updates and transparency
    """

    __tablename__ = "job"

    # Use UUID for job ID
    job_uuid = Column(UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4, index=True)

    # Tenant and user association
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # Job details
    job_type = Column(SQLEnum(JobType), nullable=False, index=True)
    status = Column(SQLEnum(JobStatus), nullable=False, default=JobStatus.PENDING, index=True)

    # Progress tracking
    progress = Column(Float, default=0.0)  # 0.0 to 1.0
    current_step = Column(String(255), nullable=True)
    total_steps = Column(Integer, nullable=True)
    message = Column(Text, nullable=True)

    # Results and errors
    result = Column(JSON, nullable=True)  # JSON result data
    error = Column(Text, nullable=True)  # Error message if failed

    # Metadata
    input_params = Column(JSON, nullable=True)  # Input parameters for the job
    job_metadata = Column(JSON, nullable=True)  # Additional metadata

    # Relationships (no back_populates — Tenant/User models don't define the reverse)
    tenant = relationship("Tenant")
    user = relationship("User")

    def __repr__(self):
        return f"<Job(id={self.id}, type='{self.job_type}', status='{self.status}', progress={self.progress})>"

    def update_progress(
        self,
        progress: float,
        message: str = None,
        current_step: str = None
    ):
        """Update job progress"""
        self.progress = min(max(progress, 0.0), 1.0)  # Clamp between 0 and 1
        if message:
            self.message = message
        if current_step:
            self.current_step = current_step
        if progress >= 1.0:
            self.status = JobStatus.COMPLETED

    def mark_completed(self, result: dict = None):
        """Mark job as completed"""
        self.status = JobStatus.COMPLETED
        self.progress = 1.0
        if result:
            self.result = result

    def mark_failed(self, error: str):
        """Mark job as failed"""
        self.status = JobStatus.FAILED
        self.error = error

    def to_progress_dict(self) -> dict:
        """Convert to progress dictionary for API responses"""
        return {
            "job_id": str(self.job_uuid),
            "job_type": self.job_type.value,
            "status": self.status.value,
            "progress": self.progress,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "message": self.message,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
