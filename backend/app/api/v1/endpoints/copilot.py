"""
Copilot API Endpoints
Main chat interface for AI copilot with auto-routing to advisers
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.adviser import AdviserConversation, AdviserMessage, Adviser, CustomAdviser, AdviserType
from app.services.copilot_orchestrator import CopilotOrchestrator


router = APIRouter()


# ===================================
# REQUEST/RESPONSE MODELS
# ===================================

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    product_id: Optional[int] = None  # Filter tools by product


class AdviserInfo(BaseModel):
    id: int
    type: str
    name: str
    description: str
    icon: str


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    adviser: Optional[AdviserInfo] = None
    created_at: str


class ChatResponse(BaseModel):
    conversation_id: str
    message: MessageResponse


class ConversationListItem(BaseModel):
    id: str
    name: Optional[str]
    last_message_at: Optional[datetime]
    created_at: datetime
    message_count: int
    last_message_preview: Optional[str] = None


class ConversationDetail(BaseModel):
    id: str
    name: Optional[str]
    created_at: datetime
    last_message_at: Optional[datetime]
    messages: List[MessageResponse]


class AdviserListItem(BaseModel):
    id: int
    type: str
    name: str
    description: str
    icon: str
    is_custom: bool


# ===================================
# ENDPOINTS
# ===================================

@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a message to the AI copilot.
    Can include @mention to invoke specific adviser.
    """
    orchestrator = CopilotOrchestrator(db, current_user)

    try:
        result = await orchestrator.chat(
            conversation_id=request.conversation_id,
            message=request.message,
            product_id=request.product_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@router.get("/conversations", response_model=List[ConversationListItem])
async def list_conversations(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List user's conversations
    """
    result = await db.execute(
        select(AdviserConversation)
        .where(AdviserConversation.user_id == current_user.id)
        .order_by(desc(AdviserConversation.last_message_at))
        .limit(limit)
        .offset(offset)
    )
    conversations = result.scalars().all()

    response = []
    for conv in conversations:
        # Get message count
        msg_result = await db.execute(
            select(AdviserMessage)
            .where(AdviserMessage.conversation_id == conv.id)
        )
        messages = msg_result.scalars().all()
        message_count = len(messages)

        # Get last message preview
        last_msg = messages[-1] if messages else None
        last_preview = None
        if last_msg and last_msg.role == 'assistant':
            last_preview = last_msg.content[:100] + "..." if len(last_msg.content) > 100 else last_msg.content

        response.append(ConversationListItem(
            id=conv.id,
            name=conv.session_name,
            last_message_at=conv.last_message_at,
            created_at=conv.created_at,
            message_count=message_count,
            last_message_preview=last_preview
        ))

    return response


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get conversation details with full message history
    """
    # Get conversation
    result = await db.execute(
        select(AdviserConversation).where(AdviserConversation.id == conversation_id)
    )
    conversation = result.scalars().first()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get messages
    result = await db.execute(
        select(AdviserMessage)
        .where(AdviserMessage.conversation_id == conversation_id)
        .order_by(AdviserMessage.sequence_number)
    )
    messages = result.scalars().all()

    # Format messages
    formatted_messages = []
    for msg in messages:
        adviser_info = None
        if msg.skill_id:
            if msg.skill_type == AdviserType.CUSTOM:
                adviser_result = await db.execute(
                    select(CustomAdviser).where(CustomAdviser.id == msg.skill_id)
                )
                adviser = adviser_result.scalars().first()
            else:
                adviser_result = await db.execute(
                    select(Adviser).where(Adviser.id == msg.skill_id)
                )
                adviser = adviser_result.scalars().first()

            if adviser:
                adviser_info = AdviserInfo(
                    id=adviser.id,
                    type=msg.skill_type,
                    name=adviser.name,
                    description=adviser.description,
                    icon=adviser.icon
                )

        formatted_messages.append(MessageResponse(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            adviser=adviser_info,
            created_at=msg.created_at.isoformat()
        ))

    return ConversationDetail(
        id=conversation.id,
        name=conversation.session_name,
        created_at=conversation.created_at,
        last_message_at=conversation.last_message_at,
        messages=formatted_messages
    )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a conversation
    """
    result = await db.execute(
        select(AdviserConversation).where(AdviserConversation.id == conversation_id)
    )
    conversation = result.scalars().first()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(conversation)
    await db.commit()

    return {"message": "Conversation deleted successfully"}


@router.get("/advisers", response_model=List[AdviserListItem])
async def list_available_advisers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all available advisers for @mention autocomplete
    """
    advisers = []

    # Get default advisers
    result = await db.execute(
        select(Adviser).where(Adviser.is_active == True)
    )
    default_advisers = result.scalars().all()

    for adviser in default_advisers:
        advisers.append(AdviserListItem(
            id=adviser.id,
            type=AdviserType.DEFAULT,
            name=adviser.name,
            description=adviser.description,
            icon=adviser.icon,
            is_custom=False
        ))

    # Get custom advisers for this tenant
    result = await db.execute(
        select(CustomAdviser)
        .where(CustomAdviser.tenant_id == current_user.tenant_id)
        .where(CustomAdviser.is_active == True)
    )
    custom_advisers = result.scalars().all()

    for adviser in custom_advisers:
        advisers.append(AdviserListItem(
            id=adviser.id,
            type=AdviserType.CUSTOM,
            name=adviser.name,
            description=adviser.description,
            icon=adviser.icon,
            is_custom=True
        ))

    return advisers
