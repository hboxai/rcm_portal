-- Migration: 016_add_submit_cycles.sql
-- Purpose: Track claim-level and per-line cycles in submit table for fast reads

ALTER TABLE public.api_bil_claim_submit
  ADD COLUMN IF NOT EXISTS cycle integer DEFAULT 1;

-- Per-line tracking columns
DO $$
BEGIN
  FOR i IN 1..6 LOOP
    EXECUTE format('ALTER TABLE public.api_bil_claim_submit ADD COLUMN IF NOT EXISTS cpt_cycle%s integer DEFAULT 1;', i);
    EXECUTE format('ALTER TABLE public.api_bil_claim_submit ADD COLUMN IF NOT EXISTS cpt_hash%s text;', i);
    EXECUTE format('ALTER TABLE public.api_bil_claim_submit ADD COLUMN IF NOT EXISTS cpt_updated_at%s timestamptz;', i);
  END LOOP;
END$$;

-- Optional simple index to query by highest cycle quickly (cheap)
CREATE INDEX IF NOT EXISTS idx_submit_cycle ON public.api_bil_claim_submit (cycle);
