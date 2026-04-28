"""
Skill Memory Model
Stores history of skill executions for retrospective analysis
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON
from datetime import datetime
from app.models.base import BaseModel


class SkillMemory(BaseModel):
    """
    Memory of skill executions.
    Allows AI to reference past work and build context over time.
    """
    __tablename__ = 'skill_memory'

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True)

    skill_name = Column(String(255), nullable=False)
    skill_category = Column(String(50), nullable=True, index=True)

    input_data = Column(JSON, nullable=False)
    output_data = Column(JSON, nullable=False)
    summary = Column(Text, nullable=True)

    # created_at inherited from BaseModel

    def __repr__(self):
        return f"<SkillMemory(skill_name='{self.skill_name}', tenant_id={self.tenant_id})>"

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'id': self.id,
            'skill_name': self.skill_name,
            'skill_category': self.skill_category,
            'summary': self.summary,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'input_data': self.input_data,
            'output_data': self.output_data
        }
