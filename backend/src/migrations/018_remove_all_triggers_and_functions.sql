-- Migration: 018_remove_all_triggers_and_functions.sql
-- Purpose: Ensure the database does not use custom triggers or functions.
-- Strategy: Idempotently drop all non-internal triggers in public schema and
--           drop plpgsql functions prefixed with 'trg_' (including prior touch helpers).

-- 1) Explicitly drop known helper functions if they exist (covers prior migrations)
DROP FUNCTION IF EXISTS trg_touch_updated_at() CASCADE;
DROP FUNCTION IF EXISTS trg_touch_updated_at_auth() CASCADE;

-- 2) Drop all non-internal triggers in public schema (idempotent, table-agnostic)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, t.tgname AS trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', r.trigger_name, r.schema_name, r.table_name);
  END LOOP;
END $$;

-- 3) Drop any remaining plpgsql functions that look like trigger helpers (name starts with 'trg_')
DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN
    SELECT n.nspname AS schema_name,
           p.proname AS func_name,
           pg_catalog.oidvectortypes(p.proargtypes) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
      AND l.lanname = 'plpgsql'
      AND p.proname LIKE 'trg_%'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', f.schema_name, f.func_name, f.args);
  END LOOP;
END $$;

-- Note: With triggers removed, columns like updated_at will no longer be auto-touched by the DB.
--       The application layer should set updated_at = NOW() explicitly in UPDATE statements where needed.
