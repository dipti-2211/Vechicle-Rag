"""
Vehicle Intelligence Assistant — SQLite Database Manager

Manages the SQLite database lifecycle:
- Connection management via aiosqlite
- Table creation and migrations
- CRUD helper methods

Uses a singleton pattern — one database instance shared across the app.
"""

import aiosqlite
import logging
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

# SQL for creating all tables
SCHEMA_SQL = """
-- Documents metadata
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
    page_count INTEGER,
    chunk_count INTEGER DEFAULT 0,
    vehicle_name TEXT,
    manufacturer TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
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
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
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
        # Ensure the directory exists
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

        logger.info("Database connected: %s", self.db_path)

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


# ── Singleton Instance ───────────────────────────────────────────────
# Initialized in main.py lifespan; imported by services.
_db_instance: Optional[Database] = None


def get_database() -> Database:
    """
    Get the global database instance.

    Raises RuntimeError if the database hasn't been initialized yet.
    This is called by FastAPI dependency injection.
    """
    if _db_instance is None:
        raise RuntimeError("Database not initialized. App may not have started.")
    return _db_instance


async def init_database(db_path: str) -> Database:
    """Initialize and return the global database instance."""
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
