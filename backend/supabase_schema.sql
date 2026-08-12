-- ─────────────────────────────────────────────────────────────────────────────
-- Auron Vehicle Intelligence Assistant — Supabase PostgreSQL Schema
--
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- Tables are created with IF NOT EXISTS so this is safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Documents metadata ────────────────────────────────────────────────────────
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

-- ── Document chunks (for ChromaDB reconstruction after restarts) ──────────────
CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Conversations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Messages within conversations ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    sources TEXT DEFAULT '[]',
    rating INTEGER DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);

-- ── Row Level Security (RLS) ──────────────────────────────────────────────────
-- Since we use the service role key on the backend only (not anon key),
-- RLS is not strictly required. But enabling it adds defense in depth.
-- The service role bypasses RLS automatically.
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Service role has full access (bypasses RLS):
-- No policy needed — service_role bypasses all RLS policies automatically.

SELECT 'Schema applied successfully' AS result;
