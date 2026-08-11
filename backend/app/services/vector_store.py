"""
Vehicle Intelligence Assistant — Vector Store Service

Manages ChromaDB for vector storage and semantic retrieval.
Uses sentence-transformers (all-MiniLM-L6-v2) locally for embeddings —
no external API needed for indexing, keeping costs zero.

Responsibilities:
- Generate embeddings for document chunks
- Store chunks in ChromaDB with metadata
- Semantic search over stored chunks
- Delete all chunks for a given document
"""

import logging
from typing import Any, Dict, List, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer

from app.config import get_settings

logger = logging.getLogger(__name__)


class VectorStore:
    """Service to handle embedding generation and vector storage in ChromaDB."""

    def __init__(self) -> None:
        self.settings = get_settings()

        # 1. Load the local embedding model (downloaded once, cached after that).
        #    all-MiniLM-L6-v2 produces 384-dim vectors, excellent for semantic search.
        logger.info("Loading embedding model all-MiniLM-L6-v2...")
        self.embedding_model = SentenceTransformer(
            "all-MiniLM-L6-v2",
            # Allow download if not cached — falls back to network on first run
        )

        # 2. Initialize a persistent ChromaDB client (data survives restarts).
        logger.info("Initializing ChromaDB at %s", self.settings.chroma_persist_dir)
        self.chroma_client = chromadb.PersistentClient(
            path=self.settings.chroma_persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )

        # 3. Get or create the collection with cosine similarity (best for MiniLM).
        self.collection = self.chroma_client.get_or_create_collection(
            name=self.settings.chroma_collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(
            "ChromaDB collection '%s' ready (%d items)",
            self.settings.chroma_collection_name,
            self.collection.count(),
        )

    # ── Private helpers ───────────────────────────────────────────────

    def _get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate vector embeddings for a list of texts."""
        if not texts:
            return []
        # SentenceTransformer returns a numpy array → convert to plain Python list
        embeddings = self.embedding_model.encode(texts, show_progress_bar=False)
        return embeddings.tolist()

    # ── Public API ───────────────────────────────────────────────────

    def add_chunks(
        self,
        document_id: str,
        chunks: List[str],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Embed and insert document chunks into ChromaDB.

        Args:
            document_id: UUID of the parent document.
            chunks: List of text chunks to embed and store.
            metadata: Optional base metadata attached to every chunk
                      (e.g. filename, file_type).
        """
        if not chunks:
            logger.warning("add_chunks called with empty chunk list for doc %s", document_id)
            return

        logger.info(
            "Generating embeddings for %d chunks of document %s...",
            len(chunks),
            document_id,
        )
        embeddings = self._get_embeddings(chunks)

        # Build per-chunk IDs and metadata
        ids = [f"{document_id}_{i}" for i in range(len(chunks))]
        base_meta = metadata or {}
        metadatas = [
            {**base_meta, "document_id": document_id, "chunk_index": i}
            for i in range(len(chunks))
        ]

        logger.info(
            "Inserting %d chunks into ChromaDB collection '%s'...",
            len(chunks),
            self.settings.chroma_collection_name,
        )
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=chunks,
        )
        logger.info("Insertion complete for document %s.", document_id)

    def delete_chunks(self, document_id: str) -> int:
        """
        Remove all vector chunks belonging to a document from ChromaDB.

        Args:
            document_id: UUID of the document whose chunks should be deleted.

        Returns:
            Number of chunks deleted.
        """
        try:
            # Query how many chunks exist for this document
            existing = self.collection.get(
                where={"document_id": document_id},
                include=[],  # Only return IDs
            )
            ids_to_delete = existing.get("ids", [])

            if not ids_to_delete:
                logger.info("No vector chunks found for document %s — nothing to delete.", document_id)
                return 0

            self.collection.delete(ids=ids_to_delete)
            logger.info(
                "Deleted %d vector chunks for document %s.",
                len(ids_to_delete),
                document_id,
            )
            return len(ids_to_delete)
        except Exception as e:
            logger.error("Failed to delete chunks for document %s: %s", document_id, e)
            return 0

    def search(
        self,
        query: str,
        top_k: int = 5,
        document_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Semantic search over stored chunks.

        Args:
            query: The natural language query.
            top_k: Maximum number of results to return.
            document_ids: Optional list of document IDs to scope the search.

        Returns:
            List of dicts: [{text, metadata, distance}, ...]
            Lower distance = more similar (cosine distance).
        """
        if not query.strip():
            return []

        # Guard: if collection is empty, return early to avoid ChromaDB error
        if self.collection.count() == 0:
            logger.info("Vector store is empty — no results for query.")
            return []

        logger.info("Searching vector store for: '%s'", query)
        query_embedding = self._get_embeddings([query])[0]

        # Build optional where-filter for document scoping
        where_filter: Optional[Dict[str, Any]] = None
        if document_ids:
            if len(document_ids) == 1:
                where_filter = {"document_id": document_ids[0]}
            else:
                where_filter = {"document_id": {"$in": document_ids}}

        # Clamp top_k to available count to avoid ChromaDB errors
        available = self.collection.count()
        n_results = min(top_k, available)
        if n_results == 0:
            return []

        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where=where_filter,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as query_err:
            # ChromaDB raises when n_results > number of matching documents for a where_filter.
            # Retry with n_results=1 (minimum valid value) to safely recover.
            logger.warning(
                "ChromaDB query failed (n_results=%d, filter=%s): %s. Retrying with n_results=1.",
                n_results, where_filter, query_err,
            )
            try:
                results = self.collection.query(
                    query_embeddings=[query_embedding],
                    n_results=1,
                    where=where_filter,
                    include=["documents", "metadatas", "distances"],
                )
            except Exception as retry_err:
                logger.error("ChromaDB retry also failed: %s", retry_err)
                return []

        formatted: List[Dict[str, Any]] = []
        if results and results["documents"] and results["documents"][0]:
            for i, text in enumerate(results["documents"][0]):
                formatted.append(
                    {
                        "text": text,
                        "metadata": results["metadatas"][0][i],
                        "distance": results["distances"][0][i],
                    }
                )

        logger.info("Search returned %d results.", len(formatted))
        return formatted

    def get_collection_count(self) -> int:
        """Return total number of vectors in the collection."""
        return self.collection.count()
