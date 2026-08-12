"""
Vehicle Intelligence Assistant — Supabase PostgreSQL Database Manager

Implements the same interface as the SQLite Database class (database.py)
so all existing services (ChatService, DocumentService) work unchanged.

Uses asyncpg for direct async PostgreSQL connections to Supabase.

Key design decisions:
- Identical public API: execute(), fetch_one(), fetch_all()
- asyncpg returns asyncpg.Record objects — converted to dict for compatibility
- Parameterized queries use $1..$N placeholders (PostgreSQL style vs SQLite ?)
- SQLite-style datetime('now') is replaced with NOW() at runtime
- JSON columns (sources) stored as TEXT in SQLite, as JSONB in PostgreSQL;
  we store as text (json dumps) for compatibility and parse in the service layer

This file is NOT imported directly — it is selected at startup in main.py
based on whether SUPABASE_URL is configured.
"""

import json
import logging
import re
from typing import Any, Optional

import asyncpg

logger = logging.getLogger(__name__)

# ── Schema (PostgreSQL) ──────────────────────────────────────────────────────
SUPABASE_SCHEMA_SQL = """
-- Documents metadata
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    file_path TEXT NOT NULL DEFAULT '',
    storage_path TEXT,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
    page_count INTEGER,
    chunk_count INTEGER DEFAULT 0,
    vehicle_name TEXT,
    manufacturer TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks for ChromaDB reconstruction after restarts
CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages within conversations
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    sources TEXT DEFAULT '[]',
    rating INTEGER DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
"""

_SQLITE_PLACEHOLDER_RE = re.compile(r"\?")
_SQLITE_NOW_RE = re.compile(r"datetime\('now'\)", re.IGNORECASE)


def _adapt_query(query: str, params: tuple) -> tuple[str, list]:
    """
    Translate a SQLite-style query to PostgreSQL asyncpg format:
    - Replace ? placeholders with $1, $2, ...
    - Replace datetime('now') with NOW()
    - Return (pg_query, params_list)
    """
    # Replace datetime('now') with NOW()
    query = _SQLITE_NOW_RE.sub("NOW()", query)

    # Replace ? with $1, $2, ... in order
    pg_query = ""
    idx = 0
    for i, char in enumerate(query):
        if char == "?":
            idx += 1
            pg_query += f"${idx}"
        else:
            pg_query += char

    return pg_query, list(params)


def _row_to_dict(record) -> dict[str, Any]:
    """Convert an asyncpg.Record to a plain dict."""
    if record is None:
        return None
    d = dict(record)
    # Convert TIMESTAMPTZ fields to ISO strings for compatibility with the
    # existing code that does things like datetime.fromisoformat(row["created_at"])
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            # asyncpg returns datetime objects; services expect ISO strings
            d[k] = v.isoformat()
    return d


class SupabaseDatabase:
    """
    Async PostgreSQL database manager backed by Supabase.

    Public API matches the SQLite Database class so all existing services
    work without modification.
    """

    def __init__(self, connection_string: str) -> None:
        self._connection_string = connection_string
        self._pool: Optional[asyncpg.Pool] = None

    async def connect(self) -> None:
        """Open the connection pool and create/migrate tables."""
        logger.info("Connecting to Supabase PostgreSQL...")
        self._pool = await asyncpg.create_pool(
            dsn=self._connection_string,
            min_size=1,
            max_size=5,
            command_timeout=30,
        )

        # Create tables if they don't exist
        async with self._pool.acquire() as conn:
            await conn.execute(SUPABASE_SCHEMA_SQL)

        logger.info("✅ Supabase PostgreSQL connected and schema applied.")

    async def disconnect(self) -> None:
        """Close the connection pool."""
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("Supabase PostgreSQL disconnected.")

    @property
    def pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError(
                "SupabaseDatabase not connected. Call connect() first."
            )
        return self._pool

    async def execute(self, query: str, params: tuple = ()) -> None:
        """Execute a single SQL statement (INSERT/UPDATE/DELETE)."""
        pg_query, pg_params = _adapt_query(query, params)
        async with self.pool.acquire() as conn:
            await conn.execute(pg_query, *pg_params)

    async def fetch_one(
        self, query: str, params: tuple = ()
    ) -> Optional[dict[str, Any]]:
        """Fetch a single row as a dictionary."""
        pg_query, pg_params = _adapt_query(query, params)
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(pg_query, *pg_params)
        return _row_to_dict(row)

    async def fetch_all(
        self, query: str, params: tuple = ()
    ) -> list[dict[str, Any]]:
        """Fetch all rows as a list of dictionaries."""
        pg_query, pg_params = _adapt_query(query, params)
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(pg_query, *pg_params)
        return [_row_to_dict(r) for r in rows]


# ── Singleton management ─────────────────────────────────────────────────────
_sb_db_instance: Optional[SupabaseDatabase] = None


def get_supabase_database() -> SupabaseDatabase:
    if _sb_db_instance is None:
        raise RuntimeError(
            "SupabaseDatabase not initialized. App may not have started."
        )
    return _sb_db_instance


async def init_supabase_database(connection_string: str) -> SupabaseDatabase:
    """Initialize and return the global SupabaseDatabase instance."""
    global _sb_db_instance
    _sb_db_instance = SupabaseDatabase(connection_string)
    await _sb_db_instance.connect()
    return _sb_db_instance


async def close_supabase_database() -> None:
    """Close the global SupabaseDatabase instance."""
    global _sb_db_instance
    if _sb_db_instance:
        await _sb_db_instance.disconnect()
        _sb_db_instance = None
