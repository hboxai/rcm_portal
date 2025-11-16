-- Migration: 027_fix_audit_claim_id.sql
-- Purpose: Rename bil_claim_submit_id to claim_id in rcm_submit_line_audit

-- Rename column
ALTER TABLE public.rcm_submit_line_audit 
  RENAME COLUMN bil_claim_submit_id TO claim_id;

-- Drop old index
DROP INDEX IF EXISTS idx_rcm_submit_line_audit_submit;

-- Create new index with correct column name
CREATE INDEX IF NOT EXISTS idx_rcm_submit_line_audit_claim 
  ON public.rcm_submit_line_audit (claim_id, changed_at DESC);
