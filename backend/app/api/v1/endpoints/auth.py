"""
Authentication Endpoints
User registration, login, and token management
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.models.tenant_invite import TenantInvite
from app.models.user_tenant import UserTenant
from app.models.email_verification import EmailVerification
from app.schemas.auth import UserLogin, UserRegister, Token, VerificationPendingResponse, EmailVerificationRequest
from app.services.demo_seed_service import seed_demo_product
from app.services.email_service import EmailService
from sqlalchemy import select
from datetime import datetime, timedelta
import secrets
from pydantic import BaseModel

router = APIRouter()


@router.post("/register")
async def register(user_data: UserRegister, db: AsyncSession = Depends(get_db)):
    """
    Register a new user and create or join a tenant

    Returns:
    - 201 + Token: Immediate registration (with invite token)
    - 202 + VerificationPendingResponse: Email verification required (new tenant creation)

    For SUPER_ADMIN creation: Set is_super_admin=true and provide SUPER_ADMIN_CREATION_TOKEN
    in the tenant_slug field. This can only be done if no other SUPER_ADMIN exists.
    """
    # Check if user already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        # If user exists and trying to accept invite to a different tenant
        if user_data.invite_token and not user_data.is_super_admin:
            # Validate invite
            result = await db.execute(
                select(TenantInvite).where(TenantInvite.token == user_data.invite_token)
            )
            invite = result.scalar_one_or_none()

            if not invite or not invite.is_valid or invite.email.lower() != user_data.email.lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered. Invalid or expired invite."
                )

            # Check if user is already a member of this tenant
            result = await db.execute(
                select(UserTenant).where(
                    UserTenant.user_id == existing_user.id,
                    UserTenant.tenant_id == invite.tenant_id
                )
            )
            existing_membership = result.scalar_one_or_none()

            if existing_membership:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You are already a member of this tenant"
                )

            # Add user to new tenant
            user_tenant = UserTenant(
                user_id=existing_user.id,
                tenant_id=invite.tenant_id,
                role=invite.role,
                is_active=True,
            )
            db.add(user_tenant)

            # Mark invite as accepted
            invite.is_accepted = True
            invite.accepted_at = datetime.utcnow()

            await db.commit()

            # Return token with new tenant context
            access_token = create_access_token(
                data={
                    "user_id": existing_user.id,
                    "email": existing_user.email,
                    "tenant_id": invite.tenant_id,
                    "role": invite.role,
                }
            )

            return Token(
                access_token=access_token,
                user_id=existing_user.id,
                tenant_id=invite.tenant_id,
                role=invite.role,
                email=existing_user.email,
                full_name=existing_user.full_name,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

    tenant_id = None
    role = UserRole.USER
    is_new_tenant = False
    invite = None

    # Handle SUPER_ADMIN creation
    if user_data.is_super_admin:
        # Get admin creation token from settings
        admin_token = settings.SUPER_ADMIN_CREATION_TOKEN

        if not admin_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="SUPER_ADMIN creation is not enabled on this server"
            )

        # Verify token (provided in tenant_slug field for security)
        if user_data.tenant_slug != admin_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid SUPER_ADMIN creation token"
            )

        # Check if SUPER_ADMIN already exists
        result = await db.execute(
            select(User).where(User.role.in_([UserRole.SUPER_ADMIN, UserRole.PRODUCT_ADMIN]))
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SUPER_ADMIN already exists. Use admin panel to create additional admins."
            )

        role = UserRole.SUPER_ADMIN
        tenant_id = None
    else:
        # Regular user registration - domain-based or invite-based

        if user_data.invite_token:
            # Invite-based registration
            result = await db.execute(
                select(TenantInvite).where(TenantInvite.token == user_data.invite_token)
            )
            invite = result.scalar_one_or_none()

            if not invite:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid invite token"
                )

            if not invite.is_valid:
                if invite.is_accepted:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invite has already been used"
                    )
                if invite.is_expired:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invite has expired"
                    )

            # Verify email matches invite
            if invite.email.lower() != user_data.email.lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email does not match invite"
                )

            tenant_id = invite.tenant_id
            role = UserRole(invite.role) if invite.role in ['USER', 'TENANT_ADMIN'] else UserRole.USER
        else:
            # Domain-based registration (first user creates tenant)
            # Requires email verification before creating tenant

            # Extract domain from email
            email_domain = user_data.email.split('@')[1].lower()

            # Check for common public email domains
            public_domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'protonmail.com']
            if email_domain in public_domains:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot auto-create tenant for public email domain '{email_domain}'. Please use a company email or request an invite."
                )

            # Check if tenant with this domain already exists
            result = await db.execute(
                select(Tenant).where(Tenant.domain == email_domain)
            )
            existing_tenant = result.scalar_one_or_none()

            if existing_tenant:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"A tenant for domain '{email_domain}' already exists. Please request an invite from your administrator."
                )

            # Check if there's already a pending verification for this email
            result = await db.execute(
                select(EmailVerification).where(
                    EmailVerification.email == user_data.email.lower(),
                    EmailVerification.is_verified == False
                )
            )
            existing_verification = result.scalar_one_or_none()

            if existing_verification and existing_verification.is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A verification email has already been sent. Please check your inbox or wait for it to expire."
                )

            # Create email verification record
            company_name = email_domain.split('.')[0].title()
            verification_token = secrets.token_urlsafe(32)

            verification = EmailVerification(
                email=user_data.email.lower(),
                token=verification_token,
                registration_data={
                    "full_name": user_data.full_name,
                    "hashed_password": get_password_hash(user_data.password),
                    "tenant_name": company_name,
                    "tenant_domain": email_domain,
                    "tenant_slug": email_domain.replace('.', '-'),
                },
                expires_at=datetime.utcnow() + timedelta(hours=24),
                is_verified=False,
            )
            db.add(verification)
            await db.commit()

            # Send verification email
            try:
                EmailService.send_verification_email(
                    to_email=user_data.email.lower(),
                    verification_token=verification_token,
                    tenant_name=company_name
                )
            except Exception as e:
                # Log error but don't fail registration
                print(f"Warning: Failed to send verification email: {e}")

            # Return 202 Accepted with verification pending message
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "message": "Verification email sent. Please check your inbox to complete registration.",
                    "email": user_data.email.lower(),
                    "requires_verification": True
                }
            )

    # Create demo product with sample data for new tenants (BEFORE user creation)
    # This must happen before commit so everything is in same transaction
    if not user_data.is_super_admin and tenant_id and is_new_tenant:
        try:
            await seed_demo_product(db, tenant_id)
        except Exception as e:
            # Log the error but don't fail registration
            print(f"Warning: Failed to seed demo product for tenant {tenant_id}: {e}")

    # Create user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        tenant_id=tenant_id,  # Legacy field - set to primary tenant
        role=role,  # Legacy field - set to role in primary tenant
        is_active=True,
        is_verified=True,  # Auto-verify for now
    )
    db.add(new_user)
    await db.flush()  # Flush to get user ID

    # Create UserTenant membership
    if tenant_id:
        user_tenant = UserTenant(
            user_id=new_user.id,
            tenant_id=tenant_id,
            role=role.value,
            is_active=True,
        )
        db.add(user_tenant)

    # Mark invite as accepted if applicable
    if invite:
        invite.is_accepted = True
        invite.accepted_at = datetime.utcnow()

    await db.commit()
    await db.refresh(new_user)

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


@router.post("/verify-email", response_model=Token, status_code=status.HTTP_201_CREATED)
async def verify_email(
    verification_data: EmailVerificationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify email and complete registration

    Creates the tenant and user after email verification.
    Returns JWT token for immediate login.
    """
    # Find verification record
    result = await db.execute(
        select(EmailVerification).where(
            EmailVerification.token == verification_data.token
        )
    )
    verification = result.scalar_one_or_none()

    if not verification:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )

    if verification.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link has already been used"
        )

    if verification.is_expired:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link has expired. Please register again."
        )

    # Extract registration data
    reg_data = verification.registration_data
    email = verification.email

    # Check if user was created in the meantime
    result = await db.execute(select(User).where(User.email == email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists with this email"
        )

    # Create tenant
    tenant = Tenant(
        name=reg_data["tenant_name"],
        slug=reg_data["tenant_slug"],
        domain=reg_data["tenant_domain"],
        is_active=True,
        is_trial=True,
        plan_type="free",
    )
    db.add(tenant)
    await db.flush()

    # Seed demo data for new tenant
    try:
        await seed_demo_product(db, tenant.id)
    except Exception as e:
        print(f"Warning: Failed to seed demo product for tenant {tenant.id}: {e}")

    # Create user
    new_user = User(
        email=email,
        hashed_password=reg_data["hashed_password"],
        full_name=reg_data["full_name"],
        tenant_id=tenant.id,
        role=UserRole.TENANT_ADMIN,
        is_active=True,
        is_verified=True,
    )
    db.add(new_user)
    await db.flush()

    # Create UserTenant membership
    user_tenant = UserTenant(
        user_id=new_user.id,
        tenant_id=tenant.id,
        role=UserRole.TENANT_ADMIN.value,
        is_active=True,
    )
    db.add(user_tenant)

    # Mark verification as complete
    verification.is_verified = True
    verification.verified_at = datetime.utcnow()
    verification.user_id = new_user.id

    await db.commit()
    await db.refresh(new_user)

    # Send welcome email
    try:
        EmailService.send_welcome_email(
            to_email=new_user.email,
            tenant_name=tenant.name,
            is_first_user=True
        )
    except Exception as e:
        print(f"Warning: Failed to send welcome email: {e}")

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
