import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.permissions import require_super_admin
from app.models.user import User
from app.models.support import SupportTicket
from app.schemas.support import SupportTicketCreate, SupportTicketOut, SupportTicketUpdate

router = APIRouter()

@router.post("/", response_model=SupportTicketOut, status_code=status.HTTP_201_CREATED)
async def create_support_ticket(
    ticket_in: SupportTicketCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Public endpoint to submit a new support ticket.
    """
    db_ticket = SupportTicket(
        id=str(uuid.uuid4()),
        name=ticket_in.name,
        email=ticket_in.email,
        topic=ticket_in.topic,
        message=ticket_in.message,
        status="open"
    )
    db.add(db_ticket)
    await db.commit()
    await db.refresh(db_ticket)
    return db_ticket

@router.get("/", response_model=List[SupportTicketOut])
async def list_support_tickets(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Admin endpoint to view all support tickets.
    """
    require_super_admin(current_user)
    
    query = select(SupportTicket).order_by(desc(SupportTicket.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    tickets = result.scalars().all()
    
    return tickets

@router.put("/{ticket_id}", response_model=SupportTicketOut)
async def update_support_ticket(
    ticket_id: str,
    ticket_update: SupportTicketUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Admin endpoint to update support ticket status.
    """
    require_super_admin(current_user)
    
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Support ticket not found")
        
    if ticket_update.status is not None:
        ticket.status = ticket_update.status
        
    await db.commit()
    await db.refresh(ticket)
    return ticket
