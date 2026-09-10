"""
AquaYantra — FastAPI application factory.

Creates the application with all routers, middleware, exception handlers,
lifespan management, and OpenAPI documentation.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from app.core.config import settings
from app.core.errors import register_error_handlers
from app.core.logging import setup_logging, get_logger
from app.core.middleware import register_middleware

logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan — startup and shutdown hooks."""
    setup_logging()
    logger.info(
        "starting",
        app=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
    )

    # Initialize Redis
    from app.database.redis import get_redis
    await get_redis()

    # Create upload and model directories
    settings.upload_path
    settings.model_path

    logger.info("startup_complete")
    yield

    # Shutdown
    from app.database.redis import close_redis
    await close_redis()

    from app.database.session import engine
    await engine.dispose()

    logger.info("shutdown_complete")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="AquaYantra API",
        description=(
            "Backend API for AquaYantra — an underwater seabed anomaly/prospectivity "
            "assessment platform. Provides sensor data ingestion, auto-calibration, "
            "ML anomaly detection, spatial mapping, and real-time monitoring."
        ),
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # Middleware
    register_middleware(app)

    # Exception handlers
    register_error_handlers(app)

    # REST API v1
    from app.api.v1.router import router as v1_router
    app.include_router(v1_router)

    # WebSocket routes
    from app.websocket.manager import router as ws_router
    app.include_router(ws_router)

    # Root health check
    @app.get("/", tags=["Root"])
    async def root():
        return {
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "running",
            "docs": "/docs",
        }

    return app


app = create_app()
