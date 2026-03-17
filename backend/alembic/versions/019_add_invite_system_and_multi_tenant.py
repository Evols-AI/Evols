"""Add invite system and multi-tenant support

Revision ID: 019
Revises: 018
Create Date: 2026-03-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '019'
down_revision = '018'
branch_labels = None
depends_on = None


def upgrade():
    # Create tenant_invites table
    op.create_table(
        'tenant_invites',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('token', sa.String(255), nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='USER'),
        sa.Column('invited_by', sa.Integer(), nullable=True),
        sa.Column('is_accepted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('accepted_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('message', sa.String(500), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['invited_by'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_tenant_invites_tenant_id', 'tenant_invites', ['tenant_id'])
    op.create_index('ix_tenant_invites_email', 'tenant_invites', ['email'])
    op.create_index('ix_tenant_invites_token', 'tenant_invites', ['token'], unique=True)

    # Create user_tenants table (many-to-many association)
    op.create_table(
        'user_tenants',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='USER'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('joined_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'tenant_id', name='uq_user_tenant')
    )
    op.create_index('ix_user_tenants_user_id', 'user_tenants', ['user_id'])
    op.create_index('ix_user_tenants_tenant_id', 'user_tenants', ['tenant_id'])

    # Migrate existing users to user_tenants table
    # All existing users with tenant_id should get an entry in user_tenants
    op.execute("""
        INSERT INTO user_tenants (user_id, tenant_id, role, is_active, joined_at, created_at, updated_at)
        SELECT
            id,
            tenant_id,
            CASE
                WHEN role = 'TENANT_ADMIN' THEN 'TENANT_ADMIN'
                ELSE 'USER'
            END,
            true,
            created_at,
            created_at,
            updated_at
        FROM users
        WHERE tenant_id IS NOT NULL
    """)


def downgrade():
    # Drop tables
    op.drop_table('user_tenants')
    op.drop_table('tenant_invites')
