"""
Authentication Endpoints
User registration, login, and token management
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.models.tenant_invite import TenantInvite
from app.models.user_tenant import UserTenant
from app.models.email_verification import EmailVerification
from app.schemas.auth import UserLogin, UserRegister, Token, VerificationPendingResponse, EmailVerificationRequest, ForgotPasswordRequest, ResetPasswordRequest
from app.services.email_service import EmailService
from sqlalchemy import select
from datetime import datetime, timedelta
from jose import JWTError, jwt
from urllib.parse import urlencode
import secrets
import httpx
from uuid import uuid4
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
            # Simplified domain-based registration - always requires email verification

            # Extract domain from email
            email_domain = user_data.email.split('@')[1].lower()
            public_domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'protonmail.com']

            # Check if user has pending invites - if so, force them to use invite link
            result = await db.execute(
                select(TenantInvite).where(
                    TenantInvite.email == user_data.email.lower(),
                    TenantInvite.is_accepted == False,
                    TenantInvite.expires_at > datetime.utcnow()
                )
            )
            pending_invite = result.scalar_one_or_none()

            if pending_invite:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You have a pending invitation. Please use the invitation link instead of signing up directly."
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

            # Determine tenant creation strategy based on email domain
            if email_domain in public_domains:
                # Personal email: Create UUID-based tenant
                user_prefix = user_data.email.split('@')[0].replace('.', '-').replace('_', '-')
                uuid_suffix = str(uuid4())[:8]
                tenant_name = f"{user_data.full_name}'s Workspace"
                tenant_slug = f"{user_prefix}-{uuid_suffix}"
                tenant_domain = None  # No domain claim for personal emails
                join_existing = False
            else:
                # Company email: Check if tenant exists for this domain
                result = await db.execute(
                    select(Tenant).where(Tenant.domain == email_domain)
                )
                existing_tenant = result.scalar_one_or_none()

                if existing_tenant:
                    # Join existing company tenant
                    tenant_name = existing_tenant.name
                    tenant_slug = existing_tenant.slug
                    tenant_domain = existing_tenant.domain
                    join_existing = True
                    existing_tenant_id = existing_tenant.id
                else:
                    # Create new company tenant
                    company_name = email_domain.split('.')[0].title()
                    tenant_name = company_name
                    tenant_slug = email_domain.replace('.', '-')
                    tenant_domain = email_domain
                    join_existing = False

            # Create email verification record
            verification_token = secrets.token_urlsafe(32)

            registration_data = {
                "full_name": user_data.full_name,
                "hashed_password": get_password_hash(user_data.password),
                "tenant_name": tenant_name,
                "tenant_slug": tenant_slug,
                "tenant_domain": tenant_domain,
                "join_existing": join_existing,
            }

            # Add existing tenant ID if joining existing tenant
            if join_existing:
                registration_data["existing_tenant_id"] = existing_tenant_id

            verification = EmailVerification(
                email=user_data.email.lower(),
                token=verification_token,
                registration_data=registration_data,
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
                    tenant_name=tenant_name
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

    # Handle tenant creation or joining based on registration type
    if reg_data.get("join_existing", False):
        # Join existing tenant
        tenant_id = reg_data["existing_tenant_id"]
        tenant = await db.get(Tenant, tenant_id)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The tenant you're trying to join no longer exists"
            )

        # Create user as regular USER (not TENANT_ADMIN for existing tenants)
        new_user = User(
            email=email,
            hashed_password=reg_data["hashed_password"],
            full_name=reg_data["full_name"],
            tenant_id=tenant.id,
            role=UserRole.USER,  # Regular user when joining existing tenant
            is_active=True,
            is_verified=True,
        )
        db.add(new_user)
        await db.flush()

        # Create UserTenant membership
        user_tenant = UserTenant(
            user_id=new_user.id,
            tenant_id=tenant.id,
            role=UserRole.USER.value,
            is_active=True,
        )
        db.add(user_tenant)
    else:
        # Create new tenant
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

        # Create user as TENANT_ADMIN (first user in new tenant)
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

    # Update last login time
    user.last_login_at = datetime.utcnow()
    await db.commit()

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


# ── Password Reset ────────────────────────────────────────────────────────────

_RESET_TOKEN_EXPIRE_MINUTES = 60


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(request: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Send a password reset email if the address is registered.
    Always returns 200 to prevent email enumeration.
    """
    result = await db.execute(select(User).where(User.email == request.email.lower()))
    user = result.scalar_one_or_none()

    if user and user.is_active:
        reset_payload = {
            "sub": str(user.id),
            "email": user.email,
            "purpose": "password_reset",
            "exp": datetime.utcnow() + timedelta(minutes=_RESET_TOKEN_EXPIRE_MINUTES),
            "iat": datetime.utcnow(),
        }
        reset_token = jwt.encode(reset_payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        try:
            from app.services.email_service import EmailService
            EmailService.send_password_reset_email(user.email, reset_token)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to send password reset email: {e}")

    return {"message": "If that email is registered, you'll receive a reset link shortly."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(request: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Validate the reset token and update the user's password.
    """
    try:
        payload = jwt.decode(request.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has expired. Please request a new one.",
        )

    if payload.get("purpose") != "password_reset":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token.")

    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found.")

    user.hashed_password = get_password_hash(request.new_password)
    await db.commit()

    return {"message": "Password updated successfully. You can now sign in."}


# ── Social Login (Google / GitHub) ────────────────────────────────────────────

_SOCIAL_PROVIDERS = {
    "google": {
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scopes": "openid email profile",
        "client_id_key": "GOOGLE_OAUTH_CLIENT_ID",
        "client_secret_key": "GOOGLE_OAUTH_CLIENT_SECRET",
        "callback_path": "/api/v1/auth/social/google/callback",
    },
    "github": {
        "auth_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_url": "https://api.github.com/user",
        "emails_url": "https://api.github.com/user/emails",
        "scopes": "read:user user:email",
        "client_id_key": "GITHUB_OAUTH_CLIENT_ID",
        "client_secret_key": "GITHUB_OAUTH_CLIENT_SECRET",
        "callback_path": "/api/v1/auth/social/github/callback",
    },
}


def _get_provider_credentials(provider: str) -> tuple[str, str]:
    """Return (client_id, client_secret) for the given provider, raising 501 if not configured."""
    cfg = _SOCIAL_PROVIDERS[provider]
    client_id = getattr(settings, cfg["client_id_key"], "")
    client_secret = getattr(settings, cfg["client_secret_key"], "")
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"{provider.title()} OAuth is not configured on this server.",
        )
    return client_id, client_secret


def _build_state_token(provider: str, next_url: str = "") -> str:
    """Create a short-lived JWT to use as the OAuth state parameter."""
    payload = {
        "sub": secrets.token_urlsafe(32),
        "provider": provider,
        "next": next_url,
        "exp": datetime.utcnow() + timedelta(minutes=5),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _decode_state_token(state: str) -> dict:
    """Validate the OAuth state JWT. Raises HTTPException on failure."""
    try:
        payload = jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state. Please try again.",
        )


@router.get("/social/{provider}")
async def social_login_redirect(provider: str, next: str = ""):
    """
    Begin OAuth2 flow for the given provider (google or github).
    Redirects the browser to the provider's authorization page.
    """
    if provider not in _SOCIAL_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown provider: {provider}")

    client_id, _ = _get_provider_credentials(provider)
    cfg = _SOCIAL_PROVIDERS[provider]

    state = _build_state_token(provider, next_url=next)

    # Build the callback URL from FRONTEND_URL so it matches the registered redirect URI
    base = settings.FRONTEND_URL.rstrip("/")
    # Callback is served by the backend — use the API path directly on the same origin
    # In production the frontend and API share the same domain (evols.ai).
    redirect_uri = f"{base}{cfg['callback_path']}"

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": cfg["scopes"],
        "state": state,
    }
    if provider == "google":
        params["access_type"] = "online"
        params["prompt"] = "select_account"

    auth_url = f"{cfg['auth_url']}?{urlencode(params)}"
    return RedirectResponse(url=auth_url, status_code=302)


@router.get("/social/{provider}/callback")
async def social_login_callback(
    provider: str,
    code: str = "",
    state: str = "",
    error: str = "",
    db: AsyncSession = Depends(get_db),
):
    """
    OAuth2 callback endpoint.
    Validates state, exchanges code for access token, fetches user profile,
    finds-or-creates the Evols user + tenant, issues an Evols JWT,
    then redirects to {FRONTEND_URL}/?social_token={jwt}.
    """
    if provider not in _SOCIAL_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown provider: {provider}")

    frontend_url = settings.FRONTEND_URL.rstrip("/")

    if error:
        return RedirectResponse(url=f"{frontend_url}/login?error={error}", status_code=302)

    if not code or not state:
        return RedirectResponse(url=f"{frontend_url}/login?error=missing_params", status_code=302)

    # Validate state
    state_payload = _decode_state_token(state)
    if state_payload.get("provider") != provider:
        return RedirectResponse(url=f"{frontend_url}/login?error=state_mismatch", status_code=302)

    next_url = state_payload.get("next") or ""

    client_id, client_secret = _get_provider_credentials(provider)
    cfg = _SOCIAL_PROVIDERS[provider]

    base = frontend_url
    redirect_uri = f"{base}{cfg['callback_path']}"

    # Exchange code for access token
    async with httpx.AsyncClient(timeout=15) as client:
        token_resp = await client.post(
            cfg["token_url"],
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Accept": "application/json"},
        )

    if token_resp.status_code != 200:
        return RedirectResponse(url=f"{frontend_url}/login?error=token_exchange_failed", status_code=302)

    token_data = token_resp.json()
    access_token_value = token_data.get("access_token")
    if not access_token_value:
        return RedirectResponse(url=f"{frontend_url}/login?error=no_access_token", status_code=302)

    # Fetch user profile
    auth_headers = {"Authorization": f"Bearer {access_token_value}"}
    async with httpx.AsyncClient(timeout=15) as client:
        profile_resp = await client.get(cfg["userinfo_url"], headers=auth_headers)

    if profile_resp.status_code != 200:
        return RedirectResponse(url=f"{frontend_url}/login?error=profile_fetch_failed", status_code=302)

    profile = profile_resp.json()

    if provider == "google":
        email = (profile.get("email") or "").lower().strip()
        full_name = profile.get("name") or profile.get("given_name") or email.split("@")[0]
        is_verified = profile.get("email_verified", False)
    else:
        # GitHub: primary email may not be in /user, fetch from /user/emails
        email = (profile.get("email") or "").lower().strip()
        full_name = profile.get("name") or profile.get("login") or ""
        if not email:
            async with httpx.AsyncClient(timeout=15) as client:
                emails_resp = await client.get(cfg["emails_url"], headers=auth_headers)
            if emails_resp.status_code == 200:
                for entry in emails_resp.json():
                    if entry.get("primary") and entry.get("verified"):
                        email = entry["email"].lower().strip()
                        break
        is_verified = True  # GitHub only returns verified emails

    if not email:
        return RedirectResponse(url=f"{frontend_url}/login?error=no_email", status_code=302)

    # Find or create user + tenant (mirrors the logic in register / verify_email)
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user:
        if not user.is_active:
            return RedirectResponse(url=f"{frontend_url}/login?error=account_deactivated", status_code=302)
        # Update last login
        user.last_login_at = datetime.utcnow()
        await db.commit()
    else:
        # Auto-create user + tenant using the same domain logic as register/verify_email
        email_domain = email.split("@")[1].lower()
        public_domains = {
            "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
            "icloud.com", "protonmail.com",
        }

        if email_domain in public_domains:
            # Personal workspace
            user_prefix = email.split("@")[0].replace(".", "-").replace("_", "-")
            uuid_suffix = str(uuid4())[:8]
            tenant_name = f"{full_name}'s Workspace" if full_name else f"{user_prefix}'s Workspace"
            tenant_slug = f"{user_prefix}-{uuid_suffix}"
            tenant_domain = None
            join_existing = False
        else:
            # Company domain — join existing or create new
            result = await db.execute(select(Tenant).where(Tenant.domain == email_domain))
            existing_tenant = result.scalar_one_or_none()
            if existing_tenant:
                join_existing = True
                existing_tenant_id = existing_tenant.id
                tenant_name = existing_tenant.name
                tenant_slug = existing_tenant.slug
                tenant_domain = existing_tenant.domain
            else:
                join_existing = False
                company_name = email_domain.split(".")[0].title()
                tenant_name = company_name
                tenant_slug = email_domain.replace(".", "-")
                tenant_domain = email_domain

        if join_existing:
            tenant = await db.get(Tenant, existing_tenant_id)
            new_user = User(
                email=email,
                hashed_password="",  # No password for social users
                full_name=full_name,
                tenant_id=tenant.id,
                role=UserRole.USER,
                is_active=True,
                is_verified=True,
            )
            db.add(new_user)
            await db.flush()
            user_tenant = UserTenant(
                user_id=new_user.id,
                tenant_id=tenant.id,
                role=UserRole.USER.value,
                is_active=True,
            )
            db.add(user_tenant)
        else:
            tenant = Tenant(
                name=tenant_name,
                slug=tenant_slug,
                domain=tenant_domain,
                is_active=True,
                is_trial=True,
                plan_type="free",
            )
            db.add(tenant)
            await db.flush()
            new_user = User(
                email=email,
                hashed_password="",  # No password for social users
                full_name=full_name,
                tenant_id=tenant.id,
                role=UserRole.TENANT_ADMIN,
                is_active=True,
                is_verified=True,
            )
            db.add(new_user)
            await db.flush()
            user_tenant = UserTenant(
                user_id=new_user.id,
                tenant_id=tenant.id,
                role=UserRole.TENANT_ADMIN.value,
                is_active=True,
            )
            db.add(user_tenant)

        await db.commit()
        await db.refresh(new_user)
        user = new_user

    # Issue Evols JWT
    evols_token = create_access_token(
        data={
            "user_id": user.id,
            "email": user.email,
            "tenant_id": user.tenant_id,
            "role": user.role.value,
        }
    )

    # Redirect to the login page — it detects ?social_token= and exchanges it for a session
    redirect_params = {"social_token": evols_token}
    if next_url:
        redirect_params["next"] = next_url
    redirect_target = f"{frontend_url}/login?{urlencode(redirect_params)}"
    return RedirectResponse(url=redirect_target, status_code=302)
