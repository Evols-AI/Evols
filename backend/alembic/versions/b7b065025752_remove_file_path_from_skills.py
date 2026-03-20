"""remove_file_path_from_skills

Revision ID: b7b065025752
Revises: 13b853cefe13
Create Date: 2026-03-19 23:59:14.883371

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b7b065025752'
down_revision = '13b853cefe13'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove file_path column - no longer needed since we load from database
    op.drop_column('skills', 'file_path')


def downgrade() -> None:
    # Restore file_path column if needed
    op.add_column('skills', sa.Column('file_path', sa.String(), nullable=True))
