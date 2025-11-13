-- Migration: 019_create_upl_change_logs.sql
-- Purpose: Create change logs table for tracking field changes to claims and add payer_process_date to submit table

-- Create change logs table
CREATE TABLE IF NOT EXISTS upl_change_logs (
  id BIGSERIAL PRIMARY KEY,
  claim_id BIGINT NOT NULL,
  user_id BIGINT NULL,
  username TEXT NOT NULL,
  billing_id BIGINT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  field_name TEXT NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  source TEXT DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'OFFICE_ALLY', 'SYSTEM'))
);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_change_logs_claim_id ON upl_change_logs(claim_id);
CREATE INDEX IF NOT EXISTS idx_change_logs_timestamp ON upl_change_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_change_logs_field_name ON upl_change_logs(field_name);

-- Add payer_process_date to submit table for tracking when payer processed the claim
ALTER TABLE api_bil_claim_submit
  ADD COLUMN IF NOT EXISTS payer_process_date TIMESTAMPTZ NULL;

-- Add index for payer_process_date
CREATE INDEX IF NOT EXISTS idx_submit_payer_process_date
  ON api_bil_claim_submit(payer_process_date);
