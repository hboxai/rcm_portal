-- Migration: 013_drop_triggers_and_functions.sql
-- Purpose: Ensure production does not rely on database triggers or custom functions.
-- Drops touch triggers and their functions if they exist. Idempotent.

-- Drop triggers safely (if exist)
DO $$
BEGIN
  IF to_regclass('public.api_bil_claim_reimburse') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_touch_api_bil_claim_reimburse ON api_bil_claim_reimburse';
  END IF;
  IF to_regclass('public.rcm_file_uploads') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_touch_rcm_file_uploads ON rcm_file_uploads';
  END IF;
  IF to_regclass('public.rcm_portal_auth_users') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_touch_rcm_portal_auth_users ON rcm_portal_auth_users';
  END IF;
  IF to_regclass('public.rcm_portal_users') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_touch_rcm_portal_users ON rcm_portal_users';
  END IF;
END$$;

-- Drop functions safely (if exist). Some migrations defined common names; remove both variants.
DROP FUNCTION IF EXISTS trg_touch_updated_at() CASCADE;
DROP FUNCTION IF EXISTS trg_touch_updated_at_auth() CASCADE;
