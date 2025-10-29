-- Migration: 015_add_reimburse_submit_cpt_id.sql
-- Purpose: Add a mapping column on reimburse rows to carry submit CPT line IDs for 1:1 linking

ALTER TABLE public.api_bil_claim_reimburse
  ADD COLUMN IF NOT EXISTS submit_cpt_id text;

CREATE INDEX IF NOT EXISTS idx_reimburse_submit_cpt_id
  ON public.api_bil_claim_reimburse (submit_cpt_id);
