from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class SupportTicketBase(BaseModel):
    name: str
    email: EmailStr
    topic: str
    message: str

class SupportTicketCreate(SupportTicketBase):
    pass

class SupportTicketOut(SupportTicketBase):
    id: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class SupportTicketUpdate(BaseModel):
    status: Optional[str] = None
