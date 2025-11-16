-- Migration: 023_rename_primary_key_to_claim_id.sql
-- Purpose: Rename primary key column bil_claim_submit_id to claim_id for better clarity

-- Rename the primary key column
ALTER TABLE api_bil_claim_submit
  RENAME COLUMN bil_claim_submit_id TO claim_id;

-- Note: PostgreSQL automatically updates:
-- - The primary key constraint
-- - All indexes
-- - All foreign key references
-- No need to manually recreate constraints
