"""
Copilot API Endpoints
Main chat interface for AI copilot with auto-routing to skills
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import io

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.skill import SkillConversation, SkillMessage, Skill, CustomSkill, SkillType
from app.services.copilot_orchestrator import CopilotOrchestrator
from app.services.intelligent_copilot import IntelligentCopilot


router = APIRouter()


# ===================================
# REQUEST/RESPONSE MODELS
# ===================================

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    product_id: Optional[int] = None  # Filter tools by product


class SkillInfo(BaseModel):
    id: int
    type: str
    name: str
    description: str
    icon: str


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    skill: Optional[SkillInfo] = None
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


class SkillListItem(BaseModel):
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
    Send a message to the AI copilot with intelligent skill routing.
    Uses Cline-style context-aware decision making.
    """
    # Use new intelligent copilot with full context awareness
    copilot = IntelligentCopilot(db, current_user)

    try:
        # Note: Errors during message processing (after user message is saved)
        # are caught by IntelligentCopilot.chat and saved as error messages
        # in the conversation, so they return as successful responses
        result = await copilot.chat(
            conversation_id=request.conversation_id,
            message=request.message,
            product_id=request.product_id
        )
        return result
    except Exception as e:
        # Only errors before user message is saved reach here
        # (e.g., database errors, validation errors)
        import traceback
        from loguru import logger
        logger.error(f"[Copilot Chat] Error: {e}")
        logger.error(f"[Copilot Chat] Traceback: {traceback.format_exc()}")
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
        select(SkillConversation)
        .where(SkillConversation.user_id == current_user.id)
        .order_by(desc(SkillConversation.last_message_at))
        .limit(limit)
        .offset(offset)
    )
    conversations = result.scalars().all()

    response = []
    for conv in conversations:
        # Get message count
        msg_result = await db.execute(
            select(SkillMessage)
            .where(SkillMessage.conversation_id == conv.id)
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
        select(SkillConversation).where(SkillConversation.id == conversation_id)
    )
    conversation = result.scalars().first()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get messages
    result = await db.execute(
        select(SkillMessage)
        .where(SkillMessage.conversation_id == conversation_id)
        .order_by(SkillMessage.sequence_number)
    )
    messages = result.scalars().all()

    # Format messages
    formatted_messages = []
    for msg in messages:
        skill_info = None
        if msg.skill_id:
            if msg.skill_type == SkillType.CUSTOM:
                skill_result = await db.execute(
                    select(CustomSkill).where(CustomSkill.id == msg.skill_id)
                )
                skill = skill_result.scalars().first()
            else:
                skill_result = await db.execute(
                    select(Skill).where(Skill.id == msg.skill_id)
                )
                skill = skill_result.scalars().first()

            if skill:
                skill_info = SkillInfo(
                    id=skill.id,
                    type=msg.skill_type,
                    name=skill.name,
                    description=skill.description,
                    icon=skill.icon
                )

        formatted_messages.append(MessageResponse(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            skill=skill_info,
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
        select(SkillConversation).where(SkillConversation.id == conversation_id)
    )
    conversation = result.scalars().first()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(conversation)
    await db.commit()

    return {"message": "Conversation deleted successfully"}


@router.get("/skills", response_model=List[SkillListItem])
async def list_available_skills(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all available skills for @mention autocomplete
    """
    from app.services.skill_loader_service import get_skill_loader

    skills = []

    # Get default skills from files
    skill_loader = get_skill_loader()
    file_skills = skill_loader.get_all_skills()

    for idx, skill in enumerate(file_skills, start=1):
        skills.append(SkillListItem(
            id=idx,  # Use index as ID for file-based skills
            type=SkillType.DEFAULT,
            name=skill['name'],
            description=skill.get('description', ''),
            icon='⚡',  # Default icon for file-based skills
            is_custom=False
        ))

    # Get custom skills for this tenant
    result = await db.execute(
        select(CustomSkill)
        .where(CustomSkill.tenant_id == current_user.tenant_id)
        .where(CustomSkill.is_active == True)
    )
    custom_skills = result.scalars().all()

    for skill in custom_skills:
        skills.append(SkillListItem(
            id=skill.id + 10000,  # Offset custom skill IDs to avoid conflicts
            type=SkillType.CUSTOM,
            name=skill.name,
            description=skill.description,
            icon=skill.icon,
            is_custom=True
        ))

    return skills


@router.get("/skills/{skill_name}")
async def get_skill_details(
    skill_name: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get full details for a specific skill including instructions
    """
    from app.services.skill_loader_service import get_skill_loader

    skill_loader = get_skill_loader()
    skill_data = skill_loader.get_skill_by_name(skill_name)

    if not skill_data:
        raise HTTPException(status_code=404, detail="Skill not found")

    return skill_data


# ===================================
# ARTIFACT CLASSIFICATION
# ===================================

class ClassifyArtifactsRequest(BaseModel):
    content: str

class ArtifactInfo(BaseModel):
    type: str  # "document" or "flowchart"
    title: str
    contentStart: str
    contentEnd: str

class ClassifyArtifactsResponse(BaseModel):
    artifacts: List[ArtifactInfo]


@router.post("/classify-artifacts", response_model=ClassifyArtifactsResponse)
async def classify_artifacts(
    request: ClassifyArtifactsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Use LLM to intelligently classify artifacts in AI response content.
    Supports multiple artifacts in one response.
    """
    try:
        orchestrator = CopilotOrchestrator(db, current_user)
        llm_service = await orchestrator.get_llm_service()

        classification_prompt = f"""Analyze this AI response and identify artifacts that should be created.

Response: "{request.content}"

Look for distinct sections that should become artifacts:
- **Documents**: Structured text content (PRDs, strategies, analyses, 1-pagers, etc.)
- **Flowcharts**: Visual diagrams, process flows, user journeys, workflows

For each artifact found, output ONE line in this exact format:
type|title|content_start|content_end

Where:
- type: "flowchart" or "document"
- title: Descriptive name (e.g., "Animated Product Tour PRD", "User Onboarding Journey")
- content_start: First few words where this artifact begins (e.g., "**Animated Product Tour PRD**")
- content_end: Last few words where this artifact ends (e.g., "## Next Steps", leave empty if goes to end)

Examples:
document|Animated Product Tour PRD|**Animated Product Tour PRD**|## Next Steps
flowchart|User Onboarding Journey|User discovers product|User becomes active user
document|Technical Requirements|## Technical Specs|

If no artifacts needed, output: none

IMPORTANT: Only create artifacts for substantial, structured content. Skip conversational responses.

NEVER create artifacts for:
- PM setup conversations or workspace summaries
- Status updates or progress reports
- Simple Q&A responses
- Confirmations of data capture
- Tables or lists that are part of conversation flow
- Anything under 200 words unless it's a complete deliverable"""

        response = await llm_service.generate(
            prompt=classification_prompt,
            system_prompt="You are an artifact classifier. Output the exact format requested. Be precise with content markers.",
            temperature=0.1,
            max_tokens=500
        )

        # Parse LLM response
        artifacts = []
        lines = response.content.strip().split('\n')

        for line in lines:
            line = line.strip()
            if not line or line.lower() == 'none':
                continue

            parts = line.split('|')
            if len(parts) >= 3:
                artifact_type = parts[0].strip()
                title = parts[1].strip()
                content_start = parts[2].strip() if len(parts) > 2 else ""
                content_end = parts[3].strip() if len(parts) > 3 else ""

                if artifact_type in ['document', 'flowchart'] and title:
                    artifacts.append(ArtifactInfo(
                        type=artifact_type,
                        title=title,
                        contentStart=content_start,
                        contentEnd=content_end
                    ))

        return ClassifyArtifactsResponse(artifacts=artifacts)

    except Exception as e:
        # Don't fail hard - frontend has fallback
        return ClassifyArtifactsResponse(artifacts=[])
