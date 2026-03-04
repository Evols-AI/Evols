"""
Core Decorators
Reusable decorators for transaction management, auth, etc.
"""

from functools import wraps
from typing import Callable, Any
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger


def transactional(func: Callable) -> Callable:
    """
    Decorator for explicit transaction management

    Automatically commits on success, rolls back on exception.

    Usage:
        @router.post("/endpoint")
        @transactional
        async def my_endpoint(db: AsyncSession = Depends(get_db)):
            # All changes here are part of one transaction
            db.add(new_record)
            return {"success": True}
            # Decorator commits if we reach here

    Important:
    - Function MUST have a parameter named 'db' of type AsyncSession
    - Commit happens after function returns successfully
    - Rollback happens on any exception
    - Use for endpoints that modify data

    Do NOT use for:
    - Read-only endpoints (no commit needed)
    - Endpoints with nested transactions (use explicit commits)
    - Background tasks (they manage their own transactions)
    """

    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Extract db session from kwargs
        db: AsyncSession = kwargs.get("db")

        if db is None:
            # Try to find it in args (positional parameters)
            for arg in args:
                if isinstance(arg, AsyncSession):
                    db = arg
                    break

        if db is None:
            raise ValueError(
                f"@transactional decorator requires a 'db' parameter of type AsyncSession. "
                f"Function: {func.__name__}"
            )

        try:
            # Execute function
            result = await func(*args, **kwargs)

            # ✅ EXPLICIT COMMIT on success
            await db.commit()

            logger.debug(
                f"[Transaction] Committed: {func.__name__}"
            )

            return result

        except Exception as e:
            # ❌ EXPLICIT ROLLBACK on error
            await db.rollback()

            logger.error(
                f"[Transaction] Rolled back: {func.__name__}, error: {e}",
                exc_info=True
            )

            raise

    return wrapper


def read_only(func: Callable) -> Callable:
    """
    Decorator for read-only endpoints (no transaction management needed)

    Use this to mark endpoints that only read data, never write.
    This is documentation-only, no actual behavior change.

    Usage:
        @router.get("/endpoint")
        @read_only
        async def my_endpoint(db: AsyncSession = Depends(get_db)):
            return await db.execute(select(Model))
    """

    @wraps(func)
    async def wrapper(*args, **kwargs):
        return await func(*args, **kwargs)

    return wrapper
