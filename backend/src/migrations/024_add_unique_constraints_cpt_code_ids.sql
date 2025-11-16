-- Migration: 024_add_unique_constraints_cpt_code_ids.sql
-- Purpose: Add unique constraints on cpt_code_id1 through cpt_code_id6
--          Ensures globally unique CPT Code IDs and enables safe UPDATE operations

-- Add unique constraint on cpt_code_id1
ALTER TABLE api_bil_claim_submit
  ADD CONSTRAINT uq_cpt_code_id1 UNIQUE (cpt_code_id1);

-- Add unique constraint on cpt_code_id2
ALTER TABLE api_bil_claim_submit
  ADD CONSTRAINT uq_cpt_code_id2 UNIQUE (cpt_code_id2);

-- Add unique constraint on cpt_code_id3
ALTER TABLE api_bil_claim_submit
  ADD CONSTRAINT uq_cpt_code_id3 UNIQUE (cpt_code_id3);

-- Add unique constraint on cpt_code_id4
ALTER TABLE api_bil_claim_submit
  ADD CONSTRAINT uq_cpt_code_id4 UNIQUE (cpt_code_id4);

-- Add unique constraint on cpt_code_id5
ALTER TABLE api_bil_claim_submit
  ADD CONSTRAINT uq_cpt_code_id5 UNIQUE (cpt_code_id5);

-- Add unique constraint on cpt_code_id6
ALTER TABLE api_bil_claim_submit
  ADD CONSTRAINT uq_cpt_code_id6 UNIQUE (cpt_code_id6);

-- Create indexes for faster lookups (unique constraints automatically create indexes)
-- These constraints will:
-- 1. Prevent duplicate CPT Code IDs in the system
-- 2. Enable efficient duplicate detection during upload
-- 3. Ensure safe UPDATE operations (one CPT Code ID = one claim)
