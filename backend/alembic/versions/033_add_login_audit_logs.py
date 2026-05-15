"""add login_audit_logs table

Revision ID: 033_add_login_audit_logs
Revises: add_authentik_id_to_users
Create Date: 2026-05-13

"""
from alembic import op
import sqlalchemy as sa

revision = '033_add_login_audit_logs'
down_revision = 'add_authentik_id_to_users'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS login_audit_logs (
            id SERIAL NOT NULL,
            email VARCHAR(255) NOT NULL,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            method VARCHAR(32) NOT NULL,
            success BOOLEAN NOT NULL,
            failure_reason VARCHAR(255),
            ip_address VARCHAR(64),
            user_agent VARCHAR(512),
            timestamp TIMESTAMP NOT NULL DEFAULT now(),
            created_at TIMESTAMP DEFAULT now(),
            updated_at TIMESTAMP DEFAULT now(),
            PRIMARY KEY (id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_login_audit_logs_email ON login_audit_logs (email)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_login_audit_logs_user_id ON login_audit_logs (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_login_audit_logs_success ON login_audit_logs (success)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_login_audit_logs_timestamp ON login_audit_logs (timestamp)")


def downgrade():
    op.drop_index('ix_login_audit_logs_timestamp', table_name='login_audit_logs')
    op.drop_index('ix_login_audit_logs_success', table_name='login_audit_logs')
    op.drop_index('ix_login_audit_logs_user_id', table_name='login_audit_logs')
    op.drop_index('ix_login_audit_logs_email', table_name='login_audit_logs')
    op.drop_table('login_audit_logs')
