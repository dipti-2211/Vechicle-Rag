"""
Vehicle Maintenance RAG — FastAPI Application Entry Point

This is the main application module. It configures:
- CORS middleware for frontend access
- Lifespan events for startup/shutdown
- Health check endpoint
- All API route registrations
"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.utils.logging import setup_logging, get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Runs setup on startup and cleanup on shutdown.
    Future milestones will add ChromaDB initialization,
    Supabase client setup, etc. here.
    """
    settings = get_settings()

    # ── Startup ──────────────────────────────────────────────────────
    setup_logging(debug=settings.debug)
    logger.info(
        "Starting %s v%s [env=%s]",
        settings.app_name,
        settings.app_version,
        settings.app_env,
    )

    yield

    # ── Shutdown ─────────────────────────────────────────────────────
    logger.info("Shutting down %s", settings.app_name)


def create_app() -> FastAPI:
    """
    Application factory.

    Creates and configures the FastAPI application instance.
    Using a factory pattern makes testing easier and keeps
    configuration centralized.
    """
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "AI-powered Vehicle Maintenance Assistant using "
            "Retrieval-Augmented Generation (RAG) with Google Gemini."
        ),
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # ── CORS Middleware ──────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Health Check ─────────────────────────────────────────────────
    @app.get("/health", tags=["System"])
    async def health_check():
        """
        Health check endpoint.

        Returns the application status, version, and current timestamp.
        Used by deployment platforms (Render) to verify the service is alive.
        """
        return JSONResponse(
            content={
                "status": "healthy",
                "app": settings.app_name,
                "version": settings.app_version,
                "environment": settings.app_env,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

    @app.get("/", tags=["System"])
    async def root():
        """Root endpoint with API information."""
        return {
            "message": f"Welcome to {settings.app_name} API",
            "version": settings.app_version,
            "docs": "/docs",
            "health": "/health",
        }

    # ── Route Registration ───────────────────────────────────────────
    # Routes will be registered here in future milestones:
    # app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
    # app.include_router(documents_router, prefix="/api/documents", tags=["Documents"])
    # app.include_router(chat_router, prefix="/api/chat", tags=["Chat"])

    logger.info(
        "Application configured with CORS origins: %s",
        settings.cors_origins,
    )

    return app


# Create the application instance
app = create_app()
