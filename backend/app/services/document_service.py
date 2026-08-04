"""
Vehicle Intelligence Assistant — Document Service

Business logic for document CRUD operations.
This service talks to the SQLite database and manages document records.
File processing (parse/chunk/embed) will be added in later milestones.
"""

import json
import logging
import uuid
from pathlib import Path
from typing import Optional

from app.models.database import Database
from app.models.schemas import (
    DocumentResponse,
    DocumentListResponse,
    DocumentDeleteResponse,
)

logger = logging.getLogger(__name__)


class DocumentService:
    """Manages document metadata in the database."""

    def __init__(self, db: Database) -> None:
        self.db = db

    async def list_documents(
        self,
        status: Optional[str] = None,
        file_type: Optional[str] = None,
    ) -> DocumentListResponse:
        """
        List all documents, optionally filtered by status or file type.

        Args:
            status: Filter by document status (processing/ready/error).
            file_type: Filter by file type (pdf/csv/xlsx/docx/txt).

        Returns:
            DocumentListResponse with the matching documents.
        """
        query = "SELECT * FROM documents"
        params: list = []
        conditions: list[str] = []

        if status:
            conditions.append("status = ?")
            params.append(status)
        if file_type:
            conditions.append("file_type = ?")
            params.append(file_type)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY created_at DESC"

        rows = await self.db.fetch_all(query, tuple(params))
        documents = [DocumentResponse(**row) for row in rows]

        logger.debug("Listed %d documents", len(documents))

        return DocumentListResponse(
            documents=documents,
            total=len(documents),
        )

    async def get_document(self, document_id: str) -> Optional[DocumentResponse]:
        """
        Get a single document by ID.

        Args:
            document_id: The document UUID.

        Returns:
            DocumentResponse if found, None otherwise.
        """
        row = await self.db.fetch_one(
            "SELECT * FROM documents WHERE id = ?",
            (document_id,),
        )
        if row is None:
            return None
        return DocumentResponse(**row)

    async def create_document_record(
        self,
        original_filename: str,
        file_type: str,
        file_size: int,
        file_path: str,
        doc_id: Optional[str] = None,
    ) -> DocumentResponse:
        """
        Create a new document record in the database.

        The document starts with status='processing'.
        The actual file processing happens asynchronously in later milestones.

        Args:
            original_filename: Original name of the uploaded file.
            file_type: File extension (pdf, csv, xlsx, docx, txt).
            file_size: File size in bytes.
            file_path: Path where the file is stored.
            doc_id: Optional UUID. If not provided, one is generated.

        Returns:
            The created DocumentResponse.
        """
        doc_id = doc_id or str(uuid.uuid4())
        filename = f"{doc_id}.{file_type}"

        await self.db.execute(
            """
            INSERT INTO documents (id, filename, original_filename, file_type, file_size, file_path, status)
            VALUES (?, ?, ?, ?, ?, ?, 'processing')
            """,
            (doc_id, filename, original_filename, file_type, file_size, file_path),
        )

        logger.info(
            "Created document record: id=%s, name=%s, type=%s, size=%d",
            doc_id, original_filename, file_type, file_size,
        )

        # Fetch and return the created record
        doc = await self.get_document(doc_id)
        assert doc is not None, f"Document {doc_id} should exist after insert"
        return doc

    async def update_document_status(
        self,
        document_id: str,
        status: str,
        chunk_count: int = 0,
        page_count: Optional[int] = None,
        vehicle_name: Optional[str] = None,
        manufacturer: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> Optional[DocumentResponse]:
        """
        Update document processing status and metadata.

        Called by the document pipeline after processing completes.

        Args:
            document_id: The document UUID.
            status: New status (processing/ready/error).
            chunk_count: Number of chunks created.
            page_count: Number of pages (for PDFs).
            vehicle_name: Auto-detected vehicle name.
            manufacturer: Auto-detected manufacturer.
            error_message: Error details if status is 'error'.

        Returns:
            Updated DocumentResponse, or None if not found.
        """
        await self.db.execute(
            """
            UPDATE documents
            SET status = ?, chunk_count = ?, page_count = ?,
                vehicle_name = ?, manufacturer = ?, error_message = ?,
                updated_at = datetime('now')
            WHERE id = ?
            """,
            (status, chunk_count, page_count, vehicle_name,
             manufacturer, error_message, document_id),
        )

        logger.info("Updated document %s: status=%s, chunks=%d", document_id, status, chunk_count)

        return await self.get_document(document_id)

    async def delete_document(self, document_id: str) -> Optional[DocumentDeleteResponse]:
        """
        Delete a document record and its stored file.

        Note: Vector store cleanup will be added in Milestone 8.

        Args:
            document_id: The document UUID.

        Returns:
            DocumentDeleteResponse if found and deleted, None if not found.
        """
        doc = await self.get_document(document_id)
        if doc is None:
            return None

        # Delete the stored file
        file_path = Path(doc.file_path) if hasattr(doc, 'file_path') else None
        row = await self.db.fetch_one(
            "SELECT file_path FROM documents WHERE id = ?",
            (document_id,),
        )
        if row and row.get("file_path"):
            stored_file = Path(row["file_path"])
            if stored_file.exists():
                stored_file.unlink()
                logger.info("Deleted file: %s", stored_file)

        # Delete from database (messages cascade automatically via FK)
        await self.db.execute(
            "DELETE FROM documents WHERE id = ?",
            (document_id,),
        )

        logger.info("Deleted document: %s (%s)", document_id, doc.original_filename)

        return DocumentDeleteResponse(id=document_id)

    async def get_document_count(self) -> int:
        """Get the total number of documents."""
        row = await self.db.fetch_one("SELECT COUNT(*) as count FROM documents")
        return row["count"] if row else 0
