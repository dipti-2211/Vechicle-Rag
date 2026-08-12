"""
Vehicle Intelligence Assistant — FastAPI Application Entry Point

Configures:
- CORS middleware for frontend access
- Error handling middleware for structured error responses
- Database lifecycle (Supabase PostgreSQL in production, SQLite locally)
- Supabase Storage initialization
- ChromaDB vector index rebuild from Supabase chunks on startup
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
from app.models.database import init_database, close_database, get_database, set_database
from app.models.schemas import HealthResponse
from app.routes import documents as document_routes
from app.routes import chat as chat_routes
from app.services.document_service import DocumentService
from app.utils.logging import setup_logging, get_logger

logger = get_logger(__name__)

# Track Supabase status for health check
_supabase_ok: bool = False
_db_type: str = "sqlite"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Startup:
      1. Initialize logging
      2. Initialize database (Supabase PostgreSQL if configured, else SQLite)
      3. Upload directory setup
      4. Supabase Storage client initialization
      5. VectorStore warm-up (loads embedding model)
      6. ChromaDB rebuild from Supabase if collection is empty

    Shutdown:
      - Close database connection
    """
    global _supabase_ok, _db_type
    settings = get_settings()

    # ── Startup ──────────────────────────────────────────────────────
    setup_logging(debug=settings.debug)
    logger.info(
        "Starting %s v%s [env=%s]",
        settings.app_name,
        settings.app_version,
        settings.app_env,
    )

    # Ensure local upload directory exists (fallback even with Supabase Storage)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

    # ── Database initialization ───────────────────────────────────────
    if settings.supabase_configured:
        logger.info("Supabase configured — initializing PostgreSQL database...")
        try:
            from app.models.supabase_database import init_supabase_database
            # Build the PostgreSQL connection string from Supabase URL
            # Supabase direct connection: postgresql://postgres.[project-ref]:[password]@aws-0-*.pooler.supabase.com:5432/postgres
            # We derive it from SUPABASE_URL and SERVICE_ROLE_KEY per Supabase docs convention.
            # The caller must set SUPABASE_DB_URL explicitly (direct connection string) OR
            # we fall back to SQLite and warn.
            db_url = settings.supabase_db_url if hasattr(settings, 'supabase_db_url') and settings.supabase_db_url else ""

            if db_url:
                sb_db = await init_supabase_database(db_url)
                set_database(sb_db)
                _db_type = "supabase_postgresql"
                _supabase_ok = True
                logger.info("✅ Supabase PostgreSQL database initialized.")
            else:
                # Supabase Storage is configured but no direct DB URL —
                # use SQLite locally and Supabase Storage for files only.
                logger.warning(
                    "SUPABASE_DB_URL not set. Falling back to SQLite for metadata. "
                    "Set SUPABASE_DB_URL to enable full Supabase PostgreSQL persistence."
                )
                Path(settings.database_path).parent.mkdir(parents=True, exist_ok=True)
                await init_database(settings.database_path)
                _db_type = "sqlite_with_supabase_storage"
                _supabase_ok = True  # storage still works
                logger.info("SQLite initialized at: %s", settings.database_path)

        except Exception as db_err:
            logger.error("Supabase DB init failed: %s — falling back to SQLite", db_err)
            Path(settings.database_path).parent.mkdir(parents=True, exist_ok=True)
            await init_database(settings.database_path)
            _db_type = "sqlite_fallback"
    else:
        # Local development — use SQLite
        logger.info("Supabase not configured — using SQLite database.")
        Path(settings.database_path).parent.mkdir(parents=True, exist_ok=True)
        await init_database(settings.database_path)
        _db_type = "sqlite"
        logger.info("SQLite database initialized at: %s", settings.database_path)

    # ── Environment validation ────────────────────────────────────────
    _missing: list[str] = []
    if not settings.gemini_api_key:
        _missing.append("GEMINI_API_KEY")
    if not settings.gemini_llm_model:
        _missing.append("GEMINI_MODEL")
    if _missing:
        logger.critical(
            "⚠️  MISSING REQUIRED ENVIRONMENT VARIABLES: %s\n"
            "   RAG query features will NOT work until this is fixed.",
            ", ".join(_missing),
        )
    else:
        logger.info("✅ Environment validated — all required variables present.")

    # ── Supabase Storage client warmup ────────────────────────────────
    if settings.supabase_configured:
        try:
            from app.services.supabase_client import get_supabase_client
            sc = get_supabase_client()
            if sc:
                logger.info("✅ Supabase Storage client ready (bucket: %s).", settings.supabase_storage_bucket)
        except Exception as sc_err:
            logger.warning("Supabase Storage client init warning: %s", sc_err)

    # ── VectorStore warm-up ───────────────────────────────────────────
    vector_store_instance = None
    try:
        from app.routes.documents import _get_vector_store
        logger.info("Pre-loading embedding model and ChromaDB...")
        vector_store_instance = _get_vector_store()
        logger.info(
            "✅ VectorStore ready (%d vectors in collection).",
            vector_store_instance.get_collection_count(),
        )
    except Exception as vs_err:
        logger.error("VectorStore failed to initialize: %s", vs_err)

    # ── ChromaDB rebuild from Supabase chunks (if collection empty) ───
    if vector_store_instance is not None:
        try:
            db = get_database()
            from app.services.chunk_store import rebuild_chromadb_from_supabase
            rebuilt = await rebuild_chromadb_from_supabase(db, vector_store_instance)
            if rebuilt > 0:
                logger.info(
                    "✅ ChromaDB rebuilt: %d documents reloaded from persistent storage.",
                    rebuilt,
                )
        except Exception as rebuild_err:
            logger.warning("ChromaDB rebuild skipped: %s", rebuild_err)

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
    # In development: allow all origins so any Vite port (5173, 5174…) works.
    # In production: restrict to the configured allow-list for security.
    _cors_origins = ["*"] if not settings.is_production else settings.cors_origins
    _cors_creds   = False  # Must be False when allow_origins=["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=_cors_creds,
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
