-- Migration: 009_reimburse_unique_per_cpt.sql
-- Replace 1:1 unique index with per-line uniqueness on (bil_claim_submit_id, cpt_id, charge_dt)

DO $$
BEGIN
  IF to_regclass('public.uq_reimburse_claim') IS NOT NULL THEN
    EXECUTE 'DROP INDEX public.uq_reimburse_claim';
  END IF;
  IF to_regclass('public.uq_reimburse_submit') IS NOT NULL THEN
    EXECUTE 'DROP INDEX public.uq_reimburse_submit';
  END IF;
END$$;

-- Create composite unique index for natural key
DO $$
BEGIN
  IF to_regclass('public.uq_reimburse_submit_cpt_date') IS NULL THEN
    EXECUTE 'CREATE UNIQUE INDEX uq_reimburse_submit_cpt_date ON api_bil_claim_reimburse (bil_claim_submit_id, cpt_id, charge_dt)';
  END IF;
END$$;
