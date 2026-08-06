"""
Vehicle Intelligence Assistant — Pydantic Schemas

All request/response models for the API.
Using Pydantic v2 for validation, serialization, and documentation.
"""

from typing import Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════
# Document Schemas
# ═══════════════════════════════════════════════════════════════════

class DocumentResponse(BaseModel):
    """Response model for a single document."""

    id: str
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    status: str = "processing"
    page_count: Optional[int] = None
    chunk_count: int = 0
    vehicle_name: Optional[str] = None
    manufacturer: Optional[str] = None
    error_message: Optional[str] = None
    created_at: str
    updated_at: str

    @property
    def file_size_display(self) -> str:
        """Human-readable file size."""
        size = self.file_size
        for unit in ["B", "KB", "MB", "GB"]:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"


class DocumentListResponse(BaseModel):
    """Response model for listing documents."""

    documents: list[DocumentResponse]
    total: int


class DocumentDeleteResponse(BaseModel):
    """Response model for document deletion."""

    id: str
    message: str = "Document deleted successfully"


class DocumentStats(BaseModel):
    """Aggregate statistics across all documents."""

    total: int = 0
    ready: int = 0
    processing: int = 0
    error: int = 0
    total_chunks: int = 0
    total_size_bytes: int = 0


class DocumentStatusResponse(BaseModel):
    """Lightweight status-only response for polling."""

    id: str
    status: str
    chunk_count: int = 0
    error_message: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════
# Conversation Schemas
# ═══════════════════════════════════════════════════════════════════

class ConversationCreate(BaseModel):
    """Request model for creating a conversation."""

    title: Optional[str] = Field(
        default="New Conversation",
        min_length=1,
        max_length=200,
        description="Title for the conversation",
    )


class ConversationResponse(BaseModel):
    """Response model for a single conversation."""

    id: str
    title: str
    created_at: str
    updated_at: str


class ConversationListResponse(BaseModel):
    """Response model for listing conversations."""

    conversations: list[ConversationResponse]
    total: int


class ConversationDeleteResponse(BaseModel):
    """Response model for conversation deletion."""

    id: str
    message: str = "Conversation deleted successfully"


# ═══════════════════════════════════════════════════════════════════
# Message Schemas
# ═══════════════════════════════════════════════════════════════════

class SourceCitation(BaseModel):
    """A single source citation from a retrieved document chunk."""

    document_name: str
    page_number: Optional[int] = None
    section: Optional[str] = None
    relevance_score: Optional[float] = None


class MessageResponse(BaseModel):
    """Response model for a single chat message."""

    id: str
    conversation_id: str
    role: str  # 'user' or 'assistant'
    content: str
    sources: list[SourceCitation] = []
    rating: Optional[int] = None  # 1 = thumbs up, -1 = thumbs down, None = not rated
    created_at: str


class MessageListResponse(BaseModel):
    """Response model for listing messages in a conversation."""

    messages: list[MessageResponse]
    conversation_id: str
    total: int


# ═══════════════════════════════════════════════════════════════════
# Chat Schemas
# ═══════════════════════════════════════════════════════════════════

class ChatRequest(BaseModel):
    """Request model for sending a chat message."""

    question: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The question to ask about uploaded documents",
    )
    conversation_id: Optional[str] = Field(
        default=None,
        description="Conversation ID to continue. If None, creates a new conversation.",
    )
    document_ids: Optional[list[str]] = Field(
        default=None,
        description="Optional list of document IDs to scope the RAG search. If None, searches all documents.",
    )


class ChatResponse(BaseModel):
    """Response model for a chat answer (non-streaming)."""

    answer: str
    sources: list[SourceCitation] = []
    conversation_id: str
    message_id: str


# ═══════════════════════════════════════════════════════════════════
# Error Schemas
# ═══════════════════════════════════════════════════════════════════

class ErrorResponse(BaseModel):
    """Structured error response."""

    error: str
    detail: Optional[str] = None
    status_code: int = 500


# ═══════════════════════════════════════════════════════════════════
# Health Check
# ═══════════════════════════════════════════════════════════════════

class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "healthy"
    app: str
    version: str
    environment: str
    timestamp: str
    documents_count: int = 0


# ═══════════════════════════════════════════════════════════════════
# Feedback & Analytics Schemas
# ═══════════════════════════════════════════════════════════════════

class RatingUpdate(BaseModel):
    """Request model for rating a message."""

    rating: Optional[int] = Field(
        None,
        description="1 = thumbs up, -1 = thumbs down, null = remove rating",
    )

    model_config = {"json_schema_extra": {"example": {"rating": 1}}}


class DocumentStatusCounts(BaseModel):
    """Document counts broken down by status."""

    total: int
    ready: int
    processing: int
    error: int


class AnalyticsResponse(BaseModel):
    """Response model for the analytics endpoint."""

    total_queries: int
    thumbs_up: int
    thumbs_down: int
    no_rating: int
    satisfaction_rate: Optional[int] = None  # Percentage (0–100), None if no rated answers
    documents: DocumentStatusCounts
    top_documents: list[dict] = []          # [{"name": str, "query_count": int}]
