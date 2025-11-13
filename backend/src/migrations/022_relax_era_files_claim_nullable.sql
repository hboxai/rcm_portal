-- Migration: 022_relax_era_files_claim_nullable.sql
-- Purpose: Allow global ERA PDF uploads not tied to a single claim

ALTER TABLE IF EXISTS era_files
  ALTER COLUMN claim_id DROP NOT NULL;
