"""
Vehicle Intelligence Assistant — Chat Routes

REST API endpoints for conversation management:
- GET    /api/chat/conversations              → List all conversations
- POST   /api/chat/conversations              → Create a new conversation
- GET    /api/chat/conversations/{id}         → Get a conversation
- DELETE /api/chat/conversations/{id}         → Delete a conversation
- GET    /api/chat/conversations/{id}/messages → Get messages
- PATCH  /api/chat/conversations/{id}         → Update conversation title

Chat/ask endpoint (RAG-powered) will be added in Milestone 10.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models.database import get_database
from app.models.schemas import (
    ConversationCreate,
    ConversationResponse,
    ConversationListResponse,
    ConversationDeleteResponse,
    MessageListResponse,
    ErrorResponse,
)
from app.services.chat_service import ChatService

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_service() -> ChatService:
    """Create a ChatService with the current database."""
    return ChatService(get_database())


class ConversationUpdateTitle(BaseModel):
    """Request body for updating conversation title."""
    title: str = Field(..., min_length=1, max_length=200)


# ── Conversation Endpoints ───────────────────────────────────────────

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


# ── Message Endpoints ────────────────────────────────────────────────

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
