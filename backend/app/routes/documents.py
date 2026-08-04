"""
Vehicle Intelligence Assistant — Document Routes

REST API endpoints for document management:
- GET    /api/documents          → List all documents
- GET    /api/documents/{id}     → Get a single document
- DELETE /api/documents/{id}     → Delete a document

Upload endpoint will be added in Milestone 4.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

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
