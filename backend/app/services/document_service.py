"""
Vehicle Intelligence Assistant — Document Service

Business logic for document CRUD operations:
- CRUD for document metadata in SQLite / Supabase PostgREST
- File deletion from the upload directory
- Delegates vector cleanup to VectorStore (called by the route layer)
- All operations are scoped to user_id when provided
"""

import json
import logging
import uuid
from datetime import datetime, timezone
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
        user_id: Optional[str] = None,
    ) -> DocumentListResponse:
        """
        List documents, optionally filtered by status, file type, or user.

        Args:
            status: Filter by document status (processing/ready/error).
            file_type: Filter by file type (pdf/csv/xlsx/docx/txt).
            user_id: Filter to only this user's documents. If None, returns all.

        Returns:
            DocumentListResponse with the matching documents.
        """
        query = "SELECT * FROM documents"
        params: list = []
        conditions: list[str] = []

        if user_id:
            conditions.append("user_id = ?")
            params.append(user_id)
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

    async def get_document(
        self,
        document_id: str,
        user_id: Optional[str] = None,
    ) -> Optional[DocumentResponse]:
        """
        Get a single document by ID.

        Args:
            document_id: The document UUID.
            user_id: If provided, verifies that the document belongs to this user.

        Returns:
            DocumentResponse if found (and owned by user_id if given), None otherwise.
        """
        if user_id:
            row = await self.db.fetch_one(
                "SELECT * FROM documents WHERE id = ? AND user_id = ?",
                (document_id, user_id),
            )
        else:
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
        user_id: Optional[str] = None,
    ) -> DocumentResponse:
        """
        Create a new document record in the database.

        The document starts with status='processing'.

        Args:
            original_filename: Original name of the uploaded file.
            file_type: File extension (pdf, csv, xlsx, docx, txt).
            file_size: File size in bytes.
            file_path: Path where the file is stored.
            doc_id: Optional UUID. If not provided, one is generated.
            user_id: The authenticated user's UUID (owner of the document).

        Returns:
            The created DocumentResponse.
        """
        doc_id = doc_id or str(uuid.uuid4())
        filename = f"{doc_id}.{file_type}"

        if user_id:
            await self.db.execute(
                """
                INSERT INTO documents (id, filename, original_filename, file_type, file_size, file_path, status, user_id)
                VALUES (?, ?, ?, ?, ?, ?, 'processing', ?)
                """,
                (doc_id, filename, original_filename, file_type, file_size, file_path, user_id),
            )
        else:
            await self.db.execute(
                """
                INSERT INTO documents (id, filename, original_filename, file_type, file_size, file_path, status)
                VALUES (?, ?, ?, ?, ?, ?, 'processing')
                """,
                (doc_id, filename, original_filename, file_type, file_size, file_path),
            )

        logger.info(
            "Created document record: id=%s, name=%s, type=%s, size=%d, user=%s",
            doc_id, original_filename, file_type, file_size, user_id or "anon",
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
        now = datetime.now(timezone.utc).isoformat()
        await self.db.execute(
            """
            UPDATE documents
            SET status = ?, chunk_count = ?, page_count = ?,
                vehicle_name = ?, manufacturer = ?, error_message = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (status, chunk_count, page_count, vehicle_name,
             manufacturer, error_message, now, document_id),
        )

        logger.info("Updated document %s: status=%s, chunks=%d", document_id, status, chunk_count)

        return await self.get_document(document_id)

    async def delete_document(
        self,
        document_id: str,
        user_id: Optional[str] = None,
    ) -> Optional[DocumentDeleteResponse]:
        """
        Delete a document record and its stored file from disk.

        Note: The route layer is responsible for calling VectorStore.delete_chunks()
        before calling this method to ensure vector cleanup happens first.

        Args:
            document_id: The document UUID.
            user_id: If provided, verifies that the document belongs to this user.

        Returns:
            DocumentDeleteResponse if found and deleted, None if not found.
        """
        doc = await self.get_document(document_id, user_id=user_id)
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

        # Delete from database (cascade removes associated chunks)
        await self.db.execute(
            "DELETE FROM documents WHERE id = ?",
            (document_id,),
        )

        logger.info("Deleted document: %s (%s)", document_id, doc.original_filename)

        return DocumentDeleteResponse(id=document_id)

    async def get_document_count(self, user_id: Optional[str] = None) -> int:
        """Get the total number of documents (optionally for a specific user)."""
        try:
            if user_id:
                row = await self.db.fetch_one(
                    "SELECT COUNT(*) as count FROM documents WHERE user_id = ?",
                    (user_id,),
                )
            else:
                row = await self.db.fetch_one("SELECT COUNT(*) as count FROM documents")
            if row:
                return row.get("count", 0) or 0
        except Exception:
            pass
        # Fallback: fetch all and count (works on Supabase PostgREST)
        if user_id:
            rows = await self.db.fetch_all(
                "SELECT * FROM documents WHERE user_id = ?", (user_id,)
            )
        else:
            rows = await self.db.fetch_all("SELECT * FROM documents")
        return len(rows)

    async def get_document_stats(self, user_id: Optional[str] = None):
        """
        Get aggregate document statistics.

        Works with both SQLite (native aggregate query) and Supabase PostgREST
        (client-side aggregation from full document list).

        Args:
            user_id: If provided, only counts documents belonging to this user.

        Returns a DocumentStats with total, ready, processing, error counts,
        total_chunks, and total_size_bytes.
        """
        from app.models.schemas import DocumentStats

        db_class = type(self.db).__name__

        if "Supabase" in db_class:
            # PostgREST: fetch documents and aggregate client-side
            if user_id:
                rows = await self.db.fetch_all(
                    "SELECT * FROM documents WHERE user_id = ?", (user_id,)
                )
            else:
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
        if user_id:
            row = await self.db.fetch_one(
                """
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN status = 'ready'      THEN 1 ELSE 0 END) AS ready,
                    SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
                    SUM(CASE WHEN status = 'error'      THEN 1 ELSE 0 END) AS error,
                    COALESCE(SUM(chunk_count), 0) AS total_chunks,
                    COALESCE(SUM(file_size),  0) AS total_size_bytes
                FROM documents WHERE user_id = ?
                """,
                (user_id,),
            )
        else:
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

    async def get_document_status(self, document_id: str, user_id: Optional[str] = None):
        """
        Return lightweight status info for a single document (for polling).

        Args:
            document_id: The document UUID.
            user_id: If provided, verifies that the document belongs to this user.
                     Returns None (→ 404) if the document exists but belongs to
                     a different user, preventing status-polling of other users' docs.

        Returns:
            DocumentStatusResponse if found (and owned), None otherwise.
        """
        from app.models.schemas import DocumentStatusResponse

        if user_id:
            row = await self.db.fetch_one(
                "SELECT id, status, chunk_count, error_message FROM documents WHERE id = ? AND user_id = ?",
                (document_id, user_id),
            )
        else:
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
        now = datetime.now(timezone.utc).isoformat()
        await self.db.execute(
            """
            UPDATE documents
            SET storage_path = ?, updated_at = ?
            WHERE id = ?
            """,
            (storage_path, now, document_id),
        )
        logger.debug("Updated storage_path for document %s: %s", document_id, storage_path)
