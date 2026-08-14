-- =============================================================================
-- Auron — Database Migration v3 (revised): Lean user_preferences schema
-- =============================================================================
-- Run this in the Supabase SQL Editor:
--   Dashboard → SQL Editor → New Query → paste & Run
--
-- Safe to run on a fresh database OR on top of a previous v3 run.
-- Uses IF NOT EXISTS / DO $$ guards throughout — no data is lost.
-- =============================================================================


-- ── Step 1: Extend profiles with display_name ─────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;


-- ── Step 2: Create user_preferences (lean schema) ────────────────────────────
-- One row per user (UPSERT on user_id).
-- Only stores what the Settings page actually uses.
CREATE TABLE IF NOT EXISTS user_preferences (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Vehicle
  vehicle_make         TEXT,
  vehicle_model        TEXT,
  vehicle_variant      TEXT,
  vehicle_year         INTEGER,
  fuel_type            TEXT,           -- Petrol | Diesel | Electric | Hybrid | CNG
  transmission         TEXT,           -- Manual | Automatic | AMT | CVT | DCT
  driving_preference   TEXT,           -- Economy | Balanced | Performance

  -- AI
  response_style       TEXT DEFAULT 'balanced',   -- concise | balanced | detailed

  -- Notifications (single master toggle)
  notification_enabled BOOLEAN DEFAULT TRUE,

  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);


-- ── Step 3: Add any missing columns to existing table ────────────────────────
-- (No-op if table was just created above; safe if table already existed.)
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS vehicle_make         TEXT;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS vehicle_model        TEXT;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS vehicle_variant      TEXT;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS vehicle_year         INTEGER;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS fuel_type            TEXT;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS transmission         TEXT;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS driving_preference   TEXT;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS response_style       TEXT DEFAULT 'balanced';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT TRUE;


-- ── Step 4: RLS ───────────────────────────────────────────────────────────────
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_preferences'
      AND policyname = 'Users manage own preferences'
  ) THEN
    CREATE POLICY "Users manage own preferences"
      ON user_preferences
      FOR ALL
      USING     (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ── Step 5: auto-update updated_at ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER set_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── Step 6: NOTE — obsolete columns ──────────────────────────────────────────
-- The following columns were defined in an earlier draft but are NOT used
-- by the current Settings page. If you ran the earlier migration and want
-- to clean up, run these manually AFTER verifying no other code references them:
--
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS remember_vehicle;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS personalize_ai;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS safety_warnings;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS maintenance_suggestions;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS fuel_efficiency_tips;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS notif_maintenance;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS notif_insurance;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS notif_puc;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS notif_service;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS notif_alerts;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS notif_ai_recs;
--   ALTER TABLE user_preferences DROP COLUMN IF EXISTS notif_email;
--
-- They are left as commented DROP statements to avoid accidental data loss.
-- Extra columns cause no functional problems — Supabase just ignores unknown
-- fields when the frontend only SELECTs / UPSERTs what it knows about.
-- =============================================================================
-- Migration complete.
-- =============================================================================
