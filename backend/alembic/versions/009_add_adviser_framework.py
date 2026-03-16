"""add adviser framework

Revision ID: 009
Revises: 008
Create Date: 2026-03-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, ARRAY

# revision identifiers, used by Alembic.
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    # ========================================
    # ADVISERS (Product-level templates)
    # ========================================
    op.create_table(
        'advisers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(50), nullable=True, server_default='💡'),
        sa.Column('tools', JSON, nullable=False, server_default='[]'),
        sa.Column('initial_questions', JSON, nullable=False, server_default='[]'),
        sa.Column('task_definitions', JSON, nullable=False, server_default='[]'),
        sa.Column('instructions', sa.Text(), nullable=False),
        sa.Column('output_template', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('idx_advisers_is_active', 'advisers', ['is_active'])

    # ========================================
    # CUSTOM ADVISERS (Tenant-level customizations)
    # ========================================
    op.create_table(
        'custom_advisers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('source_adviser_id', sa.Integer(), sa.ForeignKey('advisers.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(50), nullable=True, server_default='💡'),
        sa.Column('tools', JSON, nullable=False, server_default='[]'),
        sa.Column('initial_questions', JSON, nullable=False, server_default='[]'),
        sa.Column('task_definitions', JSON, nullable=False, server_default='[]'),
        sa.Column('instructions', sa.Text(), nullable=False),
        sa.Column('output_template', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('idx_custom_advisers_tenant', 'custom_advisers', ['tenant_id'])
    op.create_index('idx_custom_advisers_active', 'custom_advisers', ['tenant_id', 'is_active'])

    # ========================================
    # CUSTOM ADVISER VERSIONS (Version history)
    # ========================================
    op.create_table(
        'custom_adviser_versions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('custom_adviser_id', sa.Integer(), sa.ForeignKey('custom_advisers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('tools', JSON, nullable=False),
        sa.Column('initial_questions', JSON, nullable=False),
        sa.Column('task_definitions', JSON, nullable=False),
        sa.Column('instructions', sa.Text(), nullable=False),
        sa.Column('output_template', sa.Text(), nullable=True),
        sa.Column('change_description', sa.Text(), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_custom_adviser_versions', 'custom_adviser_versions', ['custom_adviser_id', 'version_number'])

    # ========================================
    # ADVISER SESSIONS (User sessions with advisers)
    # ========================================
    op.create_table(
        'adviser_sessions',
        sa.Column('id', sa.String(36), primary_key=True),  # UUID
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('adviser_id', sa.Integer(), nullable=False),  # References either advisers or custom_advisers
        sa.Column('adviser_type', sa.String(20), nullable=False),  # 'default' or 'custom'
        sa.Column('session_name', sa.String(255), nullable=True),
        sa.Column('phase', sa.String(50), nullable=False, server_default='initial_generation'),  # 'initial_generation', 'refinement', 'completed'
        sa.Column('context_data', JSON, nullable=True),  # Answers to initial questions
        sa.Column('output_data', JSON, nullable=True),  # Generated result
        sa.Column('avg_sentiment', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('last_message_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_adviser_sessions_user', 'adviser_sessions', ['user_id', 'created_at'])
    op.create_index('idx_adviser_sessions_tenant', 'adviser_sessions', ['tenant_id'])
    op.create_index('idx_adviser_sessions_phase', 'adviser_sessions', ['phase'])

    # ========================================
    # ADVISER MESSAGES (Conversation messages within a session)
    # ========================================
    op.create_table(
        'adviser_messages',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('session_id', sa.String(36), sa.ForeignKey('adviser_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),  # 'user', 'assistant', 'system'
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('tool_calls', JSON, nullable=True),  # LLM tool calls made
        sa.Column('sequence_number', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_adviser_messages_session', 'adviser_messages', ['session_id', 'sequence_number'])

    # ========================================
    # SESSION EVALUATIONS (Explicit feedback)
    # ========================================
    op.create_table(
        'adviser_session_evaluations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('session_id', sa.String(36), sa.ForeignKey('adviser_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=True),  # 1-5
        sa.Column('helpful', sa.Boolean(), nullable=True),
        sa.Column('feedback_text', sa.Text(), nullable=True),
        sa.Column('evaluation_type', sa.String(50), nullable=False, server_default='overall_experience'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_session_evaluations', 'adviser_session_evaluations', ['session_id'])

    # ========================================
    # MESSAGE SENTIMENT (Implicit feedback)
    # ========================================
    op.create_table(
        'adviser_message_sentiment',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('message_id', sa.Integer(), sa.ForeignKey('adviser_messages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_id', sa.String(36), sa.ForeignKey('adviser_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sentiment_score', sa.Float(), nullable=False),  # -1.0 to 1.0
        sa.Column('sentiment_label', sa.String(20), nullable=False),  # 'positive', 'neutral', 'negative', 'frustrated'
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('indicators', JSON, nullable=True),
        sa.Column('analyzed_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_message_sentiment', 'adviser_message_sentiment', ['session_id'])

    # ========================================
    # EXPERIMENTS (A/B testing)
    # ========================================
    op.create_table(
        'adviser_experiments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('adviser_id', sa.Integer(), nullable=False),
        sa.Column('adviser_type', sa.String(20), nullable=False),  # 'default' or 'custom'
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('hypothesis', sa.Text(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='draft'),
        sa.Column('optimization_strategy', sa.String(50), nullable=False, server_default='fixed_split'),
        sa.Column('bandit_algorithm', sa.String(50), nullable=True),
        sa.Column('exploration_rate', sa.Float(), nullable=True, server_default='0.1'),
        sa.Column('start_date', sa.DateTime(), nullable=True),
        sa.Column('end_date', sa.DateTime(), nullable=True),
        sa.Column('min_sample_size', sa.Integer(), nullable=False, server_default='50'),
        sa.Column('confidence_threshold', sa.Float(), nullable=False, server_default='0.95'),
        sa.Column('recommended_winner_id', sa.Integer(), nullable=True),
        sa.Column('bandit_last_update', sa.DateTime(), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('idx_experiments_adviser', 'adviser_experiments', ['adviser_id', 'adviser_type'])
    op.create_index('idx_experiments_status', 'adviser_experiments', ['status'])

    # ========================================
    # EXPERIMENT VARIANTS
    # ========================================
    op.create_table(
        'adviser_experiment_variants',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('experiment_id', sa.Integer(), sa.ForeignKey('adviser_experiments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('variant_label', sa.String(10), nullable=False),  # 'A', 'B', 'C'
        sa.Column('is_control', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('traffic_allocation', sa.Float(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('config_overrides', JSON, nullable=True),
        sa.Column('sessions_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('completed_sessions_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('avg_rating', sa.Float(), nullable=True),
        sa.Column('avg_sentiment_score', sa.Float(), nullable=True),
        sa.Column('avg_refinement_messages', sa.Float(), nullable=True),
        sa.Column('completion_rate', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_experiment_variants', 'adviser_experiment_variants', ['experiment_id'])

    # ========================================
    # SESSION VARIANTS (Track which variant each session used)
    # ========================================
    op.create_table(
        'adviser_session_variants',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('session_id', sa.String(36), sa.ForeignKey('adviser_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('experiment_id', sa.Integer(), sa.ForeignKey('adviser_experiments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('variant_id', sa.Integer(), sa.ForeignKey('adviser_experiment_variants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assigned_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_session_variants', 'adviser_session_variants', ['session_id'])

    # ========================================
    # BANDIT STATE (For multi-armed bandit optimization)
    # ========================================
    op.create_table(
        'adviser_experiment_bandit_state',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('experiment_id', sa.Integer(), sa.ForeignKey('adviser_experiments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('variant_id', sa.Integer(), sa.ForeignKey('adviser_experiment_variants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('alpha', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('beta', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('pulls_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('rewards_sum', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('avg_reward', sa.Float(), nullable=True),
        sa.Column('current_allocation', sa.Float(), nullable=False),
        sa.Column('last_updated', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_bandit_state', 'adviser_experiment_bandit_state', ['experiment_id', 'variant_id'])

    # ========================================
    # BANDIT ALLOCATION HISTORY (For analysis)
    # ========================================
    op.create_table(
        'adviser_bandit_allocation_history',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('experiment_id', sa.Integer(), sa.ForeignKey('adviser_experiments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('variant_allocations', JSON, nullable=False),
        sa.Column('reason', sa.String(50), nullable=True),
    )
    op.create_index('idx_bandit_history', 'adviser_bandit_allocation_history', ['experiment_id', 'timestamp'])


def downgrade():
    op.drop_table('adviser_bandit_allocation_history')
    op.drop_table('adviser_experiment_bandit_state')
    op.drop_table('adviser_session_variants')
    op.drop_table('adviser_experiment_variants')
    op.drop_table('adviser_experiments')
    op.drop_table('adviser_message_sentiment')
    op.drop_table('adviser_session_evaluations')
    op.drop_table('adviser_messages')
    op.drop_table('adviser_sessions')
    op.drop_table('custom_adviser_versions')
    op.drop_table('custom_advisers')
    op.drop_table('advisers')
