-- Migration: 026_rename_reimburse_foreign_keys.sql
-- Purpose: Rename bil_claim_submit_id to submit_claim_id in api_bil_claim_reimburse table
--          Note: Cannot use "claim_id" as it already exists (for OA claim ID string)
--          So we use "submit_claim_id" to clearly indicate it's the FK to submit table

-- Rename the foreign key column
ALTER TABLE api_bil_claim_reimburse
  RENAME COLUMN bil_claim_submit_id TO submit_claim_id;

-- Note: PostgreSQL automatically updates:
-- - All indexes
-- - All foreign key references (if any exist)
-- No need to manually recreate constraints
