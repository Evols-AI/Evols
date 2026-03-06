"""
Database Configuration and Session Management
AsyncIO-compatible PostgreSQL with pgvector support
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool

from app.core.config import settings

# Convert postgresql:// to postgresql+asyncpg://
database_url = settings.DATABASE_URL
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")

# Create async engine
engine = create_async_engine(
    database_url,
    echo=False,  # Disabled SQL query logging to reduce noise
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_pre_ping=True,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for all models
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting database session (NO AUTO-COMMIT)

    Usage: db: AsyncSession = Depends(get_db)

    IMPORTANT: This does NOT auto-commit. Use @transactional decorator or explicit commits.

    Rationale:
    - Enables complex transactions with multiple operations
    - Prevents partial commits on failures
    - Allows proper rollback handling
    - Better for testing and debugging
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            # ❌ REMOVED AUTO-COMMIT - use @transactional or explicit commit
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
