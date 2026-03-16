"""
Copilot conversation cleanup utilities
Removes empty or greeting-only conversations
"""

from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.adviser import AdviserConversation, AdviserMessage


router = APIRouter()


async def cleanup_empty_conversations(db: AsyncSession, user_id: int = None):
    """
    Clean up conversations that have:
    1. Zero messages
    2. Only greeting messages (no user input)
    3. Created >5 minutes ago with no activity

    Returns count of deleted conversations
    """
    deleted_count = 0

    # Build base query
    query = select(AdviserConversation)
    if user_id:
        query = query.where(AdviserConversation.user_id == user_id)

    # Get all conversations
    result = await db.execute(query)
    conversations = result.scalars().all()

    for conv in conversations:
        should_delete = False

        # Get messages for this conversation
        msg_result = await db.execute(
            select(AdviserMessage)
            .where(AdviserMessage.conversation_id == conv.id)
            .order_by(AdviserMessage.sequence_number)
        )
        messages = msg_result.scalars().all()

        # Case 1: No messages at all
        if len(messages) == 0:
            # Delete if created more than 5 minutes ago (grace period)
            if datetime.utcnow() - conv.created_at > timedelta(minutes=5):
                should_delete = True

        # Case 2: Only one message and it's from assistant (greeting only)
        elif len(messages) == 1 and messages[0].role == 'assistant':
            # Delete if created more than 5 minutes ago
            if datetime.utcnow() - conv.created_at > timedelta(minutes=5):
                should_delete = True

        # Case 3: No user messages at all (only assistant messages)
        elif len(messages) > 0:
            has_user_message = any(msg.role == 'user' for msg in messages)
            if not has_user_message:
                # Delete if created more than 5 minutes ago
                if datetime.utcnow() - conv.created_at > timedelta(minutes=5):
                    should_delete = True

        if should_delete:
            await db.delete(conv)
            deleted_count += 1

    if deleted_count > 0:
        await db.commit()

    return deleted_count


@router.post("/cleanup")
async def cleanup_my_conversations(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Clean up empty conversations for current user
    Runs in background to avoid blocking
    """
    # Run cleanup in background
    background_tasks.add_task(cleanup_empty_conversations, db, current_user.id)

    return {
        "message": "Cleanup started in background",
        "status": "processing"
    }


@router.get("/cleanup/count")
async def count_empty_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Count how many empty conversations exist for current user
    """
    # Get all conversations
    result = await db.execute(
        select(AdviserConversation)
        .where(AdviserConversation.user_id == current_user.id)
    )
    conversations = result.scalars().all()

    empty_count = 0
    greeting_only_count = 0
    no_user_messages_count = 0

    for conv in conversations:
        # Get messages
        msg_result = await db.execute(
            select(AdviserMessage)
            .where(AdviserMessage.conversation_id == conv.id)
        )
        messages = msg_result.scalars().all()

        if len(messages) == 0:
            empty_count += 1
        elif len(messages) == 1 and messages[0].role == 'assistant':
            greeting_only_count += 1
        elif not any(msg.role == 'user' for msg in messages):
            no_user_messages_count += 1

    return {
        "total_conversations": len(conversations),
        "empty_conversations": empty_count,
        "greeting_only": greeting_only_count,
        "no_user_messages": no_user_messages_count,
        "total_to_clean": empty_count + greeting_only_count + no_user_messages_count
    }
