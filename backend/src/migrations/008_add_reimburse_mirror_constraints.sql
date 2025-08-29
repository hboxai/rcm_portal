-- Migration: 008_add_reimburse_mirror_constraints.sql
-- Purpose: Ensure 1:1 guard and FKs for api_bil_claim_reimburse mirroring.

-- 1) Unique index on (bil_claim_submit_id) if none exists already
DO $$
DECLARE
  has_cycle_idx BOOLEAN;
  has_simple_idx BOOLEAN;
BEGIN
  SELECT (to_regclass('public.uq_reimburse_claim_cycle') IS NOT NULL) INTO has_cycle_idx;
  SELECT (to_regclass('public.uq_reimburse_claim') IS NOT NULL) INTO has_simple_idx;

  IF NOT has_cycle_idx AND NOT has_simple_idx AND to_regclass('public.uq_reimburse_submit') IS NULL THEN
    EXECUTE 'CREATE UNIQUE INDEX uq_reimburse_submit ON api_bil_claim_reimburse (bil_claim_submit_id)';
  END IF;
END$$;

-- 2) FKs with tolerant naming (skip if any equivalent FK exists)
DO $$
DECLARE
  has_fk_submit BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE t.relname = 'api_bil_claim_reimburse'
      AND a.attname = 'bil_claim_submit_id'
      AND c.contype = 'f'
  ) INTO has_fk_submit;

  IF NOT has_fk_submit THEN
    ALTER TABLE api_bil_claim_reimburse
      ADD CONSTRAINT fk_reimb_submit
        FOREIGN KEY (bil_claim_submit_id)
        REFERENCES api_bil_claim_submit(bil_claim_submit_id)
        ON DELETE CASCADE;
  END IF;
END$$;

DO $$
DECLARE
  has_fk_upload BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE t.relname = 'api_bil_claim_reimburse'
      AND a.attname = 'upload_id'
      AND c.contype = 'f'
  ) INTO has_fk_upload;

  IF NOT has_fk_upload THEN
    ALTER TABLE api_bil_claim_reimburse
      ADD CONSTRAINT fk_reimb_upload
        FOREIGN KEY (upload_id)
        REFERENCES rcm_file_uploads(upload_id);
  END IF;
END$$;
