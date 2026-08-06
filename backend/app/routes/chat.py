"""
Vehicle Intelligence Assistant — Chat Routes

REST API endpoints for conversation management and RAG-powered Q&A:

Conversation CRUD:
- GET    /api/chat/conversations                    → List all conversations
- POST   /api/chat/conversations                    → Create a new conversation
- GET    /api/chat/conversations/{id}               → Get a conversation
- PATCH  /api/chat/conversations/{id}               → Update conversation title
- DELETE /api/chat/conversations/{id}               → Delete a conversation
- GET    /api/chat/conversations/{id}/messages      → Get all messages

RAG Q&A:
- POST   /api/chat/ask                              → Ask a question (RAG pipeline)
- POST   /api/chat/stream                           → Ask a question with SSE streaming

Feedback & Analytics:
- PATCH  /api/chat/messages/{id}/rating             → Rate an answer (thumbs up/down)
- GET    /api/analytics                             → Query and document analytics
"""

import json
import logging
from datetime import date
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.models.database import get_database
from app.models.schemas import (
    AnalyticsResponse,
    ChatRequest,
    ChatResponse,
    ConversationCreate,
    ConversationResponse,
    ConversationListResponse,
    ConversationDeleteResponse,
    MessageListResponse,
    MessageResponse,
    RatingUpdate,
    ErrorResponse,
)
from app.services.chat_service import ChatService
from app.services.rag_service import RagService

logger = logging.getLogger(__name__)

router = APIRouter()

# Shared RAG service instance (lazy-initializes VectorStore + Gemini on first call)
_rag_service: Optional[RagService] = None


def _get_rag_service() -> RagService:
    """Get or create the singleton RagService."""
    global _rag_service
    if _rag_service is None:
        _rag_service = RagService()
    return _rag_service


def _get_service() -> ChatService:
    """Create a ChatService with the current database."""
    return ChatService(get_database())


class ConversationUpdateTitle(BaseModel):
    """Request body for updating conversation title."""
    title: str = Field(..., min_length=1, max_length=200)


# ── RAG Endpoint ──────────────────────────────────────────────────────────────

@router.post(
    "/ask",
    response_model=ChatResponse,
    summary="Ask a question (RAG)",
    description=(
        "Send a question to the Vehicle Intelligence Assistant. "
        "Retrieves relevant context from uploaded documents and generates a grounded answer using Gemini. "
        "If conversation_id is provided, continues that conversation; otherwise creates a new one."
    ),
    responses={
        400: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
async def ask_question(body: ChatRequest) -> ChatResponse:
    """
    RAG pipeline endpoint:
    1. Create or reuse a conversation
    2. Save the user message
    3. Retrieve relevant chunks from ChromaDB
    4. Generate an answer with Gemini
    5. Save the assistant message with source citations
    6. Return answer + sources + conversation context
    """
    service = _get_service()
    rag = _get_rag_service()

    # ── Step 1: Resolve conversation ──────────────────────────────────
    if body.conversation_id:
        conv = await service.get_conversation(body.conversation_id)
        if conv is None:
            raise HTTPException(
                status_code=404,
                detail=f"Conversation not found: {body.conversation_id}",
            )
    else:
        # Auto-create a conversation titled after the first question
        short_title = body.question[:60] + ("..." if len(body.question) > 60 else "")
        conv = await service.create_conversation(
            ConversationCreate(title=short_title)
        )

    conversation_id = conv.id

    # ── Step 2: Save user message ─────────────────────────────────────
    user_msg = await service.add_message(
        conversation_id=conversation_id,
        role="user",
        content=body.question,
    )

    # ── Step 3: Build conversation history for multi-turn context ─────
    history_response = await service.get_messages(conversation_id)
    history = []
    if history_response:
        for msg in history_response.messages[:-1]:  # Exclude the just-added user message
            history.append({"role": msg.role, "content": msg.content})

    # ── Step 4: Run RAG pipeline ──────────────────────────────────────
    try:
        answer_text, sources = await rag.answer(
            question=body.question,
            conversation_history=history,
            document_ids=body.document_ids or None,
        )
    except ValueError as e:
        # Gemini API key not configured
        logger.error("RAG service configuration error: %s", e)
        raise HTTPException(
            status_code=503,
            detail=str(e),
        )
    except Exception as e:
        logger.error("RAG pipeline error for conversation %s: %s", conversation_id, e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate answer: {e}",
        )

    # ── Step 5: Save assistant message ────────────────────────────────
    assistant_msg = await service.add_message(
        conversation_id=conversation_id,
        role="assistant",
        content=answer_text,
        sources=sources,
    )

    logger.info(
        "Chat answer generated for conversation %s (%d sources).",
        conversation_id,
        len(sources),
    )

    return ChatResponse(
        answer=answer_text,
        sources=sources,
        conversation_id=conversation_id,
        message_id=assistant_msg.id,
    )


@router.post(
    "/stream",
    summary="Ask a question with streaming response (SSE)",
    description=(
        "Same as /ask but streams the answer token-by-token as Server-Sent Events. "
        "Each event is: data: {\"token\": \"...\"}\n"
        "The final event is: data: {\"done\": true, \"sources\": [...], "
        '"message_id": \"...\", "conversation_id\": \"...\"}'
    ),
    response_class=StreamingResponse,
)
async def stream_question(body: ChatRequest) -> StreamingResponse:
    """
    Streaming RAG endpoint — yields SSE tokens, saves message to DB at end.
    """
    service = _get_service()
    rag = _get_rag_service()

    # ── Step 1–3: Same conversation / history setup as /ask ────────────
    if body.conversation_id:
        conv = await service.get_conversation(body.conversation_id)
        if conv is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        conversation_id = body.conversation_id
    else:
        short_title = body.question[:60] + ("..." if len(body.question) > 60 else "")
        conv = await service.create_conversation(
            ConversationCreate(title=short_title)
        )
        conversation_id = conv.id

    # Save user message
    await service.add_message(
        conversation_id=conversation_id,
        role="user",
        content=body.question,
        sources=[],
    )

    # Build conversation history
    history_resp = await service.get_messages(conversation_id)
    history = [
        {"role": m.role, "content": m.content}
        for m in history_resp.messages[:-1]  # exclude the message we just added
        if m.role in ("user", "assistant")
    ]

    async def _event_stream() -> AsyncGenerator[str, None]:
        """Inner generator: streams tokens then saves message to DB."""
        full_answer = ""
        sources_data: list = []

        try:
            async for sse_line in rag.answer_stream(
                question=body.question,
                conversation_history=history,
                document_ids=body.document_ids or None,
            ):
                # Parse done event to extract metadata
                if sse_line.startswith("data: "):
                    payload = json.loads(sse_line[6:].strip())
                    if payload.get("done"):
                        full_answer = payload.get("full_answer", "")
                        sources_data = payload.get("sources", [])
                yield sse_line

        except Exception as e:
            logger.error("Stream error for conversation %s: %s", conversation_id, e)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

        # Save completed assistant message to DB
        try:
            from app.models.schemas import SourceCitation
            citations = [
                SourceCitation(
                    document_name=s["document_name"],
                    page_number=s.get("page_number"),
                    section=s.get("section"),
                    relevance_score=s.get("relevance_score"),
                )
                for s in sources_data
            ]
            assistant_msg = await service.add_message(
                conversation_id=conversation_id,
                role="assistant",
                content=full_answer,
                sources=citations,
            )
            # Emit a final metadata event with IDs
            yield f"data: {json.dumps({'saved': True, 'message_id': assistant_msg.id, 'conversation_id': conversation_id})}\n\n"
        except Exception as save_err:
            logger.error("Failed to save streamed message: %s", save_err)

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",    # Disable nginx buffering
        },
    )


# ── Conversation Endpoints ────────────────────────────────────────────────────

@router.get(
    "/conversations",
    response_model=ConversationListResponse,
    summary="List all conversations",
    description="Returns all conversations, ordered by most recently updated.",
)
async def list_conversations() -> ConversationListResponse:
    """List all conversations."""
    service = _get_service()
    return await service.list_conversations()


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=201,
    summary="Create a new conversation",
    description="Creates a new conversation with an optional title.",
)
async def create_conversation(
    data: ConversationCreate = ConversationCreate(),
) -> ConversationResponse:
    """Create a new conversation."""
    service = _get_service()
    return await service.create_conversation(data)


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationResponse,
    summary="Get a conversation",
    description="Returns details for a single conversation.",
    responses={404: {"model": ErrorResponse}},
)
async def get_conversation(conversation_id: str) -> ConversationResponse:
    """Get a single conversation by ID."""
    service = _get_service()
    conv = await service.get_conversation(conversation_id)

    if conv is None:
        raise HTTPException(
            status_code=404,
            detail=f"Conversation not found: {conversation_id}",
        )

    return conv


@router.patch(
    "/conversations/{conversation_id}",
    response_model=ConversationResponse,
    summary="Update conversation title",
    description="Updates the title of an existing conversation.",
    responses={404: {"model": ErrorResponse}},
)
async def update_conversation_title(
    conversation_id: str,
    data: ConversationUpdateTitle,
) -> ConversationResponse:
    """Update a conversation's title."""
    service = _get_service()
    conv = await service.update_conversation_title(conversation_id, data.title)

    if conv is None:
        raise HTTPException(
            status_code=404,
            detail=f"Conversation not found: {conversation_id}",
        )

    return conv


@router.delete(
    "/conversations/{conversation_id}",
    response_model=ConversationDeleteResponse,
    summary="Delete a conversation",
    description="Deletes a conversation and all its messages.",
    responses={404: {"model": ErrorResponse}},
)
async def delete_conversation(conversation_id: str) -> ConversationDeleteResponse:
    """Delete a conversation and all its messages."""
    service = _get_service()
    result = await service.delete_conversation(conversation_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Conversation not found: {conversation_id}",
        )

    return result


# ── Message Endpoints ─────────────────────────────────────────────────────────

@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=MessageListResponse,
    summary="Get conversation messages",
    description="Returns all messages in a conversation, ordered chronologically.",
    responses={404: {"model": ErrorResponse}},
)
async def get_messages(conversation_id: str) -> MessageListResponse:
    """Get all messages in a conversation."""
    service = _get_service()
    result = await service.get_messages(conversation_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Conversation not found: {conversation_id}",
        )

    return result


# ── Feedback Endpoint ─────────────────────────────────────────────────────────

@router.patch(
    "/messages/{message_id}/rating",
    response_model=MessageResponse,
    summary="Rate a message (thumbs up/down)",
    description=(
        "Set or clear a thumbs-up (1) or thumbs-down (-1) rating on an assistant message. "
        "Send rating=null to remove an existing rating."
    ),
    responses={404: {"model": ErrorResponse}},
)
async def rate_message(message_id: str, body: RatingUpdate) -> MessageResponse:
    """Rate an assistant message."""
    # Validate rating value
    if body.rating is not None and body.rating not in (1, -1):
        raise HTTPException(
            status_code=422,
            detail="rating must be 1 (thumbs up), -1 (thumbs down), or null (remove).",
        )

    service = _get_service()
    result = await service.rate_message(message_id, body.rating)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Message not found: {message_id}",
        )

    logger.info("Message %s rated: %s", message_id, body.rating)
    return result


# ── Analytics Endpoint ────────────────────────────────────────────────────────

@router.get(
    "/analytics",
    response_model=AnalyticsResponse,
    summary="Get analytics summary",
    description=(
        "Returns aggregate analytics: total queries, thumbs-up/down counts, "
        "satisfaction rate, document status breakdown, and top cited documents."
    ),
)
async def get_analytics() -> AnalyticsResponse:
    """Return analytics across all conversations and documents."""
    service = _get_service()
    return await service.get_analytics()


# ── Export Endpoint ─────────────────────────────────────────────────────────────

@router.get(
    "/conversations/{conversation_id}/export",
    summary="Export conversation as Markdown",
    description=(
        "Returns a downloadable .md file containing the full conversation transcript. "
        "Each turn shows the user question and assistant answer with source citations."
    ),
    response_class=StreamingResponse,
    responses={404: {"model": ErrorResponse}},
)
async def export_conversation(conversation_id: str) -> StreamingResponse:
    """
    Build a Markdown document from all messages in the conversation and
    return it as a file download.
    """
    service = _get_service()

    # Fetch conversation metadata
    conv = await service.get_conversation(conversation_id)
    if conv is None:
        raise HTTPException(
            status_code=404,
            detail=f"Conversation not found: {conversation_id}",
        )

    # Fetch all messages
    msg_response = await service.get_messages(conversation_id)
    messages = msg_response.messages if msg_response else []

    # Build Markdown content
    today = date.today().isoformat()
    title = conv.title or "Conversation"
    lines = [
        f"# {title}",
        f"",
        f"*Exported: {today} — Vehicle Intelligence Assistant*",
        f"",
        "---",
        "",
    ]

    for msg in messages:
        if msg.role == "user":
            lines.append(f"**👤 You:**")
            lines.append(f"")
            lines.append(msg.content)
            lines.append(f"")
        else:
            lines.append(f"**🤖 Assistant:**")
            lines.append(f"")
            lines.append(msg.content)
            lines.append(f"")
            # Sources
            if msg.sources:
                src_parts = []
                for src in msg.sources:
                    pct = f" ({round(src.relevance_score * 100)}%)" if src.relevance_score else ""
                    src_parts.append(f"{src.document_name}{pct}")
                lines.append(f"*Sources: {', '.join(src_parts)}*")
                lines.append(f"")
            # Rating
            if msg.rating == 1:
                lines.append("*Rating: 👍 Helpful*")
            elif msg.rating == -1:
                lines.append("*Rating: 👎 Not helpful*")
            lines.append("")
        lines.append("---")
        lines.append("")

    md_content = "\n".join(lines)

    # Sanitise filename
    safe_title = "".join(c if c.isalnum() or c in " _-" else "_" for c in title)[:60].strip()
    filename = f"{safe_title}_{today}.md"

    return StreamingResponse(
        iter([md_content]),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
