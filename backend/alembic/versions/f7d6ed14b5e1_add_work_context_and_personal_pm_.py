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
    # All tables below were manually applied. CREATE TABLE IF NOT EXISTS makes this safe to re-run.
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capacitystatus') THEN CREATE TYPE capacitystatus AS ENUM ('sustainable', 'stretched', 'overloaded', 'unsustainable'); END IF; END $$")
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'projectstatus') THEN CREATE TYPE projectstatus AS ENUM ('green', 'yellow', 'red', 'completed', 'paused'); END IF; END $$")
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'projectrole') THEN CREATE TYPE projectrole AS ENUM ('owner', 'contributor', 'advisor'); END IF; END $$")
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'decisioncategory') THEN CREATE TYPE decisioncategory AS ENUM ('product', 'technical', 'organizational', 'career', 'process', 'stakeholder'); END IF; END $$")
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'taskpriority') THEN CREATE TYPE taskpriority AS ENUM ('critical', 'high_leverage', 'stakeholder', 'sweep', 'backlog'); END IF; END $$")
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'taskstatus') THEN CREATE TYPE taskstatus AS ENUM ('todo', 'in_progress', 'blocked', 'completed', 'dropped', 'delegated'); END IF; END $$")
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meetingtype') THEN CREATE TYPE meetingtype AS ENUM ('one_on_one_manager', 'one_on_one_peer', 'one_on_one_direct_report', 'team_sync', 'stakeholder', 'planning', 'review', 'other'); END IF; END $$")

    op.execute("""
        CREATE TABLE IF NOT EXISTS work_context (
            id SERIAL NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255), team VARCHAR(255), team_description TEXT, manager_name VARCHAR(255),
            manager_title VARCHAR(255), team_size INTEGER, team_composition TEXT, recent_changes TEXT,
            working_hours VARCHAR(255), communication_style TEXT, biggest_time_sink TEXT, protected_time TEXT,
            capacity_status capacitystatus, capacity_factors TEXT, signals JSON, career_story TEXT,
            impact_moments JSON, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL,
            PRIMARY KEY (id), UNIQUE (user_id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_work_context_user_id ON work_context (user_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS active_projects (
            id SERIAL NOT NULL, work_context_id INTEGER NOT NULL REFERENCES work_context(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL,
            status projectstatus NOT NULL, next_milestone VARCHAR(500), next_milestone_date TIMESTAMP,
            role projectrole NOT NULL, key_stakeholders JSON, notes TEXT,
            created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, PRIMARY KEY (id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_active_projects_user_id ON active_projects (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_active_projects_work_context_id ON active_projects (work_context_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS key_relationships (
            id SERIAL NOT NULL, work_context_id INTEGER NOT NULL REFERENCES work_context(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL,
            role VARCHAR(255), relationship_type VARCHAR(50), cares_about TEXT, current_dynamic TEXT,
            communication_preference TEXT, investment_needed TEXT,
            created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, PRIMARY KEY (id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_key_relationships_user_id ON key_relationships (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_key_relationships_work_context_id ON key_relationships (work_context_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS pm_decisions (
            id SERIAL NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, decision_number INTEGER NOT NULL,
            title VARCHAR(500) NOT NULL, category decisioncategory NOT NULL, context TEXT NOT NULL,
            options_considered JSON NOT NULL, decision TEXT NOT NULL, reasoning TEXT NOT NULL,
            tradeoffs TEXT, stakeholders JSON, expected_outcome TEXT, actual_outcome TEXT, lessons TEXT,
            decision_date TIMESTAMP NOT NULL, review_date TIMESTAMP,
            created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, PRIMARY KEY (id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_pm_decisions_product_id ON pm_decisions (product_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pm_decisions_user_id ON pm_decisions (user_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, title VARCHAR(500) NOT NULL,
            description TEXT, priority taskpriority NOT NULL, status taskstatus NOT NULL,
            deadline TIMESTAMP, why_critical TEXT, impact TEXT, stakeholder_name VARCHAR(255),
            stakeholder_reason TEXT, source VARCHAR(255), notes TEXT, completed_at TIMESTAMP, outcome TEXT,
            created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, PRIMARY KEY (id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_tasks_product_id ON tasks (product_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tasks_user_id ON tasks (user_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS weekly_focus (
            id SERIAL NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            week_start_date TIMESTAMP NOT NULL, focus_1 VARCHAR(500), focus_2 VARCHAR(500),
            focus_3 VARCHAR(500), notes TEXT, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL,
            PRIMARY KEY (id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_weekly_focus_user_id ON weekly_focus (user_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS meeting_notes (
            id SERIAL NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(500) NOT NULL, meeting_type meetingtype NOT NULL, meeting_date TIMESTAMP NOT NULL,
            attendees JSON, prep_notes TEXT, agenda JSON, discussion_topics JSON, notes TEXT,
            action_items JSON, decisions JSON, follow_ups JSON,
            created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, PRIMARY KEY (id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_meeting_notes_user_id ON meeting_notes (user_id)")


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
