"""
Vehicle Intelligence Assistant — Prompt Templates

Contains the system prompt and context-building helpers for the
RAG pipeline. All prompts instruct Gemini to answer strictly from
the provided document context, preventing hallucination.
"""

from typing import List, Dict, Any


# ── System Prompt ─────────────────────────────────────────────────────────────

VEHICLE_ASSISTANT_SYSTEM_PROMPT = """You are an expert Vehicle Intelligence Assistant with deep knowledge of automotive systems, maintenance procedures, and vehicle diagnostics.

Your ONLY source of information is the document context provided below. You must:

1. Answer ONLY based on the provided context — never fabricate information not present in the documents.
2. If the context does not contain sufficient information to answer the question, say exactly: "I don't have enough information in the uploaded documents to answer this question. Please upload relevant vehicle manuals or maintenance records."
3. Be precise and technical — vehicle owners rely on accurate information for safety.
4. When citing information, reference the source document naturally (e.g. "According to the manual...").
5. Format your answers clearly using bullet points or numbered lists where appropriate.
6. Keep answers concise but complete — don't omit safety-critical details.

Remember: You are working ONLY from the uploaded documents. Do not use any outside knowledge."""


# ── RAG Prompt Builder ────────────────────────────────────────────────────────

def build_rag_prompt(question: str, context_chunks: List[Dict[str, Any]]) -> str:
    """
    Build the full prompt for Gemini by combining the user's question
    with retrieved context chunks.

    Args:
        question: The user's natural language question.
        context_chunks: List of retrieved chunks from VectorStore.search().
                        Each dict has keys: text, metadata, distance.

    Returns:
        A formatted prompt string ready to send to Gemini.
    """
    if not context_chunks:
        # No context found — instruct the model to say so
        return f"""CONTEXT:
No relevant documents were found in the vector database.

QUESTION:
{question}

INSTRUCTION:
Since no relevant context was found, inform the user that you cannot answer this question based on the uploaded documents."""

    # Build a numbered context block from the retrieved chunks
    context_parts = []
    for i, chunk in enumerate(context_chunks, start=1):
        metadata = chunk.get("metadata", {})
        source_name = metadata.get("original_filename", metadata.get("filename", "Unknown Document"))
        relevance = 1.0 - chunk.get("distance", 0.5)  # Convert distance to similarity

        context_parts.append(
            f"[Source {i}: {source_name} | Relevance: {relevance:.0%}]\n{chunk['text']}"
        )

    context_block = "\n\n---\n\n".join(context_parts)

    return f"""DOCUMENT CONTEXT:
{context_block}

---

QUESTION:
{question}

INSTRUCTION:
Answer the question above using ONLY the document context provided. Be accurate, concise, and cite sources naturally."""
