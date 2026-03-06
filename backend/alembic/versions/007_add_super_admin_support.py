"""add super admin support

Revision ID: 007
Revises: 006
Create Date: 2025-03-05

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add SUPER_ADMIN role and make tenant_id nullable for users

    Changes:
    1. Add 'super_admin' to UserRole enum
    2. Make users.tenant_id nullable
    3. Add index for super_admin users
    """

    conn = op.get_bind()

    # 1. Add 'super_admin' to UserRole enum (if not exists)
    # PostgreSQL enum types require special handling
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'super_admin'
                AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole')
            ) THEN
                ALTER TYPE userrole ADD VALUE 'super_admin';
            END IF;
        END
        $$;
    """)

    # 2. Make tenant_id nullable
    # First check if the column is already nullable
    result = conn.execute(sa.text("""
        SELECT is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users'
        AND column_name = 'tenant_id'
    """))
    row = result.fetchone()

    if row and row[0] == 'NO':
        # Make tenant_id nullable
        op.alter_column('users', 'tenant_id',
                       existing_type=sa.Integer(),
                       nullable=True)

    # 3. Add index for super_admin users (for fast lookups)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_users_role
        ON users(role)
    """)

    print("✓ Added SUPER_ADMIN role support")
    print("✓ Made users.tenant_id nullable")
    print("✓ Added index on users.role")


def downgrade() -> None:
    """
    Revert SUPER_ADMIN support changes

    Warning: This will fail if any users have tenant_id = NULL
    """

    conn = op.get_bind()

    # 1. Check if any users have null tenant_id
    result = conn.execute(sa.text("""
        SELECT COUNT(*) FROM users WHERE tenant_id IS NULL
    """))
    null_count = result.scalar()

    if null_count > 0:
        raise Exception(
            f"Cannot downgrade: {null_count} users have NULL tenant_id. "
            "Please assign tenants to all users or delete super admin users before downgrading."
        )

    # 2. Make tenant_id NOT NULL again
    op.alter_column('users', 'tenant_id',
                   existing_type=sa.Integer(),
                   nullable=False)

    # 3. Drop the index
    op.execute("DROP INDEX IF EXISTS ix_users_role")

    # Note: We cannot remove enum values in PostgreSQL without recreating the type
    # So super_admin value will remain in the enum even after downgrade
    # This is safe as it won't be used

    print("✓ Reverted tenant_id to NOT NULL")
    print("✓ Dropped users.role index")
    print("⚠ Note: 'super_admin' enum value remains (PostgreSQL limitation)")
