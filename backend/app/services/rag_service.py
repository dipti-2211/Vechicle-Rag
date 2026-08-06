"""
Vehicle Intelligence Assistant — RAG Service

Orchestrates the full Retrieval-Augmented Generation pipeline:
1. Retrieve top-K relevant chunks from ChromaDB (VectorStore)
2. Build a grounded prompt from retrieved context
3. Call Gemini (gemini-2.0-flash) for answer generation
4. Return the answer with source citations for the frontend

This service is called by the POST /api/chat/ask endpoint.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from google import genai
from google.genai import types

from app.config import get_settings
from app.models.schemas import SourceCitation
from app.prompts.templates import VEHICLE_ASSISTANT_SYSTEM_PROMPT, build_rag_prompt
from app.services.vector_store import VectorStore

logger = logging.getLogger(__name__)


class RagService:
    """
    Orchestrates retrieval + generation for the Vehicle Intelligence Assistant.

    Lifecycle: Create once per request (lightweight — VectorStore is the
    expensive object and should be reused at the app level if needed).
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        self._vector_store: Optional[VectorStore] = None
        self._gemini_client: Optional[genai.Client] = None

    # ── Lazy initialization ───────────────────────────────────────────

    def _get_vector_store(self) -> VectorStore:
        """Lazy-load the VectorStore (loads embedding model on first call)."""
        if self._vector_store is None:
            self._vector_store = VectorStore()
        return self._vector_store

    def _get_gemini_client(self) -> genai.Client:
        """Lazy-load the Gemini client."""
        if self._gemini_client is None:
            api_key = self.settings.gemini_api_key
            if not api_key:
                raise ValueError(
                    "GEMINI_API_KEY is not set. Add it to your .env file to use the chat feature."
                )
            self._gemini_client = genai.Client(api_key=api_key)
        return self._gemini_client

    # ── Main pipeline ─────────────────────────────────────────────────

    async def answer(
        self,
        question: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        document_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[SourceCitation]]:
        """
        Run the full RAG pipeline for a single question.

        Args:
            question: The user's natural language question.
            conversation_history: Optional prior messages for context
                                  [{role: "user"|"assistant", content: "..."}]
            document_ids: Optional list of document IDs to scope the search.
                          If None, searches across all indexed documents.

        Returns:
            (answer_text, source_citations) tuple.
        """
        logger.info("RAG pipeline starting for question: '%s'", question[:80])

        # ── Step 1: Retrieve ─────────────────────────────────────────
        vector_store = self._get_vector_store()
        top_k = self.settings.top_k_results
        chunks = vector_store.search(question, top_k=top_k, document_ids=document_ids)
        if document_ids:
            logger.info(
                "Retrieved %d chunks scoped to %d document(s).",
                len(chunks),
                len(document_ids),
            )
        else:
            logger.info("Retrieved %d chunks from all documents.", len(chunks))

        # ── Step 2: Build sources for citation ───────────────────────
        sources = self._build_citations(chunks)

        # ── Step 3: Build prompt ─────────────────────────────────────
        rag_prompt = build_rag_prompt(question, chunks)

        # ── Step 4: Call Gemini ──────────────────────────────────────
        answer_text = await self._call_gemini(rag_prompt, conversation_history)

        logger.info(
            "RAG pipeline complete. Answer length: %d chars, Sources: %d",
            len(answer_text),
            len(sources),
        )
        return answer_text, sources

    # ── Private helpers ───────────────────────────────────────────────

    def _build_citations(self, chunks: List[Dict[str, Any]]) -> List[SourceCitation]:
        """
        Convert raw vector search results into SourceCitation objects.
        Deduplicates citations by document name.
        """
        seen_docs: set[str] = set()
        citations: List[SourceCitation] = []

        for chunk in chunks:
            meta = chunk.get("metadata", {})
            doc_name = meta.get("original_filename", meta.get("filename", "Unknown Document"))
            relevance_score = round(1.0 - chunk.get("distance", 0.5), 3)

            if doc_name not in seen_docs:
                seen_docs.add(doc_name)
                citations.append(
                    SourceCitation(
                        document_name=doc_name,
                        page_number=meta.get("page_number"),
                        section=meta.get("section"),
                        relevance_score=relevance_score,
                    )
                )

        return citations

    async def _call_gemini(
        self,
        prompt: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """
        Call the Gemini API and return the response text.

        Args:
            prompt: The RAG-augmented prompt with context.
            conversation_history: Optional prior turns for multi-turn context.

        Returns:
            Generated answer string.

        Raises:
            RuntimeError: If Gemini API call fails.
        """
        try:
            client = self._get_gemini_client()
            model_name = self.settings.gemini_llm_model

            # Build the contents list (multi-turn if history provided)
            contents: List[Any] = []

            # Add conversation history (last 10 turns max to stay within context)
            if conversation_history:
                for turn in conversation_history[-10:]:
                    role = "user" if turn["role"] == "user" else "model"
                    contents.append(
                        types.Content(
                            role=role,
                            parts=[types.Part(text=turn["content"])],
                        )
                    )

            # Add the current RAG prompt as the final user message
            contents.append(
                types.Content(
                    role="user",
                    parts=[types.Part(text=prompt)],
                )
            )

            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=VEHICLE_ASSISTANT_SYSTEM_PROMPT,
                    temperature=0.2,       # Low temp for factual, grounded answers
                    max_output_tokens=2048,
                ),
            )

            answer = response.text
            if not answer:
                raise RuntimeError("Gemini returned an empty response.")

            return answer.strip()

        except ValueError as e:
            # API key not configured
            logger.error("Gemini configuration error: %s", e)
            raise
        except Exception as e:
            logger.error("Gemini API call failed: %s", e)
            raise RuntimeError(f"Failed to generate answer: {e}") from e
