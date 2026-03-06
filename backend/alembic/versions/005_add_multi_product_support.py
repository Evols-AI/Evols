"""add multi-product support

Revision ID: 005
Revises: 004
Create Date: 2025-03-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add multi-product support with products table and product_id FK to all tenant-scoped models"""

    conn = op.get_bind()

    # 1. Create products table (IF NOT EXISTS)
    op.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL REFERENCES tenants(id),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            is_demo BOOLEAN NOT NULL DEFAULT FALSE,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
    """)

    # Create indexes on products table (with IF NOT EXISTS)
    op.execute("CREATE INDEX IF NOT EXISTS ix_products_tenant_id ON products(tenant_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_products_is_demo ON products(is_demo);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_products_is_active ON products(is_active);")

    # 2. Add product_id columns to all tenant-scoped tables
    tables = ['feedback', 'theme', 'initiative', 'project', 'persona', 'capabilities']

    for table in tables:
        # Check if column exists before adding
        result = conn.execute(sa.text(f"""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = '{table}' AND column_name = 'product_id'
            );
        """))
        column_exists = result.scalar()

        if not column_exists:
            # Add product_id column (nullable for backward compatibility)
            op.add_column(table, sa.Column('product_id', sa.Integer(), nullable=True))

            # Create foreign key constraint
            op.create_foreign_key(
                f'fk_{table}_product_id',
                table, 'products',
                ['product_id'], ['id'],
                ondelete='SET NULL'
            )

            # Create index on product_id
            op.create_index(f'ix_{table}_product_id', table, ['product_id'], unique=False)
        else:
            print(f"Column product_id already exists in {table}, skipping...")

    # 3. Seed Demo products for each tenant and link existing data
    # Get all tenants
    tenants_result = conn.execute(sa.text("SELECT id FROM tenants"))
    tenants = tenants_result.fetchall()

    for tenant_row in tenants:
        tenant_id = tenant_row[0]

        # Check if demo product already exists for this tenant
        demo_check = conn.execute(sa.text("""
            SELECT id FROM products
            WHERE tenant_id = :tenant_id AND is_demo = true
        """), {"tenant_id": tenant_id})
        existing_demo = demo_check.fetchone()

        if existing_demo:
            demo_product_id = existing_demo[0]
            print(f"Demo product already exists for tenant {tenant_id}, using id {demo_product_id}")
        else:
            # Create Demo product for this tenant
            demo_result = conn.execute(sa.text("""
                INSERT INTO products (tenant_id, name, description, is_demo, is_active, created_at, updated_at)
                VALUES (:tenant_id, 'Demo Product', 'Demonstration product with sample data for onboarding and education', true, true, NOW(), NOW())
                RETURNING id
            """), {"tenant_id": tenant_id})

            demo_product_id = demo_result.fetchone()[0]
            print(f"Created Demo product for tenant {tenant_id} with id {demo_product_id}")

        # Link all existing data to the Demo product for this tenant (only where product_id IS NULL)
        for table in tables:
            result = conn.execute(sa.text(f"""
                UPDATE {table}
                SET product_id = :product_id
                WHERE tenant_id = :tenant_id AND product_id IS NULL
            """), {"product_id": demo_product_id, "tenant_id": tenant_id})
            rows_updated = result.rowcount
            if rows_updated > 0:
                print(f"Linked {rows_updated} rows in {table} to demo product for tenant {tenant_id}")


def downgrade() -> None:
    """Remove multi-product support"""

    tables = ['feedback', 'theme', 'initiative', 'project', 'persona', 'capabilities']

    # 1. Drop indexes and foreign keys from all tables
    for table in tables:
        try:
            op.drop_index(f'ix_{table}_product_id', table_name=table)
        except:
            pass
        try:
            op.drop_constraint(f'fk_{table}_product_id', table, type_='foreignkey')
        except:
            pass
        try:
            op.drop_column(table, 'product_id')
        except:
            pass

    # 2. Drop indexes on products table
    try:
        op.drop_index('ix_products_is_active', table_name='products')
    except:
        pass
    try:
        op.drop_index('ix_products_is_demo', table_name='products')
    except:
        pass
    try:
        op.drop_index('ix_products_tenant_id', table_name='products')
    except:
        pass

    # 3. Drop products table
    try:
        op.drop_table('products')
    except:
        pass
