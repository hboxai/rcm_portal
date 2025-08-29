-- Migration: 006_add_submit_system_columns.sql
-- Purpose: Add system-level columns to api_bil_claim_submit for upload linkage, OA outcome, multi-source, and audit timestamp.

-- Add cross-cutting system columns
ALTER TABLE api_bil_claim_submit
  ADD COLUMN IF NOT EXISTS upload_id uuid,
  ADD COLUMN IF NOT EXISTS source_system text DEFAULT 'OFFICE_ALLY',
  ADD COLUMN IF NOT EXISTS office_ally_status text,
  ADD COLUMN IF NOT EXISTS office_ally_status_reason text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Add foreign key to uploads audit table
ALTER TABLE api_bil_claim_submit
  ADD CONSTRAINT fk_submit_upload
    FOREIGN KEY (upload_id)
    REFERENCES rcm_file_uploads(upload_id);

-- Indexes to speed up filtering in UI
CREATE INDEX IF NOT EXISTS idx_submit_upload
  ON api_bil_claim_submit(upload_id);

CREATE INDEX IF NOT EXISTS idx_submit_oa_status
  ON api_bil_claim_submit(office_ally_status);
