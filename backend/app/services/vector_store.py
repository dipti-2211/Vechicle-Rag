"""
Vehicle Intelligence Assistant — Vector Store Service

Manages ChromaDB for vector storage and semantic retrieval.
Uses Google Gemini API (gemini-embedding-001) for embeddings —
zero local model memory, no sentence-transformers download required.

This replaces the previous sentence-transformers (all-MiniLM-L6-v2) implementation
to fit within Render's 512 MB free-tier memory limit.

Embedding dimensions: 3072 (Gemini gemini-embedding-001 default)
Distance metric: cosine similarity

Public interface is UNCHANGED — all callers (routes, rag_service, chunk_store) work
without modification.
"""

import functools
import logging
import math
import random
import time
from typing import Any, Dict, List, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from google import genai

from app.config import get_settings

logger = logging.getLogger(__name__)

# Gemini embedding dimension for gemini-embedding-001
GEMINI_EMBEDDING_DIM = 3072

# ── Retry / rate-limit constants ──────────────────────────────────────────────
# Gemini free-tier embedding quota (gemini-embedding-001):
#   RPD  = 1,000 requests / day
#   RPM  = 100   requests / minute
#   TPM  = 30,000 tokens  / minute
# The API accepts up to 100 texts per embed_content call.
# We use max-size batches + inter-batch delay + exponential back-off.
EMBED_BATCH_SIZE        = 100    # max texts per Gemini API call (API limit = 100)
EMBED_INTER_BATCH_DELAY = 0.7   # seconds to sleep between batches → ≤85 RPM
MAX_EMBED_RETRIES       = 6     # max attempts per batch on quota errors
EMBED_BASE_DELAY        = 2.0   # initial wait in seconds on first 429
EMBED_MAX_DELAY         = 120.0 # cap backoff at 2 minutes


class VectorStore:
    """Service to handle embedding generation and vector storage in ChromaDB.

    Uses Gemini API for embeddings (no local model loaded — zero extra RAM).
    ChromaDB is used as the vector index (persistent on disk).
    """

    def __init__(self) -> None:
        self.settings = get_settings()

        # ── Gemini client (lightweight — just an HTTP client, no local model) ──
        api_key = self.settings.gemini_api_key
        if not api_key:
            raise ValueError(
                "GEMINI_API_KEY is required for embeddings. "
                "Set it in your .env file or Render environment variables."
            )
        self._gemini_client = genai.Client(api_key=api_key)
        self._embedding_model = self.settings.gemini_embedding_model
        logger.info(
            "VectorStore: using Gemini API for embeddings (model=%s, dim=%d)",
            self._embedding_model,
            GEMINI_EMBEDDING_DIM,
        )

        # ── ChromaDB (persistent, survives restarts via mounted disk) ──────────
        logger.info("Initializing ChromaDB at %s", self.settings.chroma_persist_dir)
        self.chroma_client = chromadb.PersistentClient(
            path=self.settings.chroma_persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )

        # Collection uses cosine distance — compatible with Gemini vectors
        self.collection = self.chroma_client.get_or_create_collection(
            name=self.settings.chroma_collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(
            "ChromaDB collection '%s' ready (%d items)",
            self.settings.chroma_collection_name,
            self.collection.count(),
        )

    # ── Private helpers ───────────────────────────────────────────────────────

    def _get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generate vector embeddings for a list of texts using Gemini API.

        Retries up to MAX_EMBED_RETRIES times with exponential back-off and
        jitter on 429 / RESOURCE_EXHAUSTED errors. Other errors are re-raised
        immediately so the document pipeline can mark the doc as 'error'.

        Args:
            texts: List of text strings to embed.

        Returns:
            List of embedding vectors (each is a list of floats).
        """
        if not texts:
            return []

        attempt = 0
        delay = EMBED_BASE_DELAY

        while True:
            try:
                result = self._gemini_client.models.embed_content(
                    model=self._embedding_model,
                    contents=texts,
                )
                return [list(e.values) for e in result.embeddings]

            except Exception as e:
                err_str = str(e)
                is_quota = (
                    "429" in err_str
                    or "RESOURCE_EXHAUSTED" in err_str
                    or "quota" in err_str.lower()
                    or "rate" in err_str.lower()
                )

                if is_quota and attempt < MAX_EMBED_RETRIES:
                    attempt += 1
                    # Exponential backoff with ±25 % jitter
                    jitter  = delay * 0.25 * (2 * random.random() - 1)
                    wait    = min(delay + jitter, EMBED_MAX_DELAY)
                    logger.warning(
                        "Gemini embedding 429/quota (attempt %d/%d) — "
                        "waiting %.1f s before retry. Error: %s",
                        attempt, MAX_EMBED_RETRIES, wait, err_str[:200],
                    )
                    time.sleep(wait)
                    delay = min(delay * 2, EMBED_MAX_DELAY)
                else:
                    if is_quota:
                        logger.error(
                            "Gemini embedding quota exceeded after %d retries. "
                            "Check your Gemini API plan and billing. Error: %s",
                            attempt, err_str[:400],
                        )
                    else:
                        logger.error("Gemini embedding API call failed: %s", e)
                    raise RuntimeError(f"Embedding generation failed: {e}") from e

    # ── Public API ────────────────────────────────────────────────────────────

    def add_chunks(
        self,
        document_id: str,
        chunks: List[str],
        metadata: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
    ) -> None:
        """
        Embed and insert document chunks into ChromaDB.

        Args:
            document_id: UUID of the parent document.
            chunks: List of text chunks to embed and store.
            metadata: Optional base metadata attached to every chunk.
            user_id: Owner's UUID — stored in metadata for per-user retrieval scoping.
        """
        if not chunks:
            logger.warning("add_chunks called with empty chunk list for doc %s", document_id)
            return

        logger.info(
            "Generating Gemini embeddings for %d chunks of document %s...",
            len(chunks),
            document_id,
        )

        # Embed in batches (max 100 texts per Gemini API call).
        # EMBED_INTER_BATCH_DELAY prevents exceeding 100 RPM.
        # _get_embeddings() has built-in retry/backoff for 429 errors.
        all_embeddings: List[List[float]] = []
        total_batches = math.ceil(len(chunks) / EMBED_BATCH_SIZE)
        for batch_num, i in enumerate(range(0, len(chunks), EMBED_BATCH_SIZE)):
            batch = chunks[i : i + EMBED_BATCH_SIZE]
            logger.info(
                "Embedding batch %d/%d (%d texts) for document %s",
                batch_num + 1, total_batches, len(batch), document_id,
            )
            batch_embeddings = self._get_embeddings(batch)
            all_embeddings.extend(batch_embeddings)
            # Throttle between batches to stay within 100 RPM free-tier limit.
            # Skip sleep after the last batch — no need to wait.
            if batch_num < total_batches - 1:
                time.sleep(EMBED_INTER_BATCH_DELAY)

        # Build per-chunk IDs and metadata
        ids = [f"{document_id}_{i}" for i in range(len(chunks))]
        base_meta = metadata or {}
        # Include user_id in metadata so we can filter by user during retrieval
        user_meta = {"user_id": user_id} if user_id else {}
        metadatas = [
            {**base_meta, **user_meta, "document_id": document_id, "chunk_index": i}
            for i in range(len(chunks))
        ]

        logger.info(
            "Inserting %d chunks into ChromaDB collection '%s'...",
            len(chunks),
            self.settings.chroma_collection_name,
        )
        self.collection.add(
            ids=ids,
            embeddings=all_embeddings,
            metadatas=metadatas,
            documents=chunks,
        )
        logger.info("Insertion complete for document %s (user=%s).", document_id, user_id or "anon")

    def delete_chunks(self, document_id: str) -> int:
        """
        Remove all vector chunks belonging to a document from ChromaDB.

        Returns:
            Number of chunks deleted.
        """
        try:
            existing = self.collection.get(
                where={"document_id": document_id},
                include=[],
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
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Semantic search over stored chunks using Gemini embeddings.

        Args:
            query: The natural language query.
            top_k: Maximum number of results to return.
            document_ids: Optional list of document IDs to scope the search.
            user_id: If provided, restricts retrieval to chunks owned by this user.
                     This is the primary mechanism for per-user RAG isolation.

        Returns:
            List of dicts: [{text, metadata, distance}, ...]
        """
        if not query.strip():
            return []

        if self.collection.count() == 0:
            logger.info("Vector store is empty — no results for query.")
            return []

        logger.info("Searching vector store for: '%s' (user=%s)", query, user_id or "anon")
        query_embedding = self._embed_query(query)

        where_filter: Optional[Dict[str, Any]] = None

        # Build ChromaDB where filter — user_id takes precedence for isolation
        if user_id and document_ids:
            # Scope to user AND specific documents
            if len(document_ids) == 1:
                where_filter = {"$and": [{"user_id": user_id}, {"document_id": document_ids[0]}]}
            else:
                where_filter = {"$and": [{"user_id": user_id}, {"document_id": {"$in": document_ids}}]}
        elif user_id:
            # Scope to user's entire knowledge base
            where_filter = {"user_id": user_id}
        elif document_ids:
            if len(document_ids) == 1:
                where_filter = {"document_id": document_ids[0]}
            else:
                where_filter = {"document_id": {"$in": document_ids}}

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

    @functools.lru_cache(maxsize=128)
    def _embed_query(self, query: str) -> List[float]:
        """
        Embed a single search query with LRU caching.

        Identical queries (common in chat sessions) return the cached vector
        instead of making a new Gemini API call, preserving daily RPD quota.
        Cache holds up to 128 unique query strings per VectorStore instance.
        """
        return self._get_embeddings([query])[0]
