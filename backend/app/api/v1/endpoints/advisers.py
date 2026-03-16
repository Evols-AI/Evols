"""
Skill Endpoints
AI Skills for PM tasks
(Routes kept as /advisers for backward compatibility)
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from datetime import datetime
import json

from app.core.database import get_db
from app.core.dependencies import get_current_tenant_id, get_current_user, get_tenant_llm_config
from app.models.user import User, UserRole
from app.models.adviser import (
    Adviser, CustomAdviser, AdviserSession, AdviserMessage,
    AdviserType, AdviserPhase, AdviserSessionEvaluation
)
from app.schemas.adviser import (
    AdviserResponse,
    AdviserListResponse,
    SessionCreateRequest,
    SessionResponse,
    SessionAnswersRequest,
    SessionChatRequest,
    SessionChatResponse,
    SessionEvaluationRequest,
    CustomAdviserCreate,
    CustomAdviserUpdate,
    CustomAdviserResponse,
)
from app.services.adviser_orchestrator import AdviserOrchestrator
from sqlalchemy import func

router = APIRouter()


# ===================================
# HELPER FUNCTIONS
# ===================================

async def get_next_sequence_number(session_id: str, db: AsyncSession) -> int:
    """Get the next sequence number for a message in this session"""
    result = await db.execute(
        select(func.coalesce(func.max(AdviserMessage.sequence_number), 0))
        .where(AdviserMessage.session_id == session_id)
    )
    max_seq = result.scalar()
    return (max_seq or 0) + 1


# ===================================
# USER ENDPOINTS
# ===================================

@router.get("/", response_model=AdviserListResponse)
async def list_available_advisers(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    """
    List all advisers available to the user.
    Includes default advisers + tenant's custom advisers.
    """
    # Get default advisers
    default_result = await db.execute(
        select(Adviser).where(Adviser.is_active == True)
    )
    default_advisers = default_result.scalars().all()

    # Get tenant's custom advisers
    custom_result = await db.execute(
        select(CustomAdviser).where(
            and_(
                CustomAdviser.tenant_id == tenant_id,
                CustomAdviser.is_active == True
            )
        )
    )
    custom_advisers = custom_result.scalars().all()

    # Format response
    advisers_list = []

    for adviser in default_advisers:
        advisers_list.append({
            "id": adviser.id,
            "type": "default",
            "name": adviser.name,
            "description": adviser.description,
            "icon": adviser.icon,
            "is_custom": False
        })

    for adviser in custom_advisers:
        advisers_list.append({
            "id": adviser.id,
            "type": "custom",
            "name": adviser.name,
            "description": adviser.description,
            "icon": adviser.icon,
            "is_custom": True
        })

    return {"advisers": advisers_list}


@router.post("/sessions", response_model=SessionResponse)
async def create_adviser_session(
    request: SessionCreateRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    """
    Start a new session with an adviser.
    Sends welcome message and first question conversationally.
    """
    orchestrator = AdviserOrchestrator()

    # Create session
    session = await orchestrator.create_session(
        adviser_id=request.adviser_id,
        adviser_type=AdviserType(request.adviser_type),
        user_id=current_user.id,
        tenant_id=tenant_id,
        db=db
    )

    # Get initial questions
    questions = await orchestrator.get_initial_questions(
        adviser_id=request.adviser_id,
        adviser_type=AdviserType(request.adviser_type),
        db=db
    )

    # Store questions in session metadata
    session.context_data = {
        "questions": questions,
        "answers": {},
        "current_question_index": 0
    }

    # Send welcome message and first question
    if questions and len(questions) > 0:
        welcome_msg = f"Hello! I'm here to help you. Let me ask you a few questions to get started.\n\n{questions[0]['question']}"

        # Save welcome message
        welcome_message = AdviserMessage(
            session_id=session.id,
            role="assistant",
            content=welcome_msg,
            sequence_number=1
        )
        db.add(welcome_message)

    await db.commit()
    await db.refresh(session)

    return {
        "session_id": session.id,
        "phase": session.phase.value,
        "initial_questions": None  # Not needed in conversational mode
    }


@router.post("/sessions/{session_id}/answers")
async def submit_initial_answers(
    session_id: str,
    request: SessionAnswersRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    tenant_config: dict = Depends(get_tenant_llm_config),
    current_user: User = Depends(get_current_user),
):
    """
    Submit answers to initial questions.
    Adviser will generate the initial output.
    """
    # Verify session belongs to user
    result = await db.execute(
        select(AdviserSession).where(
            and_(
                AdviserSession.id == session_id,
                AdviserSession.user_id == current_user.id
            )
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    orchestrator = AdviserOrchestrator()

    # Submit answers and generate output
    output = await orchestrator.submit_answers(
        session_id=session_id,
        answers=request.answers,
        tenant_id=tenant_id,
        tenant_config=tenant_config,
        db=db
    )

    # Refresh session
    await db.refresh(session)

    return {
        "session_id": session.id,
        "phase": session.phase.value,
        "output": output
    }


@router.post("/sessions/{session_id}/chat", response_model=SessionChatResponse)
async def chat_with_adviser(
    session_id: str,
    request: SessionChatRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    tenant_config: dict = Depends(get_tenant_llm_config),
    current_user: User = Depends(get_current_user),
):
    """
    Conversational chat with adviser.
    Handles question-asking, output generation, and refinement.
    """
    # Verify session
    result = await db.execute(
        select(AdviserSession).where(
            and_(
                AdviserSession.id == session_id,
                AdviserSession.user_id == current_user.id
            )
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get next sequence number
    user_seq = await get_next_sequence_number(session_id, db)

    # Save user message
    user_message = AdviserMessage(
        session_id=session_id,
        role="user",
        content=request.message,
        sequence_number=user_seq
    )
    db.add(user_message)
    await db.commit()

    # Check if we're still in question-asking phase
    if session.phase == AdviserPhase.INITIAL_GENERATION:
        context = session.context_data or {}
        questions = context.get("questions", [])
        answers = context.get("answers", {})
        current_idx = context.get("current_question_index", 0)

        if current_idx < len(questions):
            # Save the answer
            question_id = questions[current_idx].get("id")
            answers[question_id] = request.message

            # Move to next question
            current_idx += 1

            if current_idx < len(questions):
                # Ask next question
                next_question = questions[current_idx]["question"]
                response_content = next_question

                # Update context
                context["answers"] = answers
                context["current_question_index"] = current_idx
                session.context_data = context
                await db.commit()
            else:
                # All questions answered - generate output
                response_content = "Thank you! Let me analyze this and generate your output..."

                # Update context with final answers
                context["answers"] = answers
                session.context_data = context
                await db.commit()

                # Generate output
                orchestrator = AdviserOrchestrator()
                output = await orchestrator.submit_answers(
                    session_id=session_id,
                    answers=answers,
                    tenant_id=tenant_id,
                    tenant_config=tenant_config,
                    db=db
                )

                # Send output as message
                if output:
                    output_text = json.dumps(output, indent=2) if isinstance(output, dict) else str(output)
                    response_content += f"\n\n--- Generated Output ---\n\n{output_text}\n\nYou can now ask me to refine or modify this output!"

            # Save assistant response
            assistant_seq = await get_next_sequence_number(session_id, db)
            assistant_message = AdviserMessage(
                session_id=session_id,
                role="assistant",
                content=response_content,
                sequence_number=assistant_seq
            )
            db.add(assistant_message)
            await db.commit()

            return {
                "response": response_content,
                "sentiment": None,
                "sentiment_score": None
            }

    # Refinement phase (or after output generated)

    # Analyze sentiment of user message
    from app.services.sentiment_service import sentiment_analyzer
    from app.models.adviser import AdviserMessageSentiment

    sentiment_label, sentiment_score = sentiment_analyzer.analyze(request.message)

    orchestrator = AdviserOrchestrator()

    # Handle refinement
    response = await orchestrator.chat_refinement(
        session_id=session_id,
        user_message=request.message,
        tenant_id=tenant_id,
        tenant_config=tenant_config,
        db=db
    )

    # Find the user's message in the database to attach sentiment
    messages_result = await db.execute(
        select(AdviserMessage)
        .where(
            and_(
                AdviserMessage.session_id == session_id,
                AdviserMessage.role == 'user',
                AdviserMessage.content == request.message
            )
        )
        .order_by(AdviserMessage.created_at.desc())
        .limit(1)
    )
    user_message = messages_result.scalar_one_or_none()

    if user_message:
        # Save sentiment
        sentiment_record = AdviserMessageSentiment(
            message_id=user_message.id,
            sentiment_label=sentiment_label.value,
            sentiment_score=sentiment_score
        )
        db.add(sentiment_record)

    # Update last message time
    session.last_message_at = datetime.utcnow()
    await db.commit()

    # Refresh session to get updated output
    await db.refresh(session)

    return {
        "response": response,
        "updated_output": session.output_data,
        "sentiment": sentiment_label.value,
        "sentiment_score": sentiment_score
    }


@router.get("/sessions/history", response_model=List[SessionResponse])
async def get_session_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Get user's session history"""
    result = await db.execute(
        select(AdviserSession)
        .where(AdviserSession.user_id == current_user.id)
        .order_by(AdviserSession.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    sessions = result.scalars().all()

    return [
        {
            "session_id": s.id,
            "adviser_id": s.adviser_id,
            "adviser_type": s.adviser_type.value,
            "phase": s.phase.value,
            "session_name": s.session_name,
            "created_at": s.created_at.isoformat(),
            "last_message_at": s.last_message_at.isoformat() if s.last_message_at else None
        }
        for s in sessions
    ]


@router.get("/sessions/{session_id}")
async def get_session_details(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full session details including conversation"""
    result = await db.execute(
        select(AdviserSession).where(
            and_(
                AdviserSession.id == session_id,
                AdviserSession.user_id == current_user.id
            )
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get messages
    messages_result = await db.execute(
        select(AdviserMessage)
        .where(AdviserMessage.session_id == session_id)
        .order_by(AdviserMessage.sequence_number)
    )
    messages = messages_result.scalars().all()

    # If still in initial_generation phase, include questions
    initial_questions = None
    if session.phase == AdviserPhase.INITIAL_GENERATION:
        orchestrator = AdviserOrchestrator()
        initial_questions = await orchestrator.get_initial_questions(
            adviser_id=session.adviser_id,
            adviser_type=session.adviser_type,
            db=db
        )

    return {
        "session_id": session.id,
        "adviser_id": session.adviser_id,
        "adviser_type": session.adviser_type.value,
        "phase": session.phase.value,
        "context_data": session.context_data,
        "output_data": session.output_data,
        "created_at": session.created_at.isoformat(),
        "initial_questions": initial_questions,
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat()
            }
            for m in messages
        ]
    }


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an adviser session"""
    # Verify session belongs to user
    result = await db.execute(
        select(AdviserSession).where(
            and_(
                AdviserSession.id == session_id,
                AdviserSession.user_id == current_user.id
            )
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Delete session (cascade will handle messages, evaluations, sentiment)
    await db.delete(session)
    await db.commit()

    return {"message": "Session deleted successfully"}


@router.post("/sessions/{session_id}/evaluate")
async def evaluate_session(
    session_id: str,
    request: SessionEvaluationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit feedback on adviser session"""
    # Verify session
    result = await db.execute(
        select(AdviserSession).where(
            and_(
                AdviserSession.id == session_id,
                AdviserSession.user_id == current_user.id
            )
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Save evaluation
    evaluation = AdviserSessionEvaluation(
        session_id=session_id,
        user_id=current_user.id,
        rating=request.rating,
        helpful=request.helpful,
        feedback_text=request.feedback_text
    )

    db.add(evaluation)

    # Mark session as completed
    session.phase = AdviserPhase.COMPLETED
    await db.commit()

    return {"message": "Feedback submitted successfully"}


@router.put("/sessions/{session_id}")
async def update_session(
    session_id: str,
    session_name: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update session metadata"""
    result = await db.execute(
        select(AdviserSession).where(
            and_(
                AdviserSession.id == session_id,
                AdviserSession.user_id == current_user.id
            )
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session_name:
        session.session_name = session_name

    await db.commit()

    return {"message": "Session updated"}


@router.get("/sessions/{session_id}/export/markdown")
async def export_session_markdown(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export session output as Markdown"""
    from fastapi.responses import Response
    import json

    # Get session
    result = await db.execute(
        select(AdviserSession).where(
            and_(
                AdviserSession.id == session_id,
                AdviserSession.user_id == current_user.id
            )
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get adviser name
    if session.adviser_type == AdviserType.DEFAULT:
        adviser_result = await db.execute(
            select(Adviser).where(Adviser.id == session.adviser_id)
        )
        adviser = adviser_result.scalar_one_or_none()
    else:
        adviser_result = await db.execute(
            select(CustomAdviser).where(CustomAdviser.id == session.adviser_id)
        )
        adviser = adviser_result.scalar_one_or_none()

    adviser_name = adviser.name if adviser else "Unknown Adviser"

    # Build markdown
    markdown = f"""# {adviser_name} - Session Report

**Session ID:** {session.id}
**Created:** {session.created_at.strftime('%Y-%m-%d %H:%M:%S')}
**Status:** {session.phase.value}

---

## Context

"""

    if session.context_data:
        for key, value in session.context_data.items():
            markdown += f"**{key}:** {value}\n\n"

    markdown += "\n---\n\n## Output\n\n"

    if session.output_data:
        if isinstance(session.output_data, dict):
            markdown += f"```json\n{json.dumps(session.output_data, indent=2)}\n```\n"
        else:
            markdown += str(session.output_data)
    else:
        markdown += "*No output generated yet*\n"

    markdown += f"\n\n---\n\n*Generated by Evols on {datetime.utcnow().strftime('%Y-%m-%d')}*\n"

    return Response(
        content=markdown,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename=session-{session_id[:8]}.md"
        }
    )


@router.get("/sessions/{session_id}/export/json")
async def export_session_json(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export session as JSON"""
    from fastapi.responses import Response
    import json

    # Get session
    result = await db.execute(
        select(AdviserSession).where(
            and_(
                AdviserSession.id == session_id,
                AdviserSession.user_id == current_user.id
            )
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get messages
    messages_result = await db.execute(
        select(AdviserMessage)
        .where(AdviserMessage.session_id == session_id)
        .order_by(AdviserMessage.sequence_number)
    )
    messages = messages_result.scalars().all()

    export_data = {
        "session_id": session.id,
        "adviser_id": session.adviser_id,
        "adviser_type": session.adviser_type.value,
        "phase": session.phase.value,
        "created_at": session.created_at.isoformat(),
        "context": session.context_data,
        "output": session.output_data,
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat()
            }
            for m in messages
        ]
    }

    return Response(
        content=json.dumps(export_data, indent=2),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=session-{session_id[:8]}.json"
        }
    )


# ===================================
# TENANT ADMIN ENDPOINTS
# ===================================

def require_tenant_admin(current_user: User = Depends(get_current_user)):
    """Dependency to require tenant admin or higher"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/admin/custom", response_model=List[CustomAdviserResponse])
async def list_custom_advisers(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(require_tenant_admin),
):
    """List tenant's custom advisers"""
    result = await db.execute(
        select(CustomAdviser).where(CustomAdviser.tenant_id == tenant_id)
    )
    advisers = result.scalars().all()

    return [
        {
            "id": a.id,
            "name": a.name,
            "description": a.description,
            "icon": a.icon,
            "source_adviser_id": a.source_adviser_id,
            "is_active": a.is_active,
            "created_at": a.created_at.isoformat()
        }
        for a in advisers
    ]


@router.get("/admin/default/{adviser_id}")
async def get_default_adviser_details(
    adviser_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_tenant_admin),
):
    """Get full details of a default adviser (read-only)"""
    result = await db.execute(
        select(Adviser).where(Adviser.id == adviser_id)
    )
    adviser = result.scalar_one_or_none()

    if not adviser:
        raise HTTPException(status_code=404, detail="Default adviser not found")

    return {
        "id": adviser.id,
        "name": adviser.name,
        "description": adviser.description,
        "icon": adviser.icon,
        "tools": adviser.tools,
        "initial_questions": adviser.initial_questions,
        "task_definitions": adviser.task_definitions,
        "instructions": adviser.instructions,
        "output_template": adviser.output_template,
        "is_active": adviser.is_active,
        "created_at": adviser.created_at.isoformat(),
        "updated_at": adviser.updated_at.isoformat()
    }


@router.post("/admin/custom", response_model=CustomAdviserResponse)
async def create_custom_adviser(
    request: CustomAdviserCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(require_tenant_admin),
):
    """Create a new custom adviser (or clone from default)"""
    adviser = CustomAdviser(
        tenant_id=tenant_id,
        source_adviser_id=request.source_adviser_id,
        name=request.name,
        description=request.description,
        icon=request.icon,
        tools=request.tools,
        initial_questions=request.initial_questions,
        task_definitions=request.task_definitions,
        instructions=request.instructions,
        output_template=request.output_template,
        created_by_user_id=current_user.id
    )

    db.add(adviser)
    await db.commit()
    await db.refresh(adviser)

    return {
        "id": adviser.id,
        "name": adviser.name,
        "description": adviser.description,
        "icon": adviser.icon,
        "source_adviser_id": adviser.source_adviser_id,
        "is_active": adviser.is_active,
        "created_at": adviser.created_at.isoformat()
    }


@router.post("/admin/clone/{adviser_id}")
async def clone_default_adviser(
    adviser_id: int,
    new_name: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(require_tenant_admin),
):
    """Clone a default adviser to create custom version"""
    # Get default adviser
    result = await db.execute(
        select(Adviser).where(Adviser.id == adviser_id)
    )
    default_adviser = result.scalar_one_or_none()

    if not default_adviser:
        raise HTTPException(status_code=404, detail="Adviser not found")

    # Create custom copy
    custom = CustomAdviser(
        tenant_id=tenant_id,
        source_adviser_id=adviser_id,
        name=new_name or f"{default_adviser.name} (Custom)",
        description=default_adviser.description,
        icon=default_adviser.icon,
        tools=default_adviser.tools,
        initial_questions=default_adviser.initial_questions,
        task_definitions=default_adviser.task_definitions,
        instructions=default_adviser.instructions,
        output_template=default_adviser.output_template,
        created_by_user_id=current_user.id
    )

    db.add(custom)
    await db.commit()
    await db.refresh(custom)

    return {
        "id": custom.id,
        "message": "Adviser cloned successfully"
    }


@router.get("/admin/custom/{adviser_id}")
async def get_custom_adviser(
    adviser_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(require_tenant_admin),
):
    """Get a single custom adviser with full configuration"""
    result = await db.execute(
        select(CustomAdviser).where(
            and_(
                CustomAdviser.id == adviser_id,
                CustomAdviser.tenant_id == tenant_id
            )
        )
    )
    adviser = result.scalar_one_or_none()

    if not adviser:
        raise HTTPException(status_code=404, detail="Adviser not found")

    return {
        "id": adviser.id,
        "name": adviser.name,
        "description": adviser.description,
        "icon": adviser.icon,
        "source_adviser_id": adviser.source_adviser_id,
        "is_active": adviser.is_active,
        "tools": adviser.tools,
        "initial_questions": adviser.initial_questions,
        "task_definitions": adviser.task_definitions,
        "instructions": adviser.instructions,
        "output_template": adviser.output_template,
        "created_at": adviser.created_at.isoformat()
    }


@router.put("/admin/custom/{adviser_id}")
async def update_custom_adviser(
    adviser_id: int,
    request: CustomAdviserUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(require_tenant_admin),
):
    """Update a custom adviser and save version history"""
    from app.models.adviser import CustomAdviserVersion

    result = await db.execute(
        select(CustomAdviser).where(
            and_(
                CustomAdviser.id == adviser_id,
                CustomAdviser.tenant_id == tenant_id
            )
        )
    )
    adviser = result.scalar_one_or_none()

    if not adviser:
        raise HTTPException(status_code=404, detail="Adviser not found")

    # Save current config as version before updating
    # Get current version number
    version_count_result = await db.execute(
        select(CustomAdviserVersion)
        .where(CustomAdviserVersion.custom_adviser_id == adviser_id)
    )
    existing_versions = version_count_result.scalars().all()
    next_version = len(existing_versions) + 1

    # Create version snapshot
    version = CustomAdviserVersion(
        custom_adviser_id=adviser_id,
        version_number=next_version,
        tools=adviser.tools,
        initial_questions=adviser.initial_questions,
        task_definitions=adviser.task_definitions,
        instructions=adviser.instructions,
        output_template=adviser.output_template,
        change_description=f"Updated via UI",
        created_by_user_id=current_user.id
    )
    db.add(version)

    # Update fields
    if request.name:
        adviser.name = request.name
    if request.description is not None:
        adviser.description = request.description
    if request.icon:
        adviser.icon = request.icon
    if request.tools is not None:
        adviser.tools = request.tools
    if request.initial_questions is not None:
        adviser.initial_questions = request.initial_questions
    if request.task_definitions is not None:
        adviser.task_definitions = request.task_definitions
    if request.instructions:
        adviser.instructions = request.instructions
    if request.output_template is not None:
        adviser.output_template = request.output_template
    if request.is_active is not None:
        adviser.is_active = request.is_active

    await db.commit()

    return {"message": "Adviser updated successfully"}


@router.delete("/admin/custom/{adviser_id}")
async def delete_custom_adviser(
    adviser_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(require_tenant_admin),
):
    """Delete a custom adviser"""
    result = await db.execute(
        select(CustomAdviser).where(
            and_(
                CustomAdviser.id == adviser_id,
                CustomAdviser.tenant_id == tenant_id
            )
        )
    )
    adviser = result.scalar_one_or_none()

    if not adviser:
        raise HTTPException(status_code=404, detail="Adviser not found")

    await db.delete(adviser)
    await db.commit()

    return {"message": "Adviser deleted successfully"}


@router.get("/admin/custom/{adviser_id}/versions")
async def list_adviser_versions(
    adviser_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(require_tenant_admin),
):
    """List version history for a custom adviser"""
    from app.models.adviser import CustomAdviserVersion

    # Verify adviser belongs to tenant
    adviser_result = await db.execute(
        select(CustomAdviser).where(
            and_(
                CustomAdviser.id == adviser_id,
                CustomAdviser.tenant_id == tenant_id
            )
        )
    )
    adviser = adviser_result.scalar_one_or_none()

    if not adviser:
        raise HTTPException(status_code=404, detail="Adviser not found")

    # Get versions
    versions_result = await db.execute(
        select(CustomAdviserVersion)
        .where(CustomAdviserVersion.custom_adviser_id == adviser_id)
        .order_by(CustomAdviserVersion.version_number.desc())
    )
    versions = versions_result.scalars().all()

    return {
        "versions": [
            {
                "id": v.id,
                "version_number": v.version_number,
                "change_description": v.change_description,
                "created_at": v.created_at.isoformat(),
                "created_by_user_id": v.created_by_user_id
            }
            for v in versions
        ]
    }


@router.post("/admin/custom/{adviser_id}/restore/{version_id}")
async def restore_adviser_version(
    adviser_id: int,
    version_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(require_tenant_admin),
):
    """Restore a custom adviser to a specific version"""
    from app.models.adviser import CustomAdviserVersion

    # Verify adviser belongs to tenant
    adviser_result = await db.execute(
        select(CustomAdviser).where(
            and_(
                CustomAdviser.id == adviser_id,
                CustomAdviser.tenant_id == tenant_id
            )
        )
    )
    adviser = adviser_result.scalar_one_or_none()

    if not adviser:
        raise HTTPException(status_code=404, detail="Adviser not found")

    # Get version
    version_result = await db.execute(
        select(CustomAdviserVersion).where(
            and_(
                CustomAdviserVersion.id == version_id,
                CustomAdviserVersion.custom_adviser_id == adviser_id
            )
        )
    )
    version = version_result.scalar_one_or_none()

    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Save current state as new version before restoring
    version_count_result = await db.execute(
        select(CustomAdviserVersion)
        .where(CustomAdviserVersion.custom_adviser_id == adviser_id)
    )
    existing_versions = version_count_result.scalars().all()
    next_version = len(existing_versions) + 1

    backup_version = CustomAdviserVersion(
        custom_adviser_id=adviser_id,
        version_number=next_version,
        tools=adviser.tools,
        initial_questions=adviser.initial_questions,
        task_definitions=adviser.task_definitions,
        instructions=adviser.instructions,
        output_template=adviser.output_template,
        change_description=f"Backup before restoring to version {version.version_number}",
        created_by_user_id=current_user.id
    )
    db.add(backup_version)

    # Restore from version
    adviser.tools = version.tools
    adviser.initial_questions = version.initial_questions
    adviser.task_definitions = version.task_definitions
    adviser.instructions = version.instructions
    adviser.output_template = version.output_template

    await db.commit()

    return {"message": f"Adviser restored to version {version.version_number}"}


# ===================================
# SUPER ADMIN ENDPOINTS (Platform-level)
# ===================================

def require_super_admin(current_user: User = Depends(get_current_user)):
    """Dependency to require super admin"""
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super admin access required")
    return current_user


@router.get("/platform/advisers")
async def list_default_advisers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """List all default advisers (SUPER_ADMIN only)"""
    result = await db.execute(select(Adviser))
    advisers = result.scalars().all()

    return {
        "advisers": [
            {
                "id": a.id,
                "name": a.name,
                "description": a.description,
                "icon": a.icon,
                "is_active": a.is_active,
                "created_at": a.created_at.isoformat()
            }
            for a in advisers
        ]
    }


@router.get("/platform/analytics")
async def get_platform_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Get platform-wide adviser analytics"""
    from sqlalchemy import func

    # Total sessions
    total_sessions = await db.execute(
        select(func.count(AdviserSession.id))
    )

    # Sessions by phase
    sessions_by_phase = await db.execute(
        select(
            AdviserSession.phase,
            func.count(AdviserSession.id)
        ).group_by(AdviserSession.phase)
    )

    # Average rating
    avg_rating = await db.execute(
        select(func.avg(AdviserSessionEvaluation.rating))
        .where(AdviserSessionEvaluation.rating.isnot(None))
    )

    # Completion rate
    completed = await db.execute(
        select(func.count(AdviserSession.id))
        .where(AdviserSession.phase == AdviserPhase.COMPLETED)
    )

    return {
        "total_sessions": total_sessions.scalar() or 0,
        "sessions_by_phase": dict(sessions_by_phase.all()),
        "average_rating": float(avg_rating.scalar() or 0),
        "completed_sessions": completed.scalar() or 0,
        "completion_rate": (completed.scalar() or 0) / max(total_sessions.scalar() or 1, 1) * 100
    }


@router.get("/platform/evaluations")
async def get_all_evaluations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Get all session evaluations across platform"""
    result = await db.execute(
        select(AdviserSessionEvaluation)
        .order_by(AdviserSessionEvaluation.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    evaluations = result.scalars().all()

    return {
        "evaluations": [
            {
                "id": e.id,
                "session_id": e.session_id,
                "user_id": e.user_id,
                "rating": e.rating,
                "helpful": e.helpful,
                "feedback_text": e.feedback_text,
                "created_at": e.created_at.isoformat()
            }
            for e in evaluations
        ]
    }


@router.get("/platform/experiments")
async def list_experiments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """List all A/B experiments"""
    from app.models.adviser import AdviserExperiment

    result = await db.execute(select(AdviserExperiment))
    experiments = result.scalars().all()

    return {
        "experiments": [
            {
                "id": e.id,
                "adviser_id": e.adviser_id,
                "name": e.name,
                "status": e.status.value,
                "optimization_strategy": e.optimization_strategy.value,
                "created_at": e.created_at.isoformat()
            }
            for e in experiments
        ]
    }


# Export router
__all__ = ['router']
