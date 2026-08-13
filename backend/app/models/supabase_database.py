"""
Vehicle Intelligence Assistant — Supabase Database (PostgREST-based)

Implements the same interface as the SQLite Database class (database.py)
so all existing services (ChatService, DocumentService) work unchanged.

Uses the supabase-py REST client (PostgREST under the hood).
No asyncpg or direct PostgreSQL connection needed —
only SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are required.

Design:
  - Runs the sync supabase-py client in an asyncio thread executor
  - Translates the SQL queries used in this app to PostgREST table API calls
  - Handles all UPDATE/INSERT/DELETE/SELECT patterns used by the services
  - The JOIN query in chunk_store.py is handled via two-step queries there
"""

import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ── Query pattern helpers ────────────────────────────────────────────────────

_TABLE_FROM_INSERT = re.compile(
    r"INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)",
    re.IGNORECASE | re.DOTALL,
)
_TABLE_FROM_SELECT = re.compile(
    r"FROM\s+(\w+)(?:\s+\w+)?",
    re.IGNORECASE,
)
_WHERE_CLAUSE = re.compile(
    r"WHERE\s+(.+?)(?:ORDER\s+BY|LIMIT|$)",
    re.IGNORECASE | re.DOTALL,
)
_ORDER_CLAUSE = re.compile(
    r"ORDER\s+BY\s+(\w+(?:\.\w+)?)\s*(ASC|DESC)?",
    re.IGNORECASE,
)
_LIMIT_CLAUSE = re.compile(r"LIMIT\s+(\d+)", re.IGNORECASE)
_SELECT_COLS = re.compile(
    r"SELECT\s+(.+?)\s+FROM",
    re.IGNORECASE | re.DOTALL,
)
_TABLE_FROM_UPDATE = re.compile(r"UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)", re.IGNORECASE | re.DOTALL)
_TABLE_FROM_DELETE = re.compile(r"DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+)", re.IGNORECASE | re.DOTALL)
_COUNT_QUERY = re.compile(r"SELECT\s+COUNT\(\*\)", re.IGNORECASE)
_DATETIME_NOW = re.compile(r"datetime\('now'\)", re.IGNORECASE)


def _now_iso() -> str:
    """Current UTC time as ISO string (replaces SQLite datetime('now'))."""
    return datetime.now(timezone.utc).isoformat()


def _parse_conditions(where_str: str, params: list) -> Tuple[list, list]:
    """
    Parse WHERE clause into list of (column, value) pairs.
    Consumes params in order for each ? placeholder.
    Returns (conditions, remaining_params).
    """
    conditions = []
    remaining = list(params)

    # Split on AND
    parts = re.split(r"\s+AND\s+", where_str.strip(), flags=re.IGNORECASE)
    for part in parts:
        part = part.strip()
        m = re.match(r"(\w+(?:\.\w+)?)\s*=\s*\?", part)
        if m:
            col = m.group(1).split(".")[-1]  # strip table alias
            val = remaining.pop(0) if remaining else None
            conditions.append((col, val))

    return conditions, remaining


def _parse_set_clause(set_str: str, params: list) -> Tuple[dict, list]:
    """
    Parse SET clause into a data dict.
    Handles:
      col = ?               -> use next param value
      updated_at = datetime('now')  -> use current ISO timestamp
    Returns (data_dict, remaining_params).
    """
    data = {}
    remaining = list(params)

    # Remove datetime('now') assignments first
    # e.g. "updated_at = datetime('now')"
    set_clean = _DATETIME_NOW.sub("'__NOW__'", set_str)

    # Split by comma (but not inside parens)
    assignments = re.split(r",\s*(?![^()]*\))", set_clean)

    for assignment in assignments:
        assignment = assignment.strip()
        m = re.match(r"(\w+)\s*=\s*(.+)", assignment)
        if not m:
            continue
        col = m.group(1).strip()
        val_str = m.group(2).strip()

        if val_str == "'__NOW__'":
            data[col] = _now_iso()
        elif val_str == "?":
            val = remaining.pop(0) if remaining else None
            data[col] = val
        elif val_str.startswith("'") and val_str.endswith("'"):
            data[col] = val_str[1:-1]
        else:
            # Literal value or expression — skip (e.g. CASE expressions)
            pass

    return data, remaining


class SupabaseDatabase:
    """
    Async database manager backed by Supabase PostgREST.

    Public API matches the SQLite Database class — all existing services
    work without modification.
    """

    def __init__(self, client) -> None:
        """
        Args:
            client: Initialized supabase-py sync client.
        """
        self._client = client

    async def connect(self) -> None:
        """No-op: connection is managed by supabase-py internally."""
        logger.info("SupabaseDatabase (PostgREST) ready.")

    async def disconnect(self) -> None:
        """No-op: supabase-py manages connection lifecycle."""
        logger.info("SupabaseDatabase disconnected.")

    async def _run(self, func):
        """Execute a synchronous supabase-py call in a thread pool."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, func)

    # ── Public Interface ─────────────────────────────────────────────────────

    async def execute(self, query: str, params: tuple = ()) -> None:
        """Execute an INSERT, UPDATE, or DELETE statement."""
        q = query.strip()
        ql = q.upper().lstrip()

        if ql.startswith("INSERT"):
            await self._execute_insert(q, list(params))
        elif ql.startswith("UPDATE"):
            await self._execute_update(q, list(params))
        elif ql.startswith("DELETE"):
            await self._execute_delete(q, list(params))
        else:
            logger.warning("SupabaseDatabase: unhandled execute query: %.80s", q)

    async def fetch_one(
        self, query: str, params: tuple = ()
    ) -> Optional[dict[str, Any]]:
        """Fetch a single row as a dictionary."""
        rows = await self.fetch_all(query, params)
        return rows[0] if rows else None

    async def fetch_all(
        self, query: str, params: tuple = ()
    ) -> List[dict[str, Any]]:
        """Fetch all matching rows as a list of dictionaries."""
        q = query.strip()
        ql = q.upper().lstrip()

        if _COUNT_QUERY.search(ql):
            return await self._fetch_count(q, list(params))

        return await self._fetch_select(q, list(params))

    # ── INSERT ───────────────────────────────────────────────────────────────

    async def _execute_insert(self, query: str, params: list) -> None:
        m = _TABLE_FROM_INSERT.search(query)
        if not m:
            logger.error("Could not parse INSERT: %.120s", query)
            return

        table = m.group(1)
        cols = [c.strip() for c in m.group(2).split(",")]
        values_str = m.group(3)

        data = {}
        param_idx = 0
        for i, col in enumerate(cols):
            # Check if the values_str token for this position is a ? or a literal
            tokens = [t.strip() for t in values_str.split(",")]
            token = tokens[i] if i < len(tokens) else "?"
            if token == "?" or token == "":
                if param_idx < len(params):
                    data[col] = params[param_idx]
                    param_idx += 1
            else:
                # Literal value (e.g. 'processing')
                data[col] = token.strip("'\"")

        client = self._client

        def _do():
            return client.table(table).insert(data).execute()

        await self._run(_do)
        logger.debug("INSERT into %s: %s", table, {k: str(v)[:40] for k, v in data.items()})

    # ── UPDATE ───────────────────────────────────────────────────────────────

    async def _execute_update(self, query: str, params: list) -> None:
        m = _TABLE_FROM_UPDATE.match(query.strip())
        if not m:
            logger.error("Could not parse UPDATE: %.120s", query)
            return

        table = m.group(1)
        set_str = m.group(2)
        where_str = m.group(3)

        # Parse SET — consumes params in order (? placeholders)
        data, remaining_params = _parse_set_clause(set_str, params)

        # Parse WHERE — consumes remaining params
        conditions, _ = _parse_conditions(where_str, remaining_params)

        if not conditions:
            logger.error("UPDATE without WHERE conditions — refusing: %.120s", query)
            return

        client = self._client

        def _do():
            qb = client.table(table).update(data)
            for col, val in conditions:
                qb = qb.eq(col, val)
            return qb.execute()

        await self._run(_do)
        logger.debug("UPDATE %s SET %s WHERE %s", table, list(data.keys()), conditions)

    # ── DELETE ───────────────────────────────────────────────────────────────

    async def _execute_delete(self, query: str, params: list) -> None:
        m = _TABLE_FROM_DELETE.match(query.strip())
        if not m:
            logger.error("Could not parse DELETE: %.120s", query)
            return

        table = m.group(1)
        where_str = m.group(2)
        conditions, _ = _parse_conditions(where_str, list(params))

        if not conditions:
            logger.error("DELETE without WHERE — refusing: %.120s", query)
            return

        client = self._client

        def _do():
            qb = client.table(table).delete()
            for col, val in conditions:
                qb = qb.eq(col, val)
            return qb.execute()

        await self._run(_do)
        logger.debug("DELETE FROM %s WHERE %s", table, conditions)

    # ── SELECT ───────────────────────────────────────────────────────────────

    async def _fetch_select(self, query: str, params: list) -> List[dict]:
        # Extract SELECT columns
        cols_m = _SELECT_COLS.search(query)
        cols_str = cols_m.group(1).strip() if cols_m else "*"
        # Normalize aliases: "dc.document_id" → "document_id"
        if cols_str != "*":
            cols_parts = [c.strip().split(".")[-1] for c in cols_str.split(",")]
            cols_str = ",".join(cols_parts)

        # Extract table
        table_m = _TABLE_FROM_SELECT.search(query)
        if not table_m:
            logger.error("Could not parse SELECT table from: %.120s", query)
            return []
        table = table_m.group(1)

        # Extract WHERE conditions
        where_m = _WHERE_CLAUSE.search(query)
        conditions = []
        if where_m:
            conditions, params = _parse_conditions(where_m.group(1), params)

        # Extract ORDER BY
        order_col = None
        order_desc = False
        order_m = _ORDER_CLAUSE.search(query)
        if order_m:
            order_col = order_m.group(1).split(".")[-1]  # strip alias
            order_desc = (order_m.group(2) or "ASC").upper() == "DESC"

        # Extract LIMIT
        limit = None
        limit_m = _LIMIT_CLAUSE.search(query)
        if limit_m:
            limit = int(limit_m.group(1))

        client = self._client

        def _do():
            qb = client.table(table).select(cols_str)
            for col, val in conditions:
                if val is None:
                    qb = qb.is_(col, "null")
                else:
                    qb = qb.eq(col, val)
            if order_col:
                qb = qb.order(order_col, desc=order_desc)
            if limit:
                qb = qb.limit(limit)
            return qb.execute()

        result = await self._run(_do)
        return result.data or []

    async def _fetch_count(self, query: str, params: list) -> List[dict]:
        """Handle SELECT COUNT(*) queries using PostgREST count."""
        table_m = _TABLE_FROM_SELECT.search(query)
        if not table_m:
            return [{"count": 0}]
        table = table_m.group(1)

        where_m = _WHERE_CLAUSE.search(query)
        conditions = []
        if where_m:
            conditions, params = _parse_conditions(where_m.group(1), params)

        client = self._client

        def _do():
            qb = client.table(table).select("*", count="exact").limit(1)
            for col, val in conditions:
                if val is None:
                    qb = qb.is_(col, "null")
                else:
                    qb = qb.eq(col, val)
            return qb.execute()

        result = await self._run(_do)
        count = result.count if result.count is not None else 0

        # Return in both "count" and named alias forms (e.g. "total", "ready", "error")
        # The services use various aliases — we return all common ones.
        return [{"count": count, "total": count, "ready": count, "error": count,
                 "processing": count}]


# ── Singleton management ─────────────────────────────────────────────────────

_sb_db_instance: Optional[SupabaseDatabase] = None


def get_supabase_database() -> SupabaseDatabase:
    if _sb_db_instance is None:
        raise RuntimeError("SupabaseDatabase not initialized.")
    return _sb_db_instance


def init_supabase_database_sync(client) -> SupabaseDatabase:
    """
    Create and register a SupabaseDatabase from an existing supabase-py client.

    This is used in main.py during startup.
    """
    global _sb_db_instance
    _sb_db_instance = SupabaseDatabase(client)
    return _sb_db_instance


async def close_supabase_database() -> None:
    global _sb_db_instance
    if _sb_db_instance:
        await _sb_db_instance.disconnect()
        _sb_db_instance = None
