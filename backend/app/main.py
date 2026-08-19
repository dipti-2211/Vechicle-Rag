"""
Vehicle Intelligence Assistant — FastAPI Application Entry Point

Configures:
- CORS middleware for frontend access
- Error handling for structured error responses
- Database lifecycle:
    Production → Supabase PostgreSQL (PostgREST via supabase-py)
    Local dev   → SQLite (when SUPABASE_URL is not set)
- Supabase Storage initialization
- ChromaDB vector index rebuild from persistent chunks on startup
- Health check endpoint
- Route registrations
"""

import asyncio
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
from app.routes import auth as auth_routes
from app.services.document_service import DocumentService
from app.utils.logging import setup_logging, get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan: startup → yield → shutdown.

    Startup order:
      1. Logging
      2. Database (Supabase PostgREST or SQLite)
      3. Supabase Storage warmup
      4. VectorStore / embedding model
      5. ChromaDB rebuild from persistent chunks (if collection is empty)
    """
    settings = get_settings()
    setup_logging(debug=settings.debug)

    logger.info(
        "Starting %s v%s [env=%s]",
        settings.app_name,
        settings.app_version,
        settings.app_env,
    )

    # Ensure local upload directory always exists (fallback storage)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

    # ── Database initialization ───────────────────────────────────────
    if settings.supabase_configured:
        logger.info("Supabase configured — connecting via PostgREST...")
        try:
            from supabase import create_client
            from app.models.supabase_database import init_supabase_database_sync

            sb_client = create_client(
                settings.supabase_url,
                settings.supabase_service_role_key,
            )

            # ── Connectivity probe ─────────────────────────────────────
            # Do a lightweight real request to catch invalid keys immediately
            # (create_client is lazy and doesn't validate the key itself).
            loop = asyncio.get_running_loop()
            probe_result = await loop.run_in_executor(
                None,
                lambda: sb_client.table("documents").select("id").limit(1).execute()
            )
            logger.info("✅ Supabase probe succeeded (%d rows).", len(probe_result.data))

            sb_db = init_supabase_database_sync(sb_client)
            await sb_db.connect()
            set_database(sb_db)
            logger.info("✅ Supabase PostgREST database ready.")

        except Exception as db_err:
            err_str = str(db_err)
            if "Invalid API key" in err_str or "401" in err_str or "Unauthorized" in err_str:
                logger.error(
                    "⚠️  Supabase API key rejected — falling back to SQLite.\n"
                    "   Check SUPABASE_SERVICE_ROLE_KEY is the legacy 'service_role' JWT (eyJ...), "
                    "not the new 'sb_secret_...' format.\n"
                    "   Get it from: Supabase Dashboard → Settings → API Keys → "
                    "Legacy anon, service_role API keys tab.\n"
                    "   Error: %s", err_str
                )
            else:
                logger.error("Supabase DB init failed: %s — falling back to SQLite", db_err)
            Path(settings.database_path).parent.mkdir(parents=True, exist_ok=True)
            await init_database(settings.database_path)
            logger.info("SQLite fallback initialized: %s", settings.database_path)
    else:
        logger.info("Supabase not configured — using SQLite (local dev mode).")
        Path(settings.database_path).parent.mkdir(parents=True, exist_ok=True)
        await init_database(settings.database_path)
        logger.info("SQLite initialized: %s", settings.database_path)

    # ── Validate required env vars ────────────────────────────────────
    if not settings.gemini_api_key:
        logger.critical(
            "⚠️  GEMINI_API_KEY is not set — chat/RAG features will NOT work."
        )
    else:
        logger.info("✅ GEMINI_API_KEY is set.")

    # ── Supabase Storage client warmup ────────────────────────────────
    if settings.supabase_configured:
        try:
            from app.services.supabase_client import get_supabase_client
            sc = get_supabase_client()
            if sc:
                logger.info(
                    "✅ Supabase Storage client ready (bucket: %s).",
                    settings.supabase_storage_bucket,
                )
        except Exception as sc_err:
            logger.warning("Supabase Storage warmup: %s", sc_err)

    # ── Startup recovery: handle documents stuck in 'processing' ─────
    # On Render free-tier, background tasks are lost when the instance sleeps/restarts.
    # On startup, we find any stuck 'processing' docs and either retry or mark as error.
    # NOTE: VectorStore is NOT pre-loaded here — it is lazy-initialized on first request
    # to avoid loading the embedding model (Gemini API client) unnecessarily at startup.
    #
    # Documents are processed SEQUENTIALLY (not in parallel) with a delay between each
    # to avoid triggering the Gemini embedding-quota rate-limit cascade that occurs when
    # multiple documents fire simultaneous embedding API calls at startup.
    try:
        db = get_database()
        stuck_rows = await db.fetch_all(
            "SELECT * FROM documents WHERE status = ?",
            ("processing",),
        )
        if stuck_rows:
            logger.warning(
                "⚠️  Found %d document(s) stuck in 'processing' — attempting sequential recovery...",
                len(stuck_rows),
            )
            service = DocumentService(db)

            async def _sequential_recovery(rows, svc):
                """
                Re-process stuck documents one at a time.

                Runs as a single background task (via asyncio.create_task) so startup
                is not blocked, but each document is awaited to completion before the
                next one starts. A 5-second sleep between documents gives the Gemini
                embedding API headroom to reset its per-minute request window.
                """
                from app.routes.documents import _process_document
                for row in rows:
                    doc_id = row["id"]
                    file_path = row.get("file_path", "")
                    original_filename = row.get("original_filename", "unknown")
                    file_type = row.get("file_type", "")

                    if file_path and Path(file_path).exists():
                        # File is on disk — re-process and await completion
                        logger.info(
                            "Recovery: re-processing document %s (%s)...",
                            doc_id, original_filename,
                        )
                        try:
                            await _process_document(
                                doc_id=doc_id,
                                file_path=file_path,
                                file_type=file_type,
                                original_filename=original_filename,
                                storage_path=row.get("storage_path"),
                                user_id=row.get("user_id"),  # preserve ownership
                            )
                        except Exception as proc_err:
                            logger.error(
                                "Recovery: processing failed for %s (%s): %s",
                                doc_id, original_filename, proc_err,
                            )
                        # Breathing room between documents — prevents Gemini RPM burst
                        await asyncio.sleep(5)
                    else:
                        # File missing (ephemeral disk was wiped) — mark as error immediately
                        logger.warning(
                            "Recovery: file missing for %s (%s) — marking as error.",
                            doc_id, original_filename,
                        )
                        await svc.update_document_status(
                            document_id=doc_id,
                            status="error",
                            error_message=(
                                "Processing was interrupted (server restart). "
                                "Please re-upload this document."
                            ),
                        )

            asyncio.create_task(_sequential_recovery(stuck_rows, service))

    except Exception as recovery_err:
        logger.error("Startup recovery failed: %s", recovery_err)

    yield

    # ── Shutdown ─────────────────────────────────────────────────────
    await close_database()
    logger.info("Shutting down %s", settings.app_name)


def create_app() -> FastAPI:
    """Application factory."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "AI-powered Vehicle Intelligence Assistant using "
            "Retrieval-Augmented Generation (RAG) with Google Gemini."
        ),
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # ── CORS ─────────────────────────────────────────────────────────
    # The frontend always sends `Authorization: Bearer <token>` (a credentialed
    # request). Browsers block credentialed requests when allow_origins=["*"].
    # So we ALWAYS use the explicit origin list, never wildcard, and always
    # enable allow_credentials=True.
    #
    # Dev list (from config): localhost:5173, localhost:3000
    # Prod list (from config): + production Render URL
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,   # explicit list — never "*"
        allow_credentials=True,                 # required for Authorization header
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Global Error Handlers ────────────────────────────────────────

    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
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
        """Health check endpoint. Used by Render to verify the service is alive."""
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
        }

    # ── Routes ───────────────────────────────────────────────────────
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
    app.include_router(
        auth_routes.router,
        prefix="/api/auth",
        tags=["Auth"],
    )

    return app


app = create_app()
