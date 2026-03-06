"""
Authentication Endpoints
User registration, login, and token management
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.auth import UserLogin, UserRegister, Token
from app.services.demo_seed_service import seed_demo_product
from sqlalchemy import select

router = APIRouter()


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: AsyncSession = Depends(get_db)):
    """
    Register a new user and create or join a tenant
    """
    # Check if user already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Check if tenant exists or create new one
    result = await db.execute(select(Tenant).where(Tenant.slug == user_data.tenant_slug))
    tenant = result.scalar_one_or_none()

    is_new_tenant = False
    if not tenant:
        # Create new tenant
        tenant = Tenant(
            name=user_data.tenant_slug.replace("-", " ").title(),
            slug=user_data.tenant_slug,
            is_active=True,
            is_trial=True,
            plan_type="free",
        )
        db.add(tenant)
        await db.flush()
        is_new_tenant = True

    # Create user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        tenant_id=tenant.id,
        is_active=True,
        is_verified=True,  # Auto-verify for now
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Create demo product with sample data for new tenants
    if is_new_tenant:
        try:
            await seed_demo_product(db, tenant.id)
        except Exception as e:
            # Log the error but don't fail registration
            print(f"Warning: Failed to seed demo product for tenant {tenant.id}: {e}")

    # Create access token
    access_token = create_access_token(
        data={
            "user_id": new_user.id,
            "email": new_user.email,
            "tenant_id": new_user.tenant_id,
            "role": new_user.role.value,
        }
    )

    return Token(
        access_token=access_token,
        user_id=new_user.id,
        tenant_id=new_user.tenant_id,
        role=new_user.role.value,
        email=new_user.email,
        full_name=new_user.full_name,
    )


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    Login with email and password
    """
    # Get user
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    # Create access token
    access_token = create_access_token(
        data={
            "user_id": user.id,
            "email": user.email,
            "tenant_id": user.tenant_id,
            "role": user.role.value,
        }
    )

    return Token(
        access_token=access_token,
        user_id=user.id,
        tenant_id=user.tenant_id,
        role=user.role.value,
        email=user.email,
        full_name=user.full_name,
    )
