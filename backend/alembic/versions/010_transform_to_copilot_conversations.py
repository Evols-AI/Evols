"""transform to copilot conversations

Revision ID: 010
Revises: 009
Create Date: 2026-03-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade():
    # ========================================
    # STEP 1: Rename tables
    # ========================================
    op.rename_table('adviser_sessions', 'conversations')
    op.rename_table('adviser_messages', 'messages')

    # ========================================
    # STEP 2: Update foreign key references in related tables
    # ========================================

    # Update adviser_session_evaluations
    op.drop_constraint('adviser_session_evaluations_session_id_fkey', 'adviser_session_evaluations', type_='foreignkey')
    op.create_foreign_key(
        'adviser_session_evaluations_session_id_fkey',
        'adviser_session_evaluations', 'conversations',
        ['session_id'], ['id'],
        ondelete='CASCADE'
    )

    # Update adviser_message_sentiment
    op.drop_constraint('adviser_message_sentiment_session_id_fkey', 'adviser_message_sentiment', type_='foreignkey')
    op.drop_constraint('adviser_message_sentiment_message_id_fkey', 'adviser_message_sentiment', type_='foreignkey')
    op.create_foreign_key(
        'adviser_message_sentiment_session_id_fkey',
        'adviser_message_sentiment', 'conversations',
        ['session_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'adviser_message_sentiment_message_id_fkey',
        'adviser_message_sentiment', 'messages',
        ['message_id'], ['id'],
        ondelete='CASCADE'
    )

    # Update adviser_session_variants
    op.drop_constraint('adviser_session_variants_session_id_fkey', 'adviser_session_variants', type_='foreignkey')
    op.create_foreign_key(
        'adviser_session_variants_session_id_fkey',
        'adviser_session_variants', 'conversations',
        ['session_id'], ['id'],
        ondelete='CASCADE'
    )

    # Update messages table foreign key
    op.drop_constraint('adviser_messages_session_id_fkey', 'messages', type_='foreignkey')
    op.create_foreign_key(
        'messages_conversation_id_fkey',
        'messages', 'conversations',
        ['session_id'], ['id'],
        ondelete='CASCADE'
    )

    # ========================================
    # STEP 3: Rename session_id to conversation_id in messages
    # ========================================
    op.alter_column('messages', 'session_id', new_column_name='conversation_id')

    # ========================================
    # STEP 4: Add adviser_id to messages (nullable)
    # ========================================
    op.add_column('messages', sa.Column('adviser_id', sa.Integer(), nullable=True))
    op.add_column('messages', sa.Column('adviser_type', sa.String(20), nullable=True))

    # Migrate existing data: set adviser_id on all assistant messages based on conversation
    op.execute("""
        UPDATE messages m
        SET adviser_id = c.adviser_id,
            adviser_type = c.adviser_type
        FROM conversations c
        WHERE m.conversation_id = c.id
        AND m.role = 'assistant'
    """)

    # ========================================
    # STEP 5: Add metadata column to messages
    # ========================================
    op.add_column('messages', sa.Column('metadata', JSON, nullable=True))

    # ========================================
    # STEP 6: Remove phase, adviser_id, adviser_type from conversations
    # (Keep for now for backwards compatibility, mark as deprecated)
    # We'll keep them but they won't be used in the new flow
    # ========================================
    # Note: Not dropping these columns yet to avoid breaking existing code
    # They can be dropped in a future migration after full transition

    # ========================================
    # STEP 7: Update indexes
    # ========================================
    op.drop_index('idx_adviser_messages_session', 'messages')
    op.create_index('idx_messages_conversation', 'messages', ['conversation_id', 'sequence_number'])

    # Add index for adviser lookups on messages
    op.create_index('idx_messages_adviser', 'messages', ['adviser_id', 'adviser_type'])


def downgrade():
    # Reverse the changes
    op.drop_index('idx_messages_adviser', 'messages')
    op.drop_index('idx_messages_conversation', 'messages')
    op.create_index('idx_adviser_messages_session', 'messages', ['conversation_id', 'sequence_number'])

    op.drop_column('messages', 'metadata')
    op.drop_column('messages', 'adviser_type')
    op.drop_column('messages', 'adviser_id')

    op.alter_column('messages', 'conversation_id', new_column_name='session_id')

    # Restore foreign key constraints
    op.drop_constraint('messages_conversation_id_fkey', 'messages', type_='foreignkey')
    op.create_foreign_key(
        'adviser_messages_session_id_fkey',
        'messages', 'conversations',
        ['session_id'], ['id'],
        ondelete='CASCADE'
    )

    # Restore other foreign keys
    op.drop_constraint('adviser_session_variants_session_id_fkey', 'adviser_session_variants', type_='foreignkey')
    op.create_foreign_key(
        'adviser_session_variants_session_id_fkey',
        'adviser_session_variants', 'conversations',
        ['session_id'], ['id'],
        ondelete='CASCADE'
    )

    op.drop_constraint('adviser_message_sentiment_message_id_fkey', 'adviser_message_sentiment', type_='foreignkey')
    op.drop_constraint('adviser_message_sentiment_session_id_fkey', 'adviser_message_sentiment', type_='foreignkey')
    op.create_foreign_key(
        'adviser_message_sentiment_session_id_fkey',
        'adviser_message_sentiment', 'conversations',
        ['session_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'adviser_message_sentiment_message_id_fkey',
        'adviser_message_sentiment', 'messages',
        ['message_id'], ['id'],
        ondelete='CASCADE'
    )

    op.drop_constraint('adviser_session_evaluations_session_id_fkey', 'adviser_session_evaluations', type_='foreignkey')
    op.create_foreign_key(
        'adviser_session_evaluations_session_id_fkey',
        'adviser_session_evaluations', 'conversations',
        ['session_id'], ['id'],
        ondelete='CASCADE'
    )

    # Rename tables back
    op.rename_table('messages', 'adviser_messages')
    op.rename_table('conversations', 'adviser_sessions')
