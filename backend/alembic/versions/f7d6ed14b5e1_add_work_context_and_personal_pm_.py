"""add_work_context_and_personal_pm_features

Revision ID: f7d6ed14b5e1
Revises: b7b065025752
Create Date: 2026-03-20 17:22:12.385221

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f7d6ed14b5e1'
down_revision = 'b7b065025752'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create work_context table
    op.create_table(
        'work_context',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=True),
        sa.Column('team', sa.String(length=255), nullable=True),
        sa.Column('team_description', sa.Text(), nullable=True),
        sa.Column('manager_name', sa.String(length=255), nullable=True),
        sa.Column('manager_title', sa.String(length=255), nullable=True),
        sa.Column('team_size', sa.Integer(), nullable=True),
        sa.Column('team_composition', sa.Text(), nullable=True),
        sa.Column('recent_changes', sa.Text(), nullable=True),
        sa.Column('working_hours', sa.String(length=255), nullable=True),
        sa.Column('communication_style', sa.Text(), nullable=True),
        sa.Column('biggest_time_sink', sa.Text(), nullable=True),
        sa.Column('protected_time', sa.Text(), nullable=True),
        sa.Column('capacity_status', sa.Enum('sustainable', 'stretched', 'overloaded', 'unsustainable', name='capacitystatus'), nullable=True),
        sa.Column('capacity_factors', sa.Text(), nullable=True),
        sa.Column('signals', sa.JSON(), nullable=True),
        sa.Column('career_story', sa.Text(), nullable=True),
        sa.Column('impact_moments', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_work_context_user_id'), 'work_context', ['user_id'], unique=False)

    # Create active_projects table
    op.create_table(
        'active_projects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('work_context_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('status', sa.Enum('green', 'yellow', 'red', 'completed', 'paused', name='projectstatus'), nullable=False),
        sa.Column('next_milestone', sa.String(length=500), nullable=True),
        sa.Column('next_milestone_date', sa.DateTime(), nullable=True),
        sa.Column('role', sa.Enum('owner', 'contributor', 'advisor', name='projectrole'), nullable=False),
        sa.Column('key_stakeholders', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['work_context_id'], ['work_context.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_active_projects_user_id'), 'active_projects', ['user_id'], unique=False)
    op.create_index(op.f('ix_active_projects_work_context_id'), 'active_projects', ['work_context_id'], unique=False)

    # Create key_relationships table
    op.create_table(
        'key_relationships',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('work_context_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=255), nullable=True),
        sa.Column('relationship_type', sa.String(length=50), nullable=True),
        sa.Column('cares_about', sa.Text(), nullable=True),
        sa.Column('current_dynamic', sa.Text(), nullable=True),
        sa.Column('communication_preference', sa.Text(), nullable=True),
        sa.Column('investment_needed', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['work_context_id'], ['work_context.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_key_relationships_user_id'), 'key_relationships', ['user_id'], unique=False)
    op.create_index(op.f('ix_key_relationships_work_context_id'), 'key_relationships', ['work_context_id'], unique=False)

    # Create pm_decisions table
    op.create_table(
        'pm_decisions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('decision_number', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('category', sa.Enum('product', 'technical', 'organizational', 'career', 'process', 'stakeholder', name='decisioncategory'), nullable=False),
        sa.Column('context', sa.Text(), nullable=False),
        sa.Column('options_considered', sa.JSON(), nullable=False),
        sa.Column('decision', sa.Text(), nullable=False),
        sa.Column('reasoning', sa.Text(), nullable=False),
        sa.Column('tradeoffs', sa.Text(), nullable=True),
        sa.Column('stakeholders', sa.JSON(), nullable=True),
        sa.Column('expected_outcome', sa.Text(), nullable=True),
        sa.Column('actual_outcome', sa.Text(), nullable=True),
        sa.Column('lessons', sa.Text(), nullable=True),
        sa.Column('decision_date', sa.DateTime(), nullable=False),
        sa.Column('review_date', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pm_decisions_product_id'), 'pm_decisions', ['product_id'], unique=False)
    op.create_index(op.f('ix_pm_decisions_user_id'), 'pm_decisions', ['user_id'], unique=False)

    # Create tasks table
    op.create_table(
        'tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('priority', sa.Enum('critical', 'high_leverage', 'stakeholder', 'sweep', 'backlog', name='taskpriority'), nullable=False),
        sa.Column('status', sa.Enum('todo', 'in_progress', 'blocked', 'completed', 'dropped', 'delegated', name='taskstatus'), nullable=False),
        sa.Column('deadline', sa.DateTime(), nullable=True),
        sa.Column('why_critical', sa.Text(), nullable=True),
        sa.Column('impact', sa.Text(), nullable=True),
        sa.Column('stakeholder_name', sa.String(length=255), nullable=True),
        sa.Column('stakeholder_reason', sa.Text(), nullable=True),
        sa.Column('source', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('outcome', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tasks_product_id'), 'tasks', ['product_id'], unique=False)
    op.create_index(op.f('ix_tasks_user_id'), 'tasks', ['user_id'], unique=False)

    # Create weekly_focus table
    op.create_table(
        'weekly_focus',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('week_start_date', sa.DateTime(), nullable=False),
        sa.Column('focus_1', sa.String(length=500), nullable=True),
        sa.Column('focus_2', sa.String(length=500), nullable=True),
        sa.Column('focus_3', sa.String(length=500), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_weekly_focus_user_id'), 'weekly_focus', ['user_id'], unique=False)

    # Create meeting_notes table
    op.create_table(
        'meeting_notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('meeting_type', sa.Enum('one_on_one_manager', 'one_on_one_peer', 'one_on_one_direct_report', 'team_sync', 'stakeholder', 'planning', 'review', 'other', name='meetingtype'), nullable=False),
        sa.Column('meeting_date', sa.DateTime(), nullable=False),
        sa.Column('attendees', sa.JSON(), nullable=True),
        sa.Column('prep_notes', sa.Text(), nullable=True),
        sa.Column('agenda', sa.JSON(), nullable=True),
        sa.Column('discussion_topics', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('action_items', sa.JSON(), nullable=True),
        sa.Column('decisions', sa.JSON(), nullable=True),
        sa.Column('follow_ups', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_meeting_notes_user_id'), 'meeting_notes', ['user_id'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index(op.f('ix_meeting_notes_user_id'), table_name='meeting_notes')
    op.drop_table('meeting_notes')

    op.drop_index(op.f('ix_weekly_focus_user_id'), table_name='weekly_focus')
    op.drop_table('weekly_focus')

    op.drop_index(op.f('ix_tasks_user_id'), table_name='tasks')
    op.drop_index(op.f('ix_tasks_product_id'), table_name='tasks')
    op.drop_table('tasks')

    op.drop_index(op.f('ix_pm_decisions_user_id'), table_name='pm_decisions')
    op.drop_index(op.f('ix_pm_decisions_product_id'), table_name='pm_decisions')
    op.drop_table('pm_decisions')

    op.drop_index(op.f('ix_key_relationships_work_context_id'), table_name='key_relationships')
    op.drop_index(op.f('ix_key_relationships_user_id'), table_name='key_relationships')
    op.drop_table('key_relationships')

    op.drop_index(op.f('ix_active_projects_work_context_id'), table_name='active_projects')
    op.drop_index(op.f('ix_active_projects_user_id'), table_name='active_projects')
    op.drop_table('active_projects')

    op.drop_index(op.f('ix_work_context_user_id'), table_name='work_context')
    op.drop_table('work_context')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS meetingtype')
    op.execute('DROP TYPE IF EXISTS taskstatus')
    op.execute('DROP TYPE IF EXISTS taskpriority')
    op.execute('DROP TYPE IF EXISTS decisioncategory')
    op.execute('DROP TYPE IF EXISTS projectrole')
    op.execute('DROP TYPE IF EXISTS projectstatus')
    op.execute('DROP TYPE IF EXISTS capacitystatus')
