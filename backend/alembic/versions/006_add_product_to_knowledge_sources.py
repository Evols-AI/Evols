"""add product_id to knowledge_sources

Revision ID: 006
Revises: 005
Create Date: 2026-03-04

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add product_id to knowledge_sources table"""
    
    conn = op.get_bind()
    
    # Check if column exists before adding
    result = conn.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'knowledge_sources' AND column_name = 'product_id'
        );
    """))
    column_exists = result.scalar()
    
    if not column_exists:
        # Add product_id column (nullable for now)
        op.add_column('knowledge_sources', sa.Column('product_id', sa.Integer(), nullable=True))
        
        # Create foreign key constraint
        op.create_foreign_key(
            'fk_knowledge_sources_product_id',
            'knowledge_sources', 'products',
            ['product_id'], ['id'],
            ondelete='SET NULL'
        )
        
        # Create index on product_id
        op.create_index('ix_knowledge_sources_product_id', 'knowledge_sources', ['product_id'], unique=False)
        
        print("Added product_id to knowledge_sources table")
    else:
        print("Column product_id already exists in knowledge_sources, skipping...")


def downgrade() -> None:
    """Remove product_id from knowledge_sources table"""
    try:
        op.drop_index('ix_knowledge_sources_product_id', table_name='knowledge_sources')
    except:
        pass
    try:
        op.drop_constraint('fk_knowledge_sources_product_id', 'knowledge_sources', type_='foreignkey')
    except:
        pass
    try:
        op.drop_column('knowledge_sources', 'product_id')
    except:
        pass
