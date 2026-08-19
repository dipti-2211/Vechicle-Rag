"""
Vehicle Intelligence Assistant — Document Routes

REST API endpoints for document management:
- POST   /api/documents          → Upload a document (triggers background processing)
- GET    /api/documents          → List all documents (scoped to current user)
- GET    /api/documents/{id}     → Get a single document
- DELETE /api/documents/{id}     → Delete a document + vectors

Background Pipeline (triggered after upload):
  Save locally → upload to Supabase Storage → parse → chunk → embed → persist chunks → mark READY

All endpoints are user-scoped: documents are isolated per authenticated user.
"""

import asyncio
import logging
import uuid
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, File, status

from app.auth.deps import get_current_user, CurrentUser
from app.config import get_settings
from app.models.database import get_database
from app.models.schemas import (
    DocumentResponse,
    DocumentListResponse,
    DocumentDeleteResponse,
    DocumentPreviewResponse,
    DocumentStats,
    DocumentStatusResponse,
    ErrorResponse,
)
from app.services.document_service import DocumentService
from app.services.vector_store import VectorStore
from app.services.parser import DocumentParser
from app.services.chunker import DocumentChunker
from app.services.metadata_extractor import MetadataExtractor

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Embedding concurrency gate ────────────────────────────────────────────────
# Limits simultaneous Gemini embedding calls to 1 across ALL background tasks.
# If the user uploads 3 files at once, each upload returns 201 immediately, but
# their embedding stages are serialised here → no concurrent RPM exhaustion.
_embed_semaphore = asyncio.Semaphore(1)


# ── Shared singleton vector store (expensive to init) ────────────────────────
# We load it once at module level so the embedding model isn't reloaded per request.
_vector_store: Optional[VectorStore] = None


def _get_vector_store() -> VectorStore:
    """Get or create the singleton VectorStore instance."""
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store


def _get_service() -> DocumentService:
    """Create a DocumentService with the current database."""
    return DocumentService(get_database())


def _friendly_error(raw: str) -> str:
    """
    Convert a raw technical exception string into a short, safe user-facing message.

    The full error is always written to the server log; this function only produces
    the message stored in the database (and shown in the UI).  No credentials,
    API keys, or internal stack details are included.
    """
    low = raw.lower()

    # ── Daily quota (RPD) ────────────────────────────────────────────────────
    if (
        "daily" in low
        or "requests_per_day" in low
        or "embedcontentrequeststperday" in low
        or ("quota" in low and "day" in low)
        or "12:30 pm ist" in low
    ):
        return (
            "Embedding quota exhausted for today (1,000 requests/day free-tier limit). "
            "Quota resets at 12:30 PM IST. Please try again after the reset."
        )

    # ── Per-minute quota (RPM / TPM) ─────────────────────────────────────────
    if "429" in raw or "resource_exhausted" in low or "quota" in low or "rate" in low:
        return (
            "Embedding service is temporarily rate-limited. "
            "Please wait a minute and retry this document."
        )

    # ── Transport / connection errors ─────────────────────────────────────────
    if (
        "disconnected" in low
        or "connectionterminated" in low
        or "connection reset" in low
        or "eof" in low
        or "broken pipe" in low
        or "timeout" in low
        or "timed out" in low
        or "network" in low
        or "stream_id" in low
        or "error_code:1" in low
    ):
        return (
            "Embedding service connection failed (network error). "
            "Please retry this document."
        )

    # ── Parser / chunker ──────────────────────────────────────────────────────
    if "parser" in low or "empty text" in low or "zero chunks" in low or "blank" in low:
        return (
            "Could not extract text from this document. "
            "Check that the file is not blank or image-only, then retry."
        )

    # ── Generic fallback ──────────────────────────────────────────────────────
    return "Document processing failed. Please retry the document."


# ── Background Processing Pipeline ───────────────────────────────────────────

async def _process_document(
    doc_id: str,
    file_path: str,
    file_type: str,
    original_filename: str,
    storage_path: Optional[str] = None,
    user_id: Optional[str] = None,
) -> None:
    """
    Background task: upload to Supabase Storage → parse → chunk → embed →
    persist chunks → update status='ready'.

    This runs AFTER the upload endpoint has returned 201 to the client.

    Args:
        doc_id: Document UUID (already in the database as 'processing').
        file_path: Absolute path to the saved local file.
        file_type: File extension without dot (pdf, csv, xlsx, docx, txt).
        original_filename: Original filename for metadata.
        storage_path: Supabase Storage path if already uploaded (may be None).
        user_id: Owner's UUID — included in chunk metadata for user-scoped retrieval.
    """
    settings = get_settings()
    service = _get_service()

    logger.info(
        "Background pipeline started for document %s (%s) user=%s",
        doc_id, original_filename, user_id or "anon",
    )

    try:
        # ── Step 0: Upload to Supabase Storage (if not done yet) ──────
        if not storage_path and settings.supabase_configured:
            logger.info("[%s] Step 0 — Uploading to Supabase Storage...", doc_id)
            from app.services.supabase_client import upload_file_to_storage
            storage_path = upload_file_to_storage(
                file_path=file_path,
                document_id=doc_id,
                original_filename=original_filename,
            )
            if storage_path:
                # Persist storage_path in the DB
                await service.update_storage_path(doc_id, storage_path)
                logger.info("[%s] Uploaded to Supabase Storage: %s", doc_id, storage_path)
            else:
                logger.warning("[%s] Supabase Storage upload failed — continuing without cloud storage.", doc_id)

        # ── Step 1: Parse ──────────────────────────────────────────────
        logger.info("[%s] Step 1/3 — Parsing...", doc_id)
        text = DocumentParser.parse(file_path, file_type)

        if not text or not text.strip():
            raise ValueError("Parser returned empty text — document may be blank or image-only.")

        # Count pages for PDFs
        page_count: Optional[int] = None
        if file_type == "pdf":
            try:
                from pypdf import PdfReader
                with open(file_path, "rb") as f:
                    page_count = len(PdfReader(f).pages)
            except Exception:
                page_count = None

        # ── Step 2: Chunk ──────────────────────────────────────────────
        logger.info("[%s] Step 2/3 — Chunking...", doc_id)
        chunker = DocumentChunker(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
        chunks = chunker.chunk_text(text)

        if not chunks:
            raise ValueError("Chunker produced zero chunks — document text may be too short.")

        # ── Step 2.5: Cap chunk count ────────────────────────────────────
        # Guard against very large documents exhausting the Gemini free-tier
        # daily request quota (1,000 RPD). Each batch of 100 chunks = 1 request,
        # so 200 chunks max = at most 2 API calls per document.
        max_chunks = settings.max_chunks_per_doc
        if len(chunks) > max_chunks:
            logger.warning(
                "[%s] Document produced %d chunks — capping to %d to stay within "
                "Gemini free-tier RPD quota (chunk_size=%d).",
                doc_id, len(chunks), max_chunks, settings.chunk_size,
            )
            chunks = chunks[:max_chunks]


        # ── Step 3: Embed + Store in ChromaDB ─────────────────────────
        # _embed_semaphore ensures only ONE document is embedding at a time
        # across all concurrent background tasks.  If another upload is already
        # embedding, this task waits here until that one finishes.
        logger.info("[%s] Step 3/3 — Waiting for embedding slot (%d chunks)...", doc_id, len(chunks))
        async with _embed_semaphore:
            logger.info("[%s] Step 3/3 — Embedding %d chunks...", doc_id, len(chunks))
            vector_store = _get_vector_store()
            chunk_metadata = {
                "original_filename": original_filename,
                "file_type": file_type,
            }
            # user_id is passed so chunks are tagged with the owner's ID in ChromaDB.
            # run_in_executor: add_chunks is synchronous and may time.sleep() during
            # 429 retries — running it in a thread pool prevents blocking the event loop.
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                lambda: vector_store.add_chunks(
                    document_id=doc_id,
                    chunks=chunks,
                    metadata=chunk_metadata,
                    user_id=user_id,
                ),
            )

        # ── Step 3.5: Persist chunks to Supabase for restart recovery ──
        logger.info("[%s] Step 3.5 — Persisting chunks to database...", doc_id)
        try:
            db = get_database()
            from app.services.chunk_store import persist_chunks
            await persist_chunks(
                db=db,
                document_id=doc_id,
                chunks=chunks,
                base_metadata=chunk_metadata,
            )
        except Exception as chunk_err:
            # Non-fatal: ChromaDB already has the data, this is just for restart recovery
            logger.warning("[%s] Chunk persistence failed (non-fatal): %s", doc_id, chunk_err)

        # ── Step 3.6: Extract vehicle metadata ────────────────────────
        logger.info("[%s] Step 3.6 — Extracting vehicle metadata...", doc_id)
        metadata = MetadataExtractor.extract(text)

        # ── Step 4: Mark as ready ─────────────────────────────────────
        await service.update_document_status(
            document_id=doc_id,
            status="ready",
            chunk_count=len(chunks),
            page_count=page_count,
            vehicle_name=metadata.get("vehicle_name"),
            manufacturer=metadata.get("manufacturer"),
        )
        logger.info(
            "Pipeline complete for %s: %d chunks, %s pages",
            doc_id,
            len(chunks),
            page_count or "N/A",
        )

    except Exception as e:
        raw_err = str(e)
        logger.error("Pipeline failed for document %s: %s", doc_id, raw_err)
        await service.update_document_status(
            document_id=doc_id,
            status="error",
            error_message=_friendly_error(raw_err),
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document",
    description=(
        "Upload a vehicle manual or log file. "
        "Returns immediately with status='processing'. "
        "Background pipeline (upload to Supabase → parse → chunk → embed) runs asynchronously."
    ),
)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
) -> DocumentResponse:
    """Handle document upload, save file, create DB record, and trigger processing."""
    settings = get_settings()
    service = _get_service()

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    # Validate file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {settings.allowed_file_types}",
        )
    file_type = ext.lstrip(".")

    # Pre-generate ID and path
    doc_id = str(uuid.uuid4())
    filename = f"{doc_id}{ext}"
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / filename

    # Save file in streaming chunks (handles large files without loading into RAM)
    size = 0
    try:
        async with aiofiles.open(file_path, "wb") as out_file:
            while chunk := await file.read(1024 * 1024):  # 1 MB at a time
                size += len(chunk)
                if size > settings.max_file_size_bytes:
                    file_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum size is {settings.max_file_size_mb} MB.",
                    )
                await out_file.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error saving uploaded file: %s", e)
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Failed to save the uploaded file.")

    # Create the database record (status='processing'), tagged with user_id
    try:
        doc = await service.create_document_record(
            original_filename=file.filename,
            file_type=file_type,
            file_size=size,
            file_path=str(file_path),
            doc_id=doc_id,
            user_id=current_user.user_id,
        )
    except Exception as e:
        logger.error("Error creating document record: %s", e)
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Failed to create document record.")

    # Trigger the processing pipeline as a background task.
    # This returns 201 to the client immediately; processing happens asynchronously.
    background_tasks.add_task(
        _process_document,
        doc_id=doc_id,
        file_path=str(file_path),
        file_type=file_type,
        original_filename=file.filename,
        storage_path=None,
        user_id=current_user.user_id,
    )

    logger.info("Upload accepted for %s (%s). Background processing queued.", doc_id, file.filename)
    return doc


@router.get(
    "/stats",
    response_model=DocumentStats,
    summary="Get document statistics",
    description="Returns aggregate statistics: total, ready, processing, and error counts, plus total chunks and storage used.",
)
async def get_document_stats(
    current_user: CurrentUser = Depends(get_current_user),
) -> DocumentStats:
    """Get aggregate document statistics for the current user."""
    service = _get_service()
    return await service.get_document_stats(user_id=current_user.user_id)


@router.get(
    "",
    response_model=DocumentListResponse,
    summary="List all documents",
    description="Returns all uploaded documents for the current user, optionally filtered by status or file type.",
)
async def list_documents(
    status: Optional[str] = Query(
        default=None,
        description="Filter by status: processing, ready, or error",
        pattern="^(processing|ready|error)$",
    ),
    file_type: Optional[str] = Query(
        default=None,
        description="Filter by file type: pdf, csv, xlsx, docx, or txt",
        pattern="^(pdf|csv|xlsx|docx|txt)$",
    ),
    current_user: CurrentUser = Depends(get_current_user),
) -> DocumentListResponse:
    """List documents for the current user with optional filters."""
    service = _get_service()
    return await service.list_documents(status=status, file_type=file_type, user_id=current_user.user_id)


@router.get(
    "/{document_id}/status",
    response_model=DocumentStatusResponse,
    summary="Get document processing status",
    description="Lightweight endpoint for polling a document's processing status.",
    responses={404: {"model": ErrorResponse}},
)
async def get_document_status(
    document_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> DocumentStatusResponse:
    """Get just the status fields for a document (efficient for UI polling).

    Scoped to the authenticated user — returns 404 for documents that
    belong to a different user, preventing cross-user status polling.
    """
    service = _get_service()
    result = await service.get_document_status(document_id, user_id=current_user.user_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Document not found: {document_id}",
        )
    return result


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
    summary="Get a document",
    description="Returns details for a single document by its ID.",
    responses={404: {"model": ErrorResponse}},
)
async def get_document(
    document_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> DocumentResponse:
    """Get a single document by ID (user-scoped)."""
    service = _get_service()
    doc = await service.get_document(document_id, user_id=current_user.user_id)

    if doc is None:
        raise HTTPException(
            status_code=404,
            detail=f"Document not found: {document_id}",
        )

    return doc


@router.delete(
    "/{document_id}",
    response_model=DocumentDeleteResponse,
    summary="Delete a document",
    description="Deletes a document, its stored file, Supabase Storage file, and all associated vector embeddings.",
    responses={404: {"model": ErrorResponse}},
)
async def delete_document(
    document_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> DocumentDeleteResponse:
    """Delete a document, its file on disk, Supabase Storage file, and its vectors in ChromaDB."""
    service = _get_service()

    # Confirm the document exists (and belongs to this user)
    doc = await service.get_document(document_id, user_id=current_user.user_id)
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail=f"Document not found: {document_id}",
        )

    # 1. Delete vectors from ChromaDB first
    try:
        vector_store = _get_vector_store()
        deleted_chunks = vector_store.delete_chunks(document_id)
        logger.info("Deleted %d vector chunks for document %s.", deleted_chunks, document_id)
    except Exception as e:
        logger.error("Error deleting vectors for document %s: %s", document_id, e)

    # 2. Delete file from Supabase Storage if it was uploaded there
    try:
        db = get_database()
        raw = await db.fetch_one(
            "SELECT storage_path FROM documents WHERE id = ?",
            (document_id,),
        )
        if raw and raw.get("storage_path"):
            from app.services.supabase_client import delete_file_from_storage
            deleted_storage = delete_file_from_storage(raw["storage_path"])
            if deleted_storage:
                logger.info("Deleted Supabase Storage file for document %s.", document_id)
    except Exception as e:
        logger.warning("Could not delete Supabase Storage file for %s: %s", document_id, e)

    # 3. Delete file from disk + record from database
    result = await service.delete_document(document_id, user_id=current_user.user_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Document not found: {document_id}",
        )

    return result


# ── Document Preview ──────────────────────────────────────────────────────────

@router.get(
    "/{document_id}/preview",
    response_model=DocumentPreviewResponse,
    summary="Preview document content",
    description=(
        "Returns the first 800 characters of a document's parsed text content. "
        "Useful for verifying what was extracted from a file before querying."
    ),
    responses={404: {"model": ErrorResponse}},
)
async def preview_document(
    document_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> DocumentPreviewResponse:
    """
    Parse the stored file and return a content preview.
    Re-uses DocumentParser so the result matches what's in the vector store.
    """
    PREVIEW_CHARS = 800

    service = _get_service()
    doc = await service.get_document(document_id, user_id=current_user.user_id)
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail=f"Document not found: {document_id}",
        )

    if doc.status != "ready":
        # Return metadata without parsing — file may not be usable yet
        return DocumentPreviewResponse(
            document_id=document_id,
            filename=doc.filename,
            original_filename=doc.original_filename,
            status=doc.status,
            vehicle_name=doc.vehicle_name,
            manufacturer=doc.manufacturer,
            preview=f"Document is not ready (status: {doc.status}). No preview available.",
            preview_truncated=False,
        )

    # file_path is intentionally excluded from DocumentResponse (security).
    # Fetch it directly from the raw database row.
    db = get_database()
    raw = await db.fetch_one("SELECT file_path, file_type FROM documents WHERE id = ?", (document_id,))
    if raw is None:
        raise HTTPException(status_code=404, detail=f"Document not found: {document_id}")

    try:
        text = DocumentParser.parse(raw["file_path"], raw["file_type"])
        total_chars = len(text)
        truncated   = total_chars > PREVIEW_CHARS
        preview     = text[:PREVIEW_CHARS].strip()

        return DocumentPreviewResponse(
            document_id=document_id,
            filename=doc.filename,
            original_filename=doc.original_filename,
            status=doc.status,
            vehicle_name=doc.vehicle_name,
            manufacturer=doc.manufacturer,
            preview=preview,
            preview_truncated=truncated,
            total_chars=total_chars,
        )
    except Exception as e:
        logger.error("Preview failed for document %s: %s", document_id, e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate preview: {e}",
        )
