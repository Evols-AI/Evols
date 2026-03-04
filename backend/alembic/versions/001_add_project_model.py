"""add project model

Revision ID: 001
Revises:
Create Date: 2025-03-01

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create projects table with RICE priority scoring fields"""

    # Create enum types using raw SQL to avoid SQLAlchemy's automatic enum creation
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE projecteffort AS ENUM ('small', 'medium', 'large', 'xlarge');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE projectstatus AS ENUM ('backlog', 'planned', 'in_progress', 'completed', 'cancelled');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create the project table using raw SQL to avoid enum creation issues
    op.execute("""
        CREATE TABLE project (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL REFERENCES tenants(id),
            initiative_id INTEGER NOT NULL REFERENCES initiative(id),
            title VARCHAR(255) NOT NULL,
            description TEXT,
            effort projecteffort NOT NULL,
            is_boulder BOOLEAN DEFAULT FALSE,
            status projectstatus NOT NULL DEFAULT 'backlog',
            reach INTEGER,
            persona_weight DOUBLE PRECISION,
            confidence DOUBLE PRECISION,
            effort_score INTEGER,
            priority_score DOUBLE PRECISION,
            acceptance_criteria JSON,
            matched_persona_ids INTEGER[],
            overlapping_capability_ids INTEGER[],
            extra_data JSON,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
    """)

    # Create indexes
    op.create_index('idx_project_tenant', 'project', ['tenant_id'], unique=False)
    op.create_index('idx_project_initiative', 'project', ['initiative_id'], unique=False)
    op.create_index('idx_project_status', 'project', ['status'], unique=False)
    op.create_index('idx_project_effort', 'project', ['effort'], unique=False)
    op.create_index('idx_project_priority', 'project', ['priority_score'], unique=False)


def downgrade() -> None:
    """Drop projects table"""
    # Drop indexes
    op.drop_index('idx_project_priority', table_name='project')
    op.drop_index('idx_project_effort', table_name='project')
    op.drop_index('idx_project_status', table_name='project')
    op.drop_index('idx_project_initiative', table_name='project')
    op.drop_index('idx_project_tenant', table_name='project')

    # Drop table
    op.drop_table('project')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS projecteffort')
    op.execute('DROP TYPE IF EXISTS projectstatus')
