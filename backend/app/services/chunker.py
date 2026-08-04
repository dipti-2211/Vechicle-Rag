"""
Vehicle Intelligence Assistant — Document Chunker Service

Responsible for breaking down large extracted text into smaller, overlapping chunks
suitable for vector embeddings and semantic search.
"""

import logging
from typing import List

from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)


class DocumentChunker:
    """Service to chunk text into manageable pieces for vector search."""

    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        """
        Initialize the chunker with specific size and overlap parameters.
        
        Args:
            chunk_size: Maximum number of characters per chunk.
            chunk_overlap: Number of characters overlapping between consecutive chunks 
                           to preserve context.
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        # RecursiveCharacterTextSplitter splits by paragraph, then sentence, then word.
        # This keeps semantically related text together as much as possible.
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            is_separator_regex=False,
        )

    def chunk_text(self, text: str) -> List[str]:
        """
        Split the provided text into chunks.
        
        Args:
            text: The full extracted text from a document.
            
        Returns:
            A list of string chunks.
        """
        if not text or not text.strip():
            logger.warning("Empty text provided to chunker.")
            return []

        try:
            chunks = self.text_splitter.split_text(text)
            logger.info("Split text into %d chunks", len(chunks))
            return chunks
        except Exception as e:
            logger.error("Error during text chunking: %s", e)
            raise RuntimeError(f"Failed to chunk text: {e}")
