-- =============================================================================
-- Auron — Database Migration v2: User Accounts & Data Isolation
-- =============================================================================
-- Run this script in the Supabase SQL Editor:
--   Supabase Dashboard → SQL Editor → New Query → paste & Run
--
-- This migration is SAFE to run on an existing database:
--   - Uses ADD COLUMN IF NOT EXISTS (non-destructive)
--   - Existing rows get user_id = NULL (handled gracefully by the backend)
--   - All CREATE TABLE / POLICY statements use IF NOT EXISTS
-- =============================================================================


-- ── Step 1: Add user_id to documents table ───────────────────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── Step 2: Add user_id to conversations table ───────────────────────────────
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── Step 3: Performance indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_documents_user_id
  ON documents(user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id
  ON conversations(user_id);

-- Composite indexes for the most common query pattern (user + status)
CREATE INDEX IF NOT EXISTS idx_documents_user_status
  ON documents(user_id, status);

CREATE INDEX IF NOT EXISTS idx_conversations_user_updated
  ON conversations(user_id, updated_at DESC);

-- ── Step 4: Profiles table (minimal — stores email for display) ──────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Users manage own profile'
  ) THEN
    CREATE POLICY "Users manage own profile"
      ON profiles FOR ALL
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- ── Step 5: Auto-create profile on signup (trigger) ──────────────────────────
-- Creates a profiles row automatically when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if present, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── Step 6: RLS on documents (defense in depth) ──────────────────────────────
-- NOTE: The backend uses the service role key which bypasses RLS.
-- These policies are an extra safety layer for any direct Supabase client queries.
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents' AND policyname = 'Users see own documents'
  ) THEN
    CREATE POLICY "Users see own documents"
      ON documents FOR SELECT
      USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents' AND policyname = 'Users insert own documents'
  ) THEN
    CREATE POLICY "Users insert own documents"
      ON documents FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents' AND policyname = 'Users delete own documents'
  ) THEN
    CREATE POLICY "Users delete own documents"
      ON documents FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents' AND policyname = 'Users update own documents'
  ) THEN
    CREATE POLICY "Users update own documents"
      ON documents FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;


-- ── Step 7: RLS on conversations ─────────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'conversations' AND policyname = 'Users see own conversations'
  ) THEN
    CREATE POLICY "Users see own conversations"
      ON conversations FOR SELECT
      USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'conversations' AND policyname = 'Users insert own conversations'
  ) THEN
    CREATE POLICY "Users insert own conversations"
      ON conversations FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'conversations' AND policyname = 'Users delete own conversations'
  ) THEN
    CREATE POLICY "Users delete own conversations"
      ON conversations FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'conversations' AND policyname = 'Users update own conversations'
  ) THEN
    CREATE POLICY "Users update own conversations"
      ON conversations FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;


-- ── Step 8: Verify migration ──────────────────────────────────────────────────
-- Run these SELECT statements to confirm the migration completed successfully:

-- Check user_id column was added to documents:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'documents' AND column_name = 'user_id';

-- Check user_id column was added to conversations:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'conversations' AND column_name = 'user_id';

-- Check profiles table exists:
-- SELECT * FROM profiles LIMIT 5;

-- Check indexes were created:
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('documents', 'conversations');

-- =============================================================================
-- Migration complete.
-- Next steps:
--   1. Get your JWT Secret: Auth → Signing Keys → copy the JWT Secret value
--   2. Add SUPABASE_JWT_SECRET to your backend environment variables (Render)
--   3. Get your Anon Key: Settings → API → anon public key
--   4. Add VITE_SUPABASE_ANON_KEY to your frontend environment variables
--   5. Enable Email auth: Auth → Providers → Email → Enable
-- =============================================================================
