"""
Product API Endpoints
Manage products within a tenant (multi-product support)
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_tenant_id
from app.models.user import User, UserRole
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse

router = APIRouter()


def require_admin(current_user: User) -> None:
    """
    Verify that the current user has admin privileges.

    Raises:
        HTTPException: If user is not TENANT_ADMIN or PRODUCT_ADMIN
    """
    if current_user.role not in [UserRole.TENANT_ADMIN, UserRole.PRODUCT_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant admins can manage products"
        )


@router.get("/", response_model=List[ProductResponse])
async def list_products(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    List all active products for the current tenant.

    Returns:
        List of active products, ordered by demo status (demo first) and creation date
    """
    result = await db.execute(
        select(Product)
        .where(Product.tenant_id == tenant_id)
        .where(Product.is_active == True)
        .order_by(Product.is_demo.desc(), Product.created_at)
    )
    return result.scalars().all()


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new product (admin only).

    Args:
        product_data: Product creation data

    Returns:
        Created product

    Raises:
        HTTPException: If user is not an admin
    """
    require_admin(current_user)

    product = Product(
        tenant_id=tenant_id,
        name=product_data.name,
        description=product_data.description,
        is_demo=product_data.is_demo,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Get a specific product by ID.

    Args:
        product_id: Product ID

    Returns:
        Product details

    Raises:
        HTTPException: If product not found or doesn't belong to tenant
    """
    result = await db.execute(
        select(Product).where(
            Product.id == product_id,
            Product.tenant_id == tenant_id
        )
    )
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    return product


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    """
    Update a product (admin only).

    Args:
        product_id: Product ID
        product_data: Product update data

    Returns:
        Updated product

    Raises:
        HTTPException: If user is not an admin or product not found
    """
    require_admin(current_user)

    result = await db.execute(
        select(Product).where(
            Product.id == product_id,
            Product.tenant_id == tenant_id
        )
    )
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    # Update fields if provided
    if product_data.name is not None:
        product.name = product_data.name
    if product_data.description is not None:
        product.description = product_data.description
    if product_data.is_active is not None:
        product.is_active = product_data.is_active

    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    """
    Soft delete a product (admin only).
    Cannot delete demo products.

    Args:
        product_id: Product ID

    Raises:
        HTTPException: If user is not an admin, product not found, or trying to delete demo product
    """
    require_admin(current_user)

    result = await db.execute(
        select(Product).where(
            Product.id == product_id,
            Product.tenant_id == tenant_id
        )
    )
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    if product.is_demo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete demo product"
        )

    # Soft delete by setting is_active to False
    product.is_active = False
    await db.commit()
