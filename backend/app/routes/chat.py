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
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models.database import get_database
from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    ConversationCreate,
    ConversationResponse,
    ConversationListResponse,
    ConversationDeleteResponse,
    MessageListResponse,
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
