"""
Vehicle Intelligence Assistant — Document Service

Business logic for document CRUD operations:
- CRUD for document metadata in SQLite
- File deletion from the upload directory
- Delegates vector cleanup to VectorStore (called by the route layer)
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
        Delete a document record and its stored file from disk.

        Note: The route layer is responsible for calling VectorStore.delete_chunks()
        before calling this method to ensure vector cleanup happens first.

        Args:
            document_id: The document UUID.

        Returns:
            DocumentDeleteResponse if found and deleted, None if not found.
        """
        doc = await self.get_document(document_id)
        if doc is None:
            return None

        # Retrieve the stored file path from the DB (file_path is not on DocumentResponse)
        row = await self.db.fetch_one(
            "SELECT file_path FROM documents WHERE id = ?",
            (document_id,),
        )
        if row and row.get("file_path"):
            stored_file = Path(row["file_path"])
            if stored_file.exists():
                stored_file.unlink()
                logger.info("Deleted file: %s", stored_file)

        # Delete from database (cascade removes associated messages)
        await self.db.execute(
            "DELETE FROM documents WHERE id = ?",
            (document_id,),
        )

        logger.info("Deleted document: %s (%s)", document_id, doc.original_filename)

        return DocumentDeleteResponse(id=document_id)

    async def get_document_count(self) -> int:
        """Get the total number of documents."""
        try:
            # Try the SQL COUNT query (works on SQLite)
            row = await self.db.fetch_one("SELECT COUNT(*) as count FROM documents")
            if row:
                return row.get("count", 0) or 0
        except Exception:
            pass
        # Fallback: fetch all and count (works on Supabase PostgREST)
        rows = await self.db.fetch_all("SELECT * FROM documents")
        return len(rows)

    async def get_document_stats(self):
        """
        Get aggregate document statistics.

        Works with both SQLite (native aggregate query) and Supabase PostgREST
        (client-side aggregation from full document list).

        Returns a DocumentStats with total, ready, processing, error counts,
        total_chunks, and total_size_bytes.
        """
        from app.models.schemas import DocumentStats

        db_class = type(self.db).__name__

        if "Supabase" in db_class:
            # PostgREST: fetch all documents and aggregate client-side
            rows = await self.db.fetch_all("SELECT * FROM documents")
            total = len(rows)
            ready = sum(1 for r in rows if r.get("status") == "ready")
            processing = sum(1 for r in rows if r.get("status") == "processing")
            error = sum(1 for r in rows if r.get("status") == "error")
            total_chunks = sum(r.get("chunk_count") or 0 for r in rows)
            total_size = sum(r.get("file_size") or 0 for r in rows)
            return DocumentStats(
                total=total,
                ready=ready,
                processing=processing,
                error=error,
                total_chunks=total_chunks,
                total_size_bytes=total_size,
            )

        # SQLite: native aggregate query
        row = await self.db.fetch_one(
            """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'ready'      THEN 1 ELSE 0 END) AS ready,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
                SUM(CASE WHEN status = 'error'      THEN 1 ELSE 0 END) AS error,
                COALESCE(SUM(chunk_count), 0) AS total_chunks,
                COALESCE(SUM(file_size),  0) AS total_size_bytes
            FROM documents
            """
        )
        if row is None:
            return DocumentStats()
        return DocumentStats(
            total=row["total"] or 0,
            ready=row["ready"] or 0,
            processing=row["processing"] or 0,
            error=row["error"] or 0,
            total_chunks=row["total_chunks"] or 0,
            total_size_bytes=row["total_size_bytes"] or 0,
        )

    async def get_document_status(self, document_id: str):
        """
        Return lightweight status info for a single document (for polling).

        Args:
            document_id: The document UUID.

        Returns:
            DocumentStatusResponse if found, None otherwise.
        """
        from app.models.schemas import DocumentStatusResponse

        row = await self.db.fetch_one(
            "SELECT id, status, chunk_count, error_message FROM documents WHERE id = ?",
            (document_id,),
        )
        if row is None:
            return None
        return DocumentStatusResponse(
            id=row["id"],
            status=row["status"],
            chunk_count=row["chunk_count"] or 0,
            error_message=row.get("error_message"),
        )
    async def update_storage_path(
        self,
        document_id: str,
        storage_path: str,
    ) -> None:
        """
        Update the Supabase Storage path for a document after successful upload.

        Args:
            document_id: The document UUID.
            storage_path: The Supabase Storage path (e.g. "<doc_id>/<filename>").
        """
        await self.db.execute(
            """
            UPDATE documents
            SET storage_path = ?, updated_at = datetime('now')
            WHERE id = ?
            """,
            (storage_path, document_id),
        )
        logger.debug("Updated storage_path for document %s: %s", document_id, storage_path)

