"""
Vehicle Intelligence Assistant — RAG Service

Orchestrates the full Retrieval-Augmented Generation pipeline:
1. Retrieve top-K relevant chunks from ChromaDB (VectorStore)
2. Build a grounded prompt from retrieved context
3. Call Gemini (model configured via GEMINI_LLM_MODEL in .env) for answer generation
4. Return the answer with source citations for the frontend

This service is called by the POST /api/chat/ask endpoint.
"""


import asyncio
import json
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

from google import genai
from google.genai import types
from google.genai.errors import ClientError

# User-friendly message when Gemini quota is exhausted
QUOTA_ERROR_MSG = (
    "Gemini API quota exceeded. The free-tier request limit has been reached. "
    "Please try again later or provide a different API key with available quota."
)

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
        user_id: Optional[str] = None,
    ) -> Tuple[str, List[SourceCitation]]:
        """
        Run the full RAG pipeline for a single question.

        Args:
            question: The user's natural language question.
            conversation_history: Optional prior messages for context
                                  [{role: "user"|"assistant", content: "..."}]
            document_ids: Optional list of document IDs to scope the search.
                          If None, searches across all documents for this user.
            user_id: The authenticated user's UUID — used to scope ChromaDB retrieval.

        Returns:
            (answer_text, source_citations) tuple.
        """
        logger.info("RAG pipeline starting for question: '%s'", question[:80])

        # ── Step 1: Retrieve ───────────────────────────────────────────────
        vector_store = self._get_vector_store()
        top_k = self.settings.top_k_results
        chunks = vector_store.search(
            question, top_k=top_k, document_ids=document_ids, user_id=user_id
        )
        if document_ids:
            logger.info(
                "Retrieved %d chunks scoped to %d document(s) for user=%s.",
                len(chunks),
                len(document_ids),
                user_id or "anon",
            )
        else:
            logger.info(
                "Retrieved %d chunks for user=%s.", len(chunks), user_id or "anon"
            )

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

    async def answer_stream(
        self,
        question: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        document_ids: Optional[List[str]] = None,
        user_id: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Streaming version of answer() — yields Server-Sent Event strings.

        Each yielded string is a complete SSE line:
          data: {"token": "..."}

        The final event carries the full metadata:
          data: {"done": true, "sources": [...], "full_answer": "..."}

        Args:
            question: The user's natural language question.
            conversation_history: Optional prior turns for multi-turn context.
            document_ids: Optional list of document IDs to scope the search.
            user_id: The authenticated user's UUID — used to scope ChromaDB retrieval.

        Yields:
            SSE-formatted strings (each ending with double newline).
        """
        # ── Step 1: Retrieve ──────────────────────────────────────────────────
        vector_store = self._get_vector_store()
        chunks = vector_store.search(
            question, top_k=self.settings.top_k_results, document_ids=document_ids,
            user_id=user_id
        )
        sources = self._build_citations(chunks)

        # ── Step 2: Build prompt ──────────────────────────────────────
        rag_prompt = build_rag_prompt(question, chunks)

        # ── Step 3: Stream from Gemini ──────────────────────────────
        full_answer_parts: List[str] = []
        async for token in self._call_gemini_stream(rag_prompt, conversation_history):
            full_answer_parts.append(token)
            yield f"data: {json.dumps({'token': token})}\n\n"

        full_answer = "".join(full_answer_parts).strip()

        # ── Final event with metadata ─────────────────────────────────
        sources_data = [
            {
                "document_name": s.document_name,
                "page_number": s.page_number,
                "section": s.section,
                "relevance_score": s.relevance_score,
            }
            for s in sources
        ]
        yield f"data: {json.dumps({'done': True, 'sources': sources_data, 'full_answer': full_answer})}\n\n"
        logger.info("Streaming RAG complete. Length: %d, Sources: %d", len(full_answer), len(sources))

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

    def _build_gemini_contents(
        self,
        prompt: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> List[Any]:
        """Build the Gemini contents list, including prior conversation history."""
        contents: List[Any] = []
        if conversation_history:
            for turn in conversation_history[-10:]:
                role = "user" if turn["role"] == "user" else "model"
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part(text=turn["content"])],
                    )
                )
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part(text=prompt)],
            )
        )
        return contents

    async def _call_gemini(
        self,
        prompt: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """
        Call the Gemini API and return the response text.
        Runs the synchronous SDK in a thread pool to avoid blocking the event loop.

        Raises:
            RuntimeError: With a user-friendly message if quota is exceeded (429)
                          or if Gemini returns an error.
            ValueError: If the API key is not configured.
        """
        try:
            client = self._get_gemini_client()
            model_name = self.settings.gemini_llm_model
            contents = self._build_gemini_contents(prompt, conversation_history)
            config = types.GenerateContentConfig(
                system_instruction=VEHICLE_ASSISTANT_SYSTEM_PROMPT,
                temperature=0.2,
                max_output_tokens=2048,
            )

            # Run the synchronous Gemini SDK call in a thread pool
            # so we don't block the async event loop.
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=config,
                ),
            )

            answer = response.text
            if not answer:
                raise RuntimeError("Gemini returned an empty response.")
            return answer.strip()

        except ClientError as e:
            err_str = str(e)
            if "429" in err_str:
                logger.warning("Gemini quota exceeded (429): %s", e)
                raise RuntimeError(QUOTA_ERROR_MSG)
            logger.error("Gemini client error: %s", e)
            raise RuntimeError(f"Gemini API error: {e}") from e

        except ValueError as e:
            # API key not configured
            logger.error("Gemini configuration error: %s", e)
            raise

        except Exception as e:
            logger.error("Gemini API call failed: %s", e)
            raise RuntimeError(f"Failed to generate answer: {e}") from e

    async def _call_gemini_stream(
        self,
        prompt: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Async generator that streams Gemini response tokens.

        Yields:
            Raw text tokens from Gemini's streaming API.
        """
        try:
            client = self._get_gemini_client()
            model_name = self.settings.gemini_llm_model
            contents = self._build_gemini_contents(prompt, conversation_history)
            config = types.GenerateContentConfig(
                system_instruction=VEHICLE_ASSISTANT_SYSTEM_PROMPT,
                temperature=0.2,
                max_output_tokens=2048,
            )

            # Gemini's generate_content_stream is synchronous — run in thread pool
            loop = asyncio.get_running_loop()
            response_iter = await loop.run_in_executor(
                None,
                lambda: client.models.generate_content_stream(
                    model=model_name,
                    contents=contents,
                    config=config,
                ),
            )

            for chunk in response_iter:
                token = chunk.text
                if token:
                    yield token
                    # Yield control back to event loop between chunks
                    await asyncio.sleep(0)

        except ClientError as e:
            err_str = str(e)
            if "429" in err_str:
                logger.warning("Gemini quota exceeded (429) in stream: %s", e)
                raise RuntimeError(QUOTA_ERROR_MSG)
            logger.error("Gemini stream client error: %s", e)
            raise RuntimeError(f"Gemini API error: {e}") from e

        except ValueError as e:
            logger.error("Gemini stream config error: %s", e)
            raise

        except Exception as e:
            logger.error("Gemini stream failed: %s", e)
            raise RuntimeError(f"Streaming failed: {e}") from e
