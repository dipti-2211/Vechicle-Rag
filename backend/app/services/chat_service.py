"""
Vehicle Intelligence Assistant — Chat Service

Business logic for conversation and message management.
Handles CRUD for conversations and messages in SQLite.
RAG-powered answer generation will be added in Milestone 10.
"""

import json
import logging
import uuid
from typing import Optional

from app.models.database import Database
from app.models.schemas import (
    AnalyticsResponse,
    ConversationCreate,
    ConversationResponse,
    ConversationListResponse,
    ConversationDeleteResponse,
    DocumentStatusCounts,
    MessageResponse,
    MessageListResponse,
    SourceCitation,
)

logger = logging.getLogger(__name__)


class ChatService:
    """Manages conversations and messages in the database."""

    def __init__(self, db: Database) -> None:
        self.db = db

    # ── Conversations ────────────────────────────────────────────────

    async def list_conversations(self) -> ConversationListResponse:
        """
        List all conversations, ordered by most recently updated.

        Returns:
            ConversationListResponse with all conversations.
        """
        rows = await self.db.fetch_all(
            "SELECT * FROM conversations ORDER BY updated_at DESC"
        )
        conversations = [ConversationResponse(**row) for row in rows]

        return ConversationListResponse(
            conversations=conversations,
            total=len(conversations),
        )

    async def get_conversation(
        self, conversation_id: str
    ) -> Optional[ConversationResponse]:
        """
        Get a single conversation by ID.

        Args:
            conversation_id: The conversation UUID.

        Returns:
            ConversationResponse if found, None otherwise.
        """
        row = await self.db.fetch_one(
            "SELECT * FROM conversations WHERE id = ?",
            (conversation_id,),
        )
        if row is None:
            return None
        return ConversationResponse(**row)

    async def create_conversation(
        self, data: ConversationCreate
    ) -> ConversationResponse:
        """
        Create a new conversation.

        Args:
            data: ConversationCreate with optional title.

        Returns:
            The created ConversationResponse.
        """
        conv_id = str(uuid.uuid4())
        title = data.title or "New Conversation"

        await self.db.execute(
            """
            INSERT INTO conversations (id, title)
            VALUES (?, ?)
            """,
            (conv_id, title),
        )

        logger.info("Created conversation: id=%s, title=%s", conv_id, title)

        conv = await self.get_conversation(conv_id)
        assert conv is not None, f"Conversation {conv_id} should exist after insert"
        return conv

    async def update_conversation_title(
        self, conversation_id: str, title: str
    ) -> Optional[ConversationResponse]:
        """
        Update the title of a conversation.

        Args:
            conversation_id: The conversation UUID.
            title: New title.

        Returns:
            Updated ConversationResponse, or None if not found.
        """
        conv = await self.get_conversation(conversation_id)
        if conv is None:
            return None

        await self.db.execute(
            """
            UPDATE conversations
            SET title = ?, updated_at = datetime('now')
            WHERE id = ?
            """,
            (title, conversation_id),
        )

        logger.info("Updated conversation %s title to: %s", conversation_id, title)
        return await self.get_conversation(conversation_id)

    async def delete_conversation(
        self, conversation_id: str
    ) -> Optional[ConversationDeleteResponse]:
        """
        Delete a conversation and all its messages.

        Messages are deleted automatically via CASCADE.

        Args:
            conversation_id: The conversation UUID.

        Returns:
            ConversationDeleteResponse if found, None if not found.
        """
        conv = await self.get_conversation(conversation_id)
        if conv is None:
            return None

        await self.db.execute(
            "DELETE FROM conversations WHERE id = ?",
            (conversation_id,),
        )

        logger.info("Deleted conversation: %s", conversation_id)
        return ConversationDeleteResponse(id=conversation_id)

    # ── Messages ─────────────────────────────────────────────────────

    async def get_messages(
        self, conversation_id: str
    ) -> Optional[MessageListResponse]:
        """
        Get all messages in a conversation, ordered chronologically.

        Args:
            conversation_id: The conversation UUID.

        Returns:
            MessageListResponse if conversation exists, None otherwise.
        """
        # Verify conversation exists
        conv = await self.get_conversation(conversation_id)
        if conv is None:
            return None

        rows = await self.db.fetch_all(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conversation_id,),
        )

        messages = []
        for row in rows:
            # Parse sources from JSON string
            sources_raw = row.get("sources", "[]")
            try:
                sources_list = json.loads(sources_raw) if isinstance(sources_raw, str) else sources_raw
                sources = [SourceCitation(**s) for s in sources_list]
            except (json.JSONDecodeError, TypeError):
                sources = []

            messages.append(
                MessageResponse(
                    id=row["id"],
                    conversation_id=row["conversation_id"],
                    role=row["role"],
                    content=row["content"],
                    sources=sources,
                    rating=row.get("rating"),
                    created_at=row["created_at"],
                )
            )

        return MessageListResponse(
            messages=messages,
            conversation_id=conversation_id,
            total=len(messages),
        )

    async def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        sources: Optional[list[SourceCitation]] = None,
    ) -> MessageResponse:
        """
        Add a message to a conversation.

        Args:
            conversation_id: The conversation UUID.
            role: Message role ('user' or 'assistant').
            content: Message text content.
            sources: Optional list of source citations (for assistant messages).

        Returns:
            The created MessageResponse.
        """
        msg_id = str(uuid.uuid4())
        sources_json = json.dumps(
            [s.model_dump() for s in sources] if sources else []
        )

        await self.db.execute(
            """
            INSERT INTO messages (id, conversation_id, role, content, sources)
            VALUES (?, ?, ?, ?, ?)
            """,
            (msg_id, conversation_id, role, content, sources_json),
        )

        # Update conversation's updated_at timestamp
        await self.db.execute(
            "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?",
            (conversation_id,),
        )

        logger.debug(
            "Added %s message to conversation %s", role, conversation_id
        )

        # Build and return the response
        sources_parsed = sources or []
        row = await self.db.fetch_one(
            "SELECT created_at FROM messages WHERE id = ?", (msg_id,)
        )

        return MessageResponse(
            id=msg_id,
            conversation_id=conversation_id,
            role=role,
            content=content,
            sources=sources_parsed,
            rating=None,
            created_at=row["created_at"] if row else "",
        )

    async def rate_message(
        self,
        message_id: str,
        rating: Optional[int],
    ) -> Optional[MessageResponse]:
        """
        Set or clear a thumbs-up/down rating on an assistant message.

        Args:
            message_id: The message UUID.
            rating: 1 (up), -1 (down), or None (remove rating).

        Returns:
            Updated MessageResponse, or None if message not found.
        """
        # Verify message exists
        row = await self.db.fetch_one("SELECT * FROM messages WHERE id = ?", (message_id,))
        if row is None:
            return None

        await self.db.execute(
            "UPDATE messages SET rating = ? WHERE id = ?",
            (rating, message_id),
        )
        logger.info("Message %s rated: %s", message_id, rating)

        # Fetch updated row
        updated = await self.db.fetch_one("SELECT * FROM messages WHERE id = ?", (message_id,))
        sources_raw = updated.get("sources", "[]")
        try:
            sources_list = json.loads(sources_raw) if isinstance(sources_raw, str) else sources_raw
            sources = [SourceCitation(**s) for s in sources_list]
        except (json.JSONDecodeError, TypeError):
            sources = []

        return MessageResponse(
            id=updated["id"],
            conversation_id=updated["conversation_id"],
            role=updated["role"],
            content=updated["content"],
            sources=sources,
            rating=updated.get("rating"),
            created_at=updated["created_at"],
        )

    async def get_analytics(self) -> AnalyticsResponse:
        """
        Compute analytics across all conversations and documents.

        Returns:
            AnalyticsResponse with query counts, rating stats, and document breakdown.
        """
        # ── Query / rating counts ─────────────────────────────────────────
        row = await self.db.fetch_one(
            """
            SELECT
                SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END)                       AS total_queries,
                SUM(CASE WHEN role = 'assistant' AND rating =  1 THEN 1 ELSE 0 END)        AS thumbs_up,
                SUM(CASE WHEN role = 'assistant' AND rating = -1 THEN 1 ELSE 0 END)        AS thumbs_down,
                SUM(CASE WHEN role = 'assistant' AND rating IS NULL THEN 1 ELSE 0 END)     AS no_rating
            FROM messages
            """
        )

        total_queries = row["total_queries"] or 0
        thumbs_up     = row["thumbs_up"]     or 0
        thumbs_down   = row["thumbs_down"]   or 0
        no_rating     = row["no_rating"]     or 0
        rated = thumbs_up + thumbs_down
        satisfaction_rate = round(thumbs_up / rated * 100) if rated > 0 else None

        # ── Document status counts ─────────────────────────────────────────
        doc_row = await self.db.fetch_one(
            """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'ready'      THEN 1 ELSE 0 END) AS ready,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
                SUM(CASE WHEN status = 'error'      THEN 1 ELSE 0 END) AS error
            FROM documents
            """
        )

        docs = DocumentStatusCounts(
            total=doc_row["total"] or 0,
            ready=doc_row["ready"] or 0,
            processing=doc_row["processing"] or 0,
            error=doc_row["error"] or 0,
        )

        # ── Top documents by query count ─────────────────────────────────
        # Count how often each document is cited in answers
        top_rows = await self.db.fetch_all(
            """
            SELECT
                json_extract(j.value, '$.document_name') AS name,
                COUNT(*) AS query_count
            FROM messages m,
                 json_each(m.sources) j
            WHERE m.role = 'assistant'
            GROUP BY name
            ORDER BY query_count DESC
            LIMIT 5
            """
        )
        top_docs = [
            {"name": r["name"], "query_count": r["query_count"]}
            for r in top_rows
            if r["name"]
        ]

        return AnalyticsResponse(
            total_queries=total_queries,
            thumbs_up=thumbs_up,
            thumbs_down=thumbs_down,
            no_rating=no_rating,
            satisfaction_rate=satisfaction_rate,
            documents=docs,
            top_documents=top_docs,
        )
