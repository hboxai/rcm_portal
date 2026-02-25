-- Migration: 031_drop_cpt_columns.sql
-- Purpose: Remove deprecated cpt1-6 columns from api_bil_claim_submit table
-- Note: Excel CPT1-6 headers now map directly to cpt_code_id1-6
-- Date: 2026-02-25

-- Drop indexes that reference cpt1 (if they exist)
DROP INDEX IF EXISTS idx_submit_match_key;
DROP INDEX IF EXISTS idx_submit_composite_business;

-- Drop cpt1-6 columns from api_bil_claim_submit
ALTER TABLE api_bil_claim_submit
  DROP COLUMN IF EXISTS cpt1,
  DROP COLUMN IF EXISTS cpt2,
  DROP COLUMN IF EXISTS cpt3,
  DROP COLUMN IF EXISTS cpt4,
  DROP COLUMN IF EXISTS cpt5,
  DROP COLUMN IF EXISTS cpt6;

-- Recreate composite business index using cpt_code_id1 instead of cpt1
CREATE INDEX IF NOT EXISTS idx_submit_composite_business
  ON api_bil_claim_submit (clinic_id, insurerid, fromdateofservice1, cpt_code_id1, totalcharges);

-- Add comment documenting the change
COMMENT ON TABLE api_bil_claim_submit IS 'Submit claims table. Excel CPT1-6 columns map to cpt_code_id1-6. Legacy cpt1-6 columns removed in migration 031.';
