-- Migration: 008_widen_submit_ids_to_bigint.sql
-- Purpose: Prevent integer overflow for large identifier values coming from Excel (e.g., PatientID)
-- Safely widen select integer columns on api_bil_claim_submit to BIGINT.

DO $$
BEGIN
  -- patient_id -> BIGINT if currently INTEGER
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='api_bil_claim_submit'
      AND column_name='patient_id' AND data_type='integer'
  ) THEN
    ALTER TABLE api_bil_claim_submit
      ALTER COLUMN patient_id TYPE BIGINT USING patient_id::bigint;
  END IF;

  -- clinic_id -> BIGINT if currently INTEGER (defensive)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='api_bil_claim_submit'
      AND column_name='clinic_id' AND data_type='integer'
  ) THEN
    ALTER TABLE api_bil_claim_submit
      ALTER COLUMN clinic_id TYPE BIGINT USING clinic_id::bigint;
  END IF;
END $$;
