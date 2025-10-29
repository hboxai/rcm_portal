-- Migration: 014_add_submit_cpt_id_columns.sql
-- Purpose: Add nullable CPT ID columns (cpt_id1..cpt_id6) to submit table for downstream usage.

-- Idempotent ALTERs to avoid failures if rerun
ALTER TABLE public.api_bil_claim_submit ADD COLUMN IF NOT EXISTS cpt_id1 text;
ALTER TABLE public.api_bil_claim_submit ADD COLUMN IF NOT EXISTS cpt_id2 text;
ALTER TABLE public.api_bil_claim_submit ADD COLUMN IF NOT EXISTS cpt_id3 text;
ALTER TABLE public.api_bil_claim_submit ADD COLUMN IF NOT EXISTS cpt_id4 text;
ALTER TABLE public.api_bil_claim_submit ADD COLUMN IF NOT EXISTS cpt_id5 text;
ALTER TABLE public.api_bil_claim_submit ADD COLUMN IF NOT EXISTS cpt_id6 text;

-- Optional indexes can be added later if query patterns require
-- Example:
-- CREATE INDEX IF NOT EXISTS idx_submit_cpt_id1 ON public.api_bil_claim_submit (cpt_id1);
