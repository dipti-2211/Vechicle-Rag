"""
Vehicle Intelligence Assistant — FastAPI Application Entry Point

Configures:
- CORS middleware for frontend access
- Error handling middleware for structured error responses
- Database lifecycle (connect on startup, close on shutdown)
- Health check endpoint with live stats
- All API route registrations
"""

import logging
import traceback
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.models.database import init_database, close_database, get_database
from app.models.schemas import HealthResponse
from app.routes import documents as document_routes
from app.routes import chat as chat_routes
from app.services.document_service import DocumentService
from app.utils.logging import setup_logging, get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Startup: Initialize logging, database, and ensure directories exist.
    Shutdown: Close database connection.
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

    # Ensure upload and data directories exist
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.database_path).parent.mkdir(parents=True, exist_ok=True)

    # Initialize SQLite database
    await init_database(settings.database_path)
    logger.info("Database initialized at: %s", settings.database_path)

    # ── Environment validation ────────────────────────────────────────
    # Warn loudly if critical config is missing — don't hard-crash so
    # Docker health checks can still respond during misconfiguration.
    _missing: list[str] = []
    if not settings.gemini_api_key:
        _missing.append("GEMINI_API_KEY")
    if not settings.gemini_llm_model:
        _missing.append("GEMINI_MODEL")

    if _missing:
        logger.critical(
            "⚠️  MISSING REQUIRED ENVIRONMENT VARIABLES: %s\n"
            "   Copy backend/.env.example → backend/.env and fill in the values.\n"
            "   RAG query features will NOT work until this is fixed.",
            ", ".join(_missing),
        )
    else:
        logger.info("✅ Environment validated — all required variables present.")

    yield

    # ── Shutdown ─────────────────────────────────────────────────────
    await close_database()
    logger.info("Shutting down %s", settings.app_name)


def create_app() -> FastAPI:
    """
    Application factory.

    Creates and configures the FastAPI application instance
    with middleware, error handlers, and routes.
    """
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "AI-powered Vehicle Intelligence Assistant using "
            "Retrieval-Augmented Generation (RAG) with Google Gemini. "
            "Upload vehicle documents and get intelligent answers."
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

    # ── Global Error Handlers ────────────────────────────────────────

    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        """Return structured JSON for 404 errors."""
        return JSONResponse(
            status_code=404,
            content={
                "error": "Not Found",
                "detail": str(exc.detail) if hasattr(exc, "detail") else "Resource not found",
                "status_code": 404,
            },
        )

    @app.exception_handler(422)
    async def validation_error_handler(request: Request, exc):
        """Return structured JSON for validation errors."""
        return JSONResponse(
            status_code=422,
            content={
                "error": "Validation Error",
                "detail": str(exc) if not hasattr(exc, "detail") else str(exc.detail),
                "status_code": 422,
            },
        )

    @app.exception_handler(500)
    async def internal_error_handler(request: Request, exc):
        """Return structured JSON for unhandled server errors."""
        logger.error("Internal server error: %s\n%s", exc, traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal Server Error",
                "detail": "An unexpected error occurred. Please try again.",
                "status_code": 500,
            },
        )

    # ── Health Check ─────────────────────────────────────────────────

    @app.get("/health", tags=["System"], response_model=HealthResponse)
    async def health_check() -> HealthResponse:
        """
        Health check endpoint with live statistics.

        Returns status, version, environment, and document count.
        Used by Render to verify the service is alive.
        """
        try:
            db = get_database()
            doc_service = DocumentService(db)
            doc_count = await doc_service.get_document_count()
        except Exception:
            doc_count = 0

        return HealthResponse(
            status="healthy",
            app=settings.app_name,
            version=settings.app_version,
            environment=settings.app_env,
            timestamp=datetime.now(timezone.utc).isoformat(),
            documents_count=doc_count,
        )

    @app.get("/", tags=["System"])
    async def root():
        """Root endpoint with API information."""
        return {
            "message": f"Welcome to {settings.app_name} API",
            "version": settings.app_version,
            "docs": "/docs",
            "health": "/health",
            "endpoints": {
                "documents": "/api/documents",
                "chat": "/api/chat",
            },
        }

    # ── Route Registration ───────────────────────────────────────────
    app.include_router(
        document_routes.router,
        prefix="/api/documents",
        tags=["Documents"],
    )
    app.include_router(
        chat_routes.router,
        prefix="/api/chat",
        tags=["Chat"],
    )

    logger.info(
        "Application configured — CORS: %s | DB: %s",
        settings.cors_origins,
        settings.database_path,
    )

    return app


# Create the application instance
app = create_app()
