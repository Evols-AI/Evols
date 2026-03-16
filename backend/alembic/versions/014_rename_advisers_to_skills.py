"""rename advisers to skills

Revision ID: 014
Revises: 013
Create Date: 2026-03-13

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Rename main tables
    op.rename_table('advisers', 'skills')
    op.rename_table('custom_advisers', 'custom_skills')
    op.rename_table('custom_adviser_versions', 'custom_skill_versions')

    # 2. Rename experiment/analytics tables
    op.rename_table('adviser_experiments', 'skill_experiments')
    op.rename_table('adviser_experiment_variants', 'skill_experiment_variants')
    op.rename_table('adviser_experiment_bandit_state', 'skill_experiment_bandit_state')
    op.rename_table('adviser_bandit_allocation_history', 'skill_bandit_allocation_history')
    op.rename_table('adviser_session_evaluations', 'skill_session_evaluations')
    op.rename_table('adviser_session_variants', 'skill_session_variants')
    op.rename_table('adviser_message_sentiment', 'skill_message_sentiment')

    # 3. Rename columns in custom_skills
    op.alter_column('custom_skills', 'source_adviser_id', new_column_name='source_skill_id')

    # 4. Rename columns in conversations
    op.alter_column('conversations', 'adviser_id', new_column_name='skill_id')
    op.alter_column('conversations', 'adviser_type', new_column_name='skill_type')

    # 5. Rename columns in messages
    op.alter_column('messages', 'adviser_id', new_column_name='skill_id')
    op.alter_column('messages', 'adviser_type', new_column_name='skill_type')

    # 6. Rename columns in skill_experiments
    op.alter_column('skill_experiments', 'adviser_id', new_column_name='skill_id')
    op.alter_column('skill_experiments', 'adviser_type', new_column_name='skill_type')

    # 7. Rename columns in custom_skill_versions
    op.alter_column('custom_skill_versions', 'custom_adviser_id', new_column_name='custom_skill_id')

    # 8. Update foreign key constraints
    # Drop old constraint from custom_skills
    op.drop_constraint('custom_advisers_source_adviser_id_fkey', 'custom_skills', type_='foreignkey')
    # Create new constraint
    op.create_foreign_key(
        'custom_skills_source_skill_id_fkey',
        'custom_skills',
        'skills',
        ['source_skill_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Update custom_skill_versions constraint
    op.drop_constraint('custom_adviser_versions_custom_adviser_id_fkey', 'custom_skill_versions', type_='foreignkey')
    op.create_foreign_key(
        'custom_skill_versions_custom_skill_id_fkey',
        'custom_skill_versions',
        'custom_skills',
        ['custom_skill_id'],
        ['id'],
        ondelete='CASCADE'
    )

    # 9. Rename indexes
    # conversations table indexes
    op.execute('ALTER INDEX adviser_sessions_pkey RENAME TO conversations_pkey')
    op.execute('ALTER INDEX idx_adviser_sessions_phase RENAME TO idx_conversations_phase')
    op.execute('ALTER INDEX idx_adviser_sessions_tenant RENAME TO idx_conversations_tenant')
    op.execute('ALTER INDEX idx_adviser_sessions_user RENAME TO idx_conversations_user')

    # messages table indexes
    op.execute('ALTER INDEX adviser_messages_pkey RENAME TO messages_pkey')
    op.execute('ALTER INDEX idx_messages_adviser RENAME TO idx_messages_skill')

    # custom_skills indexes
    op.execute('ALTER INDEX idx_custom_advisers_tenant RENAME TO idx_custom_skills_tenant')
    op.execute('ALTER INDEX idx_custom_advisers_active RENAME TO idx_custom_skills_active')

    # 10. Rename sequences
    op.execute('ALTER SEQUENCE adviser_messages_id_seq RENAME TO messages_id_seq')
    op.execute('ALTER SEQUENCE custom_advisers_id_seq RENAME TO custom_skills_id_seq')
    op.execute('ALTER SEQUENCE adviser_experiments_id_seq RENAME TO skill_experiments_id_seq')


def downgrade() -> None:
    # Reverse all changes

    # Rename sequences back
    op.execute('ALTER SEQUENCE skill_experiments_id_seq RENAME TO adviser_experiments_id_seq')
    op.execute('ALTER SEQUENCE custom_skills_id_seq RENAME TO custom_advisers_id_seq')
    op.execute('ALTER SEQUENCE messages_id_seq RENAME TO adviser_messages_id_seq')

    # Rename indexes back
    op.execute('ALTER INDEX idx_custom_skills_active RENAME TO idx_custom_advisers_active')
    op.execute('ALTER INDEX idx_custom_skills_tenant RENAME TO idx_custom_advisers_tenant')
    op.execute('ALTER INDEX idx_messages_skill RENAME TO idx_messages_adviser')
    op.execute('ALTER INDEX messages_pkey RENAME TO adviser_messages_pkey')
    op.execute('ALTER INDEX idx_conversations_user RENAME TO idx_adviser_sessions_user')
    op.execute('ALTER INDEX idx_conversations_tenant RENAME TO idx_adviser_sessions_tenant')
    op.execute('ALTER INDEX idx_conversations_phase RENAME TO idx_adviser_sessions_phase')
    op.execute('ALTER INDEX conversations_pkey RENAME TO adviser_sessions_pkey')

    # Drop new constraints
    op.drop_constraint('custom_skill_versions_custom_skill_id_fkey', 'custom_skill_versions', type_='foreignkey')
    op.drop_constraint('custom_skills_source_skill_id_fkey', 'custom_skills', type_='foreignkey')

    # Rename columns back
    op.alter_column('custom_skill_versions', 'custom_skill_id', new_column_name='custom_adviser_id')
    op.alter_column('skill_experiments', 'skill_type', new_column_name='adviser_type')
    op.alter_column('skill_experiments', 'skill_id', new_column_name='adviser_id')
    op.alter_column('messages', 'skill_type', new_column_name='adviser_type')
    op.alter_column('messages', 'skill_id', new_column_name='adviser_id')
    op.alter_column('conversations', 'skill_type', new_column_name='adviser_type')
    op.alter_column('conversations', 'skill_id', new_column_name='adviser_id')
    op.alter_column('custom_skills', 'source_skill_id', new_column_name='source_adviser_id')

    # Rename tables back
    op.rename_table('skill_message_sentiment', 'adviser_message_sentiment')
    op.rename_table('skill_session_variants', 'adviser_session_variants')
    op.rename_table('skill_session_evaluations', 'adviser_session_evaluations')
    op.rename_table('skill_bandit_allocation_history', 'adviser_bandit_allocation_history')
    op.rename_table('skill_experiment_bandit_state', 'adviser_experiment_bandit_state')
    op.rename_table('skill_experiment_variants', 'adviser_experiment_variants')
    op.rename_table('skill_experiments', 'adviser_experiments')
    op.rename_table('custom_skill_versions', 'custom_adviser_versions')
    op.rename_table('custom_skills', 'custom_advisers')
    op.rename_table('skills', 'advisers')

    # Recreate old constraints
    op.create_foreign_key(
        'custom_adviser_versions_custom_adviser_id_fkey',
        'custom_adviser_versions',
        'custom_advisers',
        ['custom_adviser_id'],
        ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'custom_advisers_source_adviser_id_fkey',
        'custom_advisers',
        'advisers',
        ['source_adviser_id'],
        ['id'],
        ondelete='SET NULL'
    )
