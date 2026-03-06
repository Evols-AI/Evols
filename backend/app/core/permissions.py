"""
Permission Decorators
Role-based access control for API endpoints
"""

from fastapi import HTTPException, status
from app.models.user import User, UserRole


def require_super_admin(user: User) -> None:
    """
    Require user to be SUPER_ADMIN or PRODUCT_ADMIN

    Raises:
        HTTPException: 403 if user is not a super admin
    """
    if not user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This operation requires super admin privileges"
        )


def require_tenant_admin(user: User) -> None:
    """
    Require user to be TENANT_ADMIN, PRODUCT_ADMIN, or SUPER_ADMIN

    Raises:
        HTTPException: 403 if user is not an admin
    """
    if user.role not in [UserRole.SUPER_ADMIN, UserRole.PRODUCT_ADMIN, UserRole.TENANT_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This operation requires tenant admin privileges"
        )


def require_admin(user: User) -> None:
    """
    Require user to be any kind of admin (SUPER_ADMIN, PRODUCT_ADMIN, or TENANT_ADMIN)

    Raises:
        HTTPException: 403 if user is not an admin
    """
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This operation requires admin privileges"
        )


def require_same_tenant(user: User, target_tenant_id: int) -> None:
    """
    Require user to belong to the target tenant (unless SUPER_ADMIN)

    Args:
        user: Current authenticated user
        target_tenant_id: The tenant ID being accessed

    Raises:
        HTTPException: 403 if user is not in the target tenant and not a super admin
    """
    # Super admins can access any tenant
    if user.is_super_admin:
        return

    # Regular users and tenant admins must be in the same tenant
    if user.tenant_id != target_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this tenant"
        )


def require_same_tenant_or_admin(user: User, target_tenant_id: int) -> None:
    """
    Require user to belong to the target tenant OR be a super admin

    This is similar to require_same_tenant but with a clearer name for use cases
    where we explicitly want to allow super admin access.

    Args:
        user: Current authenticated user
        target_tenant_id: The tenant ID being accessed

    Raises:
        HTTPException: 403 if user is not in the target tenant and not a super admin
    """
    require_same_tenant(user, target_tenant_id)
