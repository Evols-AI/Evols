"""
FastAPI Application Entry Point
Main application with all routers and middleware configuration
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from loguru import logger

from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1 import api_router
from app.services.scheduler_service import scheduler_service
from app.middleware import SecurityHeadersMiddleware, SecurityValidationMiddleware

# Import all models so they are registered with Base.metadata before create_all
import app.models  # noqa: F401


async def _sync_aws_credentials_to_tenant() -> None:
    """
    If AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars are present, write them
    into every active tenant's llm_config that is configured for aws_bedrock.
    This lets credential rotation happen via Secret Manager + redeploy without
    requiring a manual UI update in LLM Settings.
    Runs once at startup; errors are logged but never fatal.
    """
    access_key_id = os.environ.get("AWS_ACCESS_KEY_ID", "").strip()
    secret_access_key = os.environ.get("AWS_SECRET_ACCESS_KEY", "").strip()
    if not access_key_id or not secret_access_key:
        return

    try:
        from sqlalchemy import select
        from sqlalchemy.ext.asyncio import AsyncSession
        from app.core.database import AsyncSessionLocal
        from app.models.tenant import Tenant
        from app.core.security import encrypt_llm_config, decrypt_llm_config

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Tenant).where(Tenant.is_active == True))  # noqa: E712
            tenants = result.scalars().all()
            updated = 0
            for tenant in tenants:
                if not tenant.llm_config:
                    continue
                try:
                    cfg = decrypt_llm_config(tenant.llm_config)
                except Exception:
                    continue
                if cfg.get("provider") != "aws_bedrock":
                    continue
                if cfg.get("access_key_id") == access_key_id and cfg.get("secret_access_key") == secret_access_key:
                    continue
                cfg["access_key_id"] = access_key_id
                cfg["secret_access_key"] = secret_access_key
                tenant.llm_config = encrypt_llm_config(cfg)
                updated += 1
            if updated:
                await db.commit()
                logger.info(f"Synced AWS credentials from env into {updated} tenant(s)")
    except Exception as e:
        logger.error(f"Failed to sync AWS credentials to tenant config: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    """
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")

    # Create database tables on startup (idempotent — safe to run every time)
    try:
        async with engine.begin() as conn:
            # Try to enable pgvector extension (may fail on Postgres without pgvector — safe to ignore)
            try:
                await conn.execute(__import__('sqlalchemy').text("CREATE EXTENSION IF NOT EXISTS vector"))
                logger.info("pgvector extension ready")
            except Exception as ext_err:
                logger.warning(f"pgvector extension not available (embeddings disabled): {ext_err}")
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully")
    except Exception as db_err:
        logger.error(f"Database initialization error: {db_err}")
        raise
    logger.info(f"API Documentation available at: {settings.API_V1_PREFIX}/docs")

    # Sync AWS credentials from env into tenant config (no-op when env vars absent)
    await _sync_aws_credentials_to_tenant()

    # Start background scheduler for periodic tasks
    try:
        scheduler_service.start()
        logger.info("Background scheduler started successfully")
    except Exception as sched_err:
        logger.error(f"Failed to start scheduler: {sched_err}")

    yield

    # Shutdown
    logger.info("Shutting down application...")

    # Stop scheduler
    try:
        scheduler_service.shutdown()
        logger.info("Scheduler stopped")
    except Exception as e:
        logger.error(f"Error stopping scheduler: {e}")

    await engine.dispose()
    logger.info("Shutdown complete")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="AI-native Product Decision Operating System for senior PMs at B2B SaaS companies",
    version=settings.APP_VERSION,
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    lifespan=lifespan,
)

# Add security middleware first (outermost layer)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(SecurityValidationMiddleware)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add GZip middleware for response compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    """Root endpoint - Health check"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info" if settings.DEBUG else "warning",
    )
