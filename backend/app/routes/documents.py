"""
Vehicle Intelligence Assistant — Document Routes

REST API endpoints for document management:
- GET    /api/documents          → List all documents
- GET    /api/documents/{id}     → Get a single document
- DELETE /api/documents/{id}     → Delete a document

Upload endpoint will be added in Milestone 4.
"""

import logging
import uuid
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, status

from app.config import get_settings
from app.models.database import get_database
from app.models.schemas import (
    DocumentResponse,
    DocumentListResponse,
    DocumentDeleteResponse,
    ErrorResponse,
)
from app.services.document_service import DocumentService

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_service() -> DocumentService:
    """Create a DocumentService with the current database."""
    return DocumentService(get_database())


@router.post(
    "",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document",
    description="Upload a new vehicle manual or log file for processing.",
)
async def upload_document(
    file: UploadFile = File(...),
) -> DocumentResponse:
    """Handle document upload and create a database record."""
    settings = get_settings()
    service = _get_service()

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    # Validate file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {settings.allowed_file_types}",
        )
    file_type = ext.lstrip('.')

    # Pre-generate ID and paths
    doc_id = str(uuid.uuid4())
    filename = f"{doc_id}{ext}"
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / filename
    
    # Save file and calculate size
    size = 0
    try:
        async with aiofiles.open(file_path, 'wb') as out_file:
            while content := await file.read(1024 * 1024):  # 1MB chunks
                size += len(content)
                if size > settings.max_file_size_bytes:
                    file_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=413, 
                        detail=f"File too large. Max size is {settings.max_file_size_mb}MB"
                    )
                await out_file.write(content)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error saving file: %s", e)
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail="Error saving file")
        
    # Create the database record
    try:
        doc = await service.create_document_record(
            original_filename=file.filename,
            file_type=file_type,
            file_size=size,
            file_path=str(file_path),
            doc_id=doc_id,
        )
        return doc
    except Exception as e:
        logger.error("Error creating document record: %s", e)
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail="Error creating document record")


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
    description="Deletes a document, its stored file, and associated vector embeddings.",
    responses={404: {"model": ErrorResponse}},
)
async def delete_document(document_id: str) -> DocumentDeleteResponse:
    """Delete a document and all associated data."""
    service = _get_service()
    result = await service.delete_document(document_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Document not found: {document_id}",
        )

    return result
