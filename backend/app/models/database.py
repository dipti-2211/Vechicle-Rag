"""
Vehicle Intelligence Assistant — SQLite Database Manager (local / fallback)

Manages the SQLite database lifecycle:
- Connection management via aiosqlite
- Table creation and migrations
- CRUD helper methods

Uses a singleton pattern — one database instance shared across the app.

In production (with Supabase configured), main.py will register a
SupabaseDatabase instance instead. All services call get_database() which
returns whatever has been registered — SQLite or Supabase.
"""

import aiosqlite
import logging
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

# SQL for creating all tables (SQLite)
SCHEMA_SQL = """
-- Documents metadata
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_path TEXT NOT NULL DEFAULT '',
    storage_path TEXT,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
    page_count INTEGER,
    chunk_count INTEGER DEFAULT 0,
    vehicle_name TEXT,
    manufacturer TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Document chunks (for ChromaDB reconstruction after restarts)
CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT DEFAULT 'New Conversation',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Messages within conversations
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    sources TEXT DEFAULT '[]',
    rating INTEGER DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
"""


class Database:
    """
    Async SQLite database manager.

    Usage:
        db = Database("./data/app.db")
        await db.connect()
        rows = await db.fetch_all("SELECT * FROM documents")
        await db.disconnect()
    """

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        self._connection: Optional[aiosqlite.Connection] = None

    async def connect(self) -> None:
        """Open the database connection and create tables."""
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)

        self._connection = await aiosqlite.connect(self.db_path)

        # Enable WAL mode for better concurrent read performance
        await self._connection.execute("PRAGMA journal_mode=WAL")

        # Enable foreign key constraints (off by default in SQLite)
        await self._connection.execute("PRAGMA foreign_keys=ON")

        # Return rows as dictionaries instead of tuples
        self._connection.row_factory = aiosqlite.Row

        # Create tables
        await self._connection.executescript(SCHEMA_SQL)
        await self._connection.commit()

        # ── Safe migrations for existing databases ────────────────────
        # Add 'rating' column to messages if it doesn't exist yet
        try:
            await self._connection.execute(
                "ALTER TABLE messages ADD COLUMN rating INTEGER DEFAULT NULL"
            )
            await self._connection.commit()
            logger.info("Migration: added 'rating' column to messages table")
        except Exception:
            pass

        # Add 'storage_path' column to documents if it doesn't exist yet
        try:
            await self._connection.execute(
                "ALTER TABLE documents ADD COLUMN storage_path TEXT"
            )
            await self._connection.commit()
            logger.info("Migration: added 'storage_path' column to documents table")
        except Exception:
            pass

        logger.info("SQLite database connected: %s", self.db_path)

    async def disconnect(self) -> None:
        """Close the database connection."""
        if self._connection:
            await self._connection.close()
            self._connection = None
            logger.info("Database disconnected")

    @property
    def connection(self) -> aiosqlite.Connection:
        """Get the active connection, raising if not connected."""
        if self._connection is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        return self._connection

    async def execute(
        self, query: str, params: tuple = ()
    ) -> aiosqlite.Cursor:
        """Execute a single SQL statement."""
        cursor = await self.connection.execute(query, params)
        await self.connection.commit()
        return cursor

    async def fetch_one(
        self, query: str, params: tuple = ()
    ) -> Optional[dict[str, Any]]:
        """Fetch a single row as a dictionary."""
        cursor = await self.connection.execute(query, params)
        row = await cursor.fetchone()
        if row is None:
            return None
        return dict(row)

    async def fetch_all(
        self, query: str, params: tuple = ()
    ) -> list[dict[str, Any]]:
        """Fetch all rows as a list of dictionaries."""
        cursor = await self.connection.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


# ── Singleton Instance ───────────────────────────────────────────────────────
# Can be either a SQLite Database or a SupabaseDatabase — both implement
# the same fetch_all / fetch_one / execute interface.
_db_instance = None


def get_database():
    """
    Get the global database instance.

    Raises RuntimeError if the database hasn't been initialized yet.
    This is called by FastAPI dependency injection and services.
    """
    if _db_instance is None:
        raise RuntimeError("Database not initialized. App may not have started.")
    return _db_instance


def set_database(instance) -> None:
    """
    Register the active database instance.

    Called by main.py at startup with either a SQLite Database or a
    SupabaseDatabase instance, depending on configuration.
    """
    global _db_instance
    _db_instance = instance


async def init_database(db_path: str) -> "Database":
    """Initialize and return a SQLite Database instance (local dev / fallback)."""
    global _db_instance
    _db_instance = Database(db_path)
    await _db_instance.connect()
    return _db_instance


async def close_database() -> None:
    """Close the global database instance."""
    global _db_instance
    if _db_instance:
        await _db_instance.disconnect()
        _db_instance = None
