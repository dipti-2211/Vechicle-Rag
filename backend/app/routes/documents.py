"""
Vehicle Intelligence Assistant — Document Routes

REST API endpoints for document management:
- POST   /api/documents          → Upload a document (triggers background processing)
- GET    /api/documents          → List all documents
- GET    /api/documents/{id}     → Get a single document
- DELETE /api/documents/{id}     → Delete a document + vectors

Background Pipeline (triggered after upload):
  DocumentParser → DocumentChunker → VectorStore → update status='ready'
"""

import asyncio
import logging
import uuid
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, UploadFile, File, status

from app.config import get_settings
from app.models.database import get_database
from app.models.schemas import (
    DocumentResponse,
    DocumentListResponse,
    DocumentDeleteResponse,
    DocumentStats,
    DocumentStatusResponse,
    ErrorResponse,
)
from app.services.document_service import DocumentService
from app.services.parser import DocumentParser
from app.services.chunker import DocumentChunker
from app.services.vector_store import VectorStore

logger = logging.getLogger(__name__)

router = APIRouter()


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


# ── Background Processing Pipeline ───────────────────────────────────────────

async def _process_document(doc_id: str, file_path: str, file_type: str, original_filename: str) -> None:
    """
    Background task: parse → chunk → embed → update status.

    This runs AFTER the upload endpoint has returned 201 to the client,
    so the user sees an instant response even for large files.

    Args:
        doc_id: Document UUID (already in the database as 'processing').
        file_path: Absolute path to the saved file.
        file_type: File extension without dot (pdf, csv, xlsx, docx, txt).
        original_filename: Original filename for metadata.
    """
    settings = get_settings()
    service = _get_service()

    logger.info("Background pipeline started for document %s (%s)", doc_id, original_filename)

    try:
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

        # ── Step 3: Embed + Store ──────────────────────────────────────
        logger.info("[%s] Step 3/3 — Embedding %d chunks...", doc_id, len(chunks))
        vector_store = _get_vector_store()
        vector_store.add_chunks(
            document_id=doc_id,
            chunks=chunks,
            metadata={
                "original_filename": original_filename,
                "file_type": file_type,
            },
        )

        # ── Step 4: Mark as ready ─────────────────────────────────────
        await service.update_document_status(
            document_id=doc_id,
            status="ready",
            chunk_count=len(chunks),
            page_count=page_count,
        )
        logger.info(
            "Pipeline complete for %s: %d chunks, %s pages",
            doc_id,
            len(chunks),
            page_count or "N/A",
        )

    except Exception as e:
        logger.error("Pipeline failed for document %s: %s", doc_id, e)
        await service.update_document_status(
            document_id=doc_id,
            status="error",
            error_message=str(e),
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
        "Background pipeline (parse → chunk → embed) runs asynchronously."
    ),
)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
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

    # Create the database record (status='processing')
    try:
        doc = await service.create_document_record(
            original_filename=file.filename,
            file_type=file_type,
            file_size=size,
            file_path=str(file_path),
            doc_id=doc_id,
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
    )

    logger.info("Upload accepted for %s (%s). Background processing queued.", doc_id, file.filename)
    return doc


@router.get(
    "/stats",
    response_model=DocumentStats,
    summary="Get document statistics",
    description="Returns aggregate statistics: total, ready, processing, and error counts, plus total chunks and storage used.",
)
async def get_document_stats() -> DocumentStats:
    """Get aggregate document statistics for the Dashboard."""
    service = _get_service()
    return await service.get_document_stats()


@router.get(
    "",
    response_model=DocumentListResponse,
    summary="List all documents",
    description="Returns all uploaded documents, optionally filtered by status or file type.",
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
) -> DocumentListResponse:
    """List all documents with optional filters."""
    service = _get_service()
    return await service.list_documents(status=status, file_type=file_type)


@router.get(
    "/{document_id}/status",
    response_model=DocumentStatusResponse,
    summary="Get document processing status",
    description="Lightweight endpoint for polling a document's processing status. More efficient than fetching the full document.",
    responses={404: {"model": ErrorResponse}},
)
async def get_document_status(document_id: str) -> DocumentStatusResponse:
    """Get just the status fields for a document (efficient for UI polling)."""
    service = _get_service()
    result = await service.get_document_status(document_id)
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
async def get_document(document_id: str) -> DocumentResponse:
    """Get a single document by ID."""
    service = _get_service()
    doc = await service.get_document(document_id)

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
    description="Deletes a document, its stored file, and all associated vector embeddings from ChromaDB.",
    responses={404: {"model": ErrorResponse}},
)
async def delete_document(document_id: str) -> DocumentDeleteResponse:
    """Delete a document, its file on disk, and its vectors in ChromaDB."""
    service = _get_service()

    # Confirm the document exists before any deletion
    doc = await service.get_document(document_id)
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
        # Log but don't fail the request — DB + file cleanup should still proceed
        logger.error("Error deleting vectors for document %s: %s", document_id, e)

    # 2. Delete file from disk + record from SQLite
    result = await service.delete_document(document_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Document not found: {document_id}",
        )

    return result
