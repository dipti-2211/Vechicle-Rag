import logging
import uuid
from typing import List, Dict, Any, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer

from app.config import get_settings

logger = logging.getLogger(__name__)


class VectorStore:
    """Service to handle embedding generation and vector storage in ChromaDB."""

    def __init__(self):
        self.settings = get_settings()
        
        # 1. Initialize local embedding model using HuggingFace sentence-transformers.
        # "all-MiniLM-L6-v2" is an excellent lightweight model for semantic search.
        logger.info("Loading embedding model all-MiniLM-L6-v2...")
        self.embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        
        # 2. Initialize ChromaDB Client
        logger.info(f"Initializing ChromaDB at {self.settings.chroma_persist_dir}")
        self.chroma_client = chromadb.PersistentClient(
            path=self.settings.chroma_persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False)
        )
        
        # 3. Get or create collection
        self.collection = self.chroma_client.get_or_create_collection(
            name=self.settings.chroma_collection_name,
            metadata={"hnsw:space": "cosine"} # Cosine similarity works well for MiniLM
        )

    def _get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate vector embeddings for a list of texts."""
        if not texts:
            return []
        
        # sentence-transformers returns a numpy array, we convert to list of floats
        embeddings = self.embedding_model.encode(texts, show_progress_bar=False)
        return embeddings.tolist()

    def add_chunks(self, document_id: str, chunks: List[str], metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        Embed and insert chunks into the vector database.
        
        Args:
            document_id: The ID of the document these chunks belong to.
            chunks: List of text chunks.
            metadata: Optional base metadata to attach to every chunk.
        """
        if not chunks:
            return

        logger.info(f"Generating embeddings for {len(chunks)} chunks of document {document_id}...")
        embeddings = self._get_embeddings(chunks)
        
        # Prepare data for Chroma
        ids = [f"{document_id}_{i}" for i in range(len(chunks))]
        
        base_metadata = metadata or {}
        metadatas = []
        for i in range(len(chunks)):
            meta = base_metadata.copy()
            meta["document_id"] = document_id
            meta["chunk_index"] = i
            metadatas.append(meta)
            
        logger.info(f"Inserting {len(chunks)} chunks into ChromaDB collection '{self.settings.chroma_collection_name}'...")
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=chunks
        )
        logger.info("Insertion complete.")

    def search(self, query: str, top_k: int = 5, document_ids: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Search the vector database for the most relevant chunks.
        
        Args:
            query: The search query string.
            top_k: Number of results to return.
            document_ids: Optional list of document IDs to filter by.
            
        Returns:
            List of dictionaries containing the text, metadata, and distance.
        """
        logger.info(f"Searching vector store for: '{query}'")
        
        query_embedding = self._get_embeddings([query])[0]
        
        # Build filter if document_ids provided
        where_filter = None
        if document_ids:
            if len(document_ids) == 1:
                where_filter = {"document_id": document_ids[0]}
            else:
                where_filter = {"document_id": {"$in": document_ids}}
                
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where_filter,
            include=["documents", "metadatas", "distances"]
        )
        
        formatted_results = []
        if results and results["documents"] and len(results["documents"]) > 0:
            for i in range(len(results["documents"][0])):
                formatted_results.append({
                    "text": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "distance": results["distances"][0][i]
                })
                
        return formatted_results
