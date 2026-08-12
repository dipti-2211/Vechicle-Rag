"""
Vehicle Intelligence Assistant — Chunk Store

Persists document text chunks to the database (document_chunks table) and
provides the rebuild logic to recreate the ChromaDB vector index from
persistent storage on backend startup.

This decouples persistent chunk storage from the ephemeral ChromaDB index.
ChromaDB is rebuilt from persistent chunks if it is empty on startup.
"""

import json
import logging
import uuid
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


async def persist_chunks(
    db,
    document_id: str,
    chunks: List[str],
    base_metadata: Dict[str, Any] = None,
) -> None:
    """
    Save document text chunks to the database (document_chunks table).

    Called after the embedding pipeline completes so chunks survive restarts.
    Uses a simple INSERT — duplicate chunks for the same document are prevented
    by deleting existing chunks first (safe because ChromaDB is already updated).

    Args:
        db: The active database instance (SupabaseDatabase or SQLite Database).
        document_id: UUID of the parent document.
        chunks: List of text chunk strings.
        base_metadata: Optional metadata dict (e.g. filename, file_type).
    """
    if not chunks:
        return

    meta = base_metadata or {}

    try:
        # Delete any existing chunks for this document first (idempotent)
        await db.execute(
            "DELETE FROM document_chunks WHERE document_id = ?",
            (document_id,),
        )

        # Insert all chunks
        for i, chunk_text in enumerate(chunks):
            chunk_id = str(uuid.uuid4())
            metadata_json = json.dumps({**meta, "chunk_index": i})
            await db.execute(
                """
                INSERT INTO document_chunks (id, document_id, chunk_index, chunk_text, metadata)
                VALUES (?, ?, ?, ?, ?)
                """,
                (chunk_id, document_id, i, chunk_text, metadata_json),
            )
        logger.info(
            "Persisted %d chunks for document %s.", len(chunks), document_id
        )
    except Exception as e:
        # Non-fatal: ChromaDB already has the data. Log and continue.
        logger.warning(
            "Could not persist chunks for document %s: %s",
            document_id, e,
        )


async def load_ready_chunks(db) -> List[Dict[str, Any]]:
    """
    Load all chunks from READY documents.

    Returns:
        List of dicts with keys: document_id, chunk_index, chunk_text, metadata
    """
    try:
        rows = await db.fetch_all(
            """
            SELECT dc.document_id, dc.chunk_index, dc.chunk_text, dc.metadata
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE d.status = 'ready'
            ORDER BY dc.document_id, dc.chunk_index
            """
        )
        logger.info(
            "Loaded %d chunks from persistent storage for ChromaDB rebuild.", len(rows)
        )
        return rows
    except Exception as e:
        logger.error("Failed to load chunks from database: %s", e)
        return []


async def rebuild_chromadb_from_supabase(db, vector_store) -> int:
    """
    Rebuild the ChromaDB collection from persistent chunks if collection is empty.

    This is called ONCE at startup — NOT on every request.

    Args:
        db: Active database instance.
        vector_store: The VectorStore singleton.

    Returns:
        Number of documents reloaded (0 if rebuild not needed or failed).
    """
    try:
        current_count = vector_store.get_collection_count()
        if current_count > 0:
            logger.info(
                "ChromaDB already has %d vectors — skipping rebuild.", current_count
            )
            return 0
    except Exception as e:
        logger.warning("Could not check ChromaDB count: %s", e)
        return 0

    logger.info("ChromaDB is empty — attempting rebuild from persistent storage...")
    rows = await load_ready_chunks(db)

    if not rows:
        logger.info("No READY chunks found in persistent storage — nothing to rebuild.")
        return 0

    # Group chunks by document_id, preserving order
    docs: Dict[str, Dict] = {}
    for row in rows:
        doc_id = row["document_id"]
        if doc_id not in docs:
            # Parse metadata from whichever format it comes in (string or dict)
            meta_raw = row.get("metadata", "{}")
            if isinstance(meta_raw, str):
                try:
                    meta = json.loads(meta_raw)
                except Exception:
                    meta = {}
            elif isinstance(meta_raw, dict):
                meta = meta_raw
            else:
                meta = {}
            docs[doc_id] = {"chunks": [], "metadata": meta}
        docs[doc_id]["chunks"].append(row["chunk_text"])

    rebuilt = 0
    for doc_id, doc_data in docs.items():
        try:
            chunks = doc_data["chunks"]
            meta = doc_data["metadata"]
            logger.info(
                "Re-embedding %d chunks for document %s...", len(chunks), doc_id
            )
            vector_store.add_chunks(
                document_id=doc_id,
                chunks=chunks,
                metadata=meta,
            )
            rebuilt += 1
        except Exception as e:
            logger.error(
                "Failed to rebuild chunks for document %s: %s", doc_id, e
            )

    logger.info(
        "ChromaDB rebuild complete: %d documents re-indexed (%d total chunks).",
        rebuilt, len(rows),
    )
    return rebuilt
