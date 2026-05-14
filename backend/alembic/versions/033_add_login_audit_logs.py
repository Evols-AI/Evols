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
    op.create_table(
        'login_audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('method', sa.String(32), nullable=False),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('failure_reason', sa.String(255), nullable=True),
        sa.Column('ip_address', sa.String(64), nullable=True),
        sa.Column('user_agent', sa.String(512), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_login_audit_logs_email', 'login_audit_logs', ['email'])
    op.create_index('ix_login_audit_logs_user_id', 'login_audit_logs', ['user_id'])
    op.create_index('ix_login_audit_logs_success', 'login_audit_logs', ['success'])
    op.create_index('ix_login_audit_logs_timestamp', 'login_audit_logs', ['timestamp'])


def downgrade():
    op.drop_index('ix_login_audit_logs_timestamp', table_name='login_audit_logs')
    op.drop_index('ix_login_audit_logs_success', table_name='login_audit_logs')
    op.drop_index('ix_login_audit_logs_user_id', table_name='login_audit_logs')
    op.drop_index('ix_login_audit_logs_email', table_name='login_audit_logs')
    op.drop_table('login_audit_logs')
