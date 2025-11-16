-- Migration: 025_modify_upl_change_logs.sql
-- Purpose: Refactor upl_change_logs table for cleaner audit trail
--          1. Rename id → change_log_id
--          2. Add upload_id to track which file caused changes
--          3. Remove user_id (redundant with username)
--          4. Remove billing_id (redundant with claim_id)

-- Step 1: Rename primary key column
ALTER TABLE upl_change_logs
  RENAME COLUMN id TO change_log_id;

-- Step 2: Add upload_id with foreign key to rcm_file_uploads
ALTER TABLE upl_change_logs
  ADD COLUMN upload_id UUID NULL;

-- Add foreign key constraint
ALTER TABLE upl_change_logs
  ADD CONSTRAINT fk_change_logs_upload
    FOREIGN KEY (upload_id)
    REFERENCES rcm_file_uploads(upload_id);

-- Step 3: Drop redundant user_id column
ALTER TABLE upl_change_logs
  DROP COLUMN IF EXISTS user_id;

-- Step 4: Drop redundant billing_id column
ALTER TABLE upl_change_logs
  DROP COLUMN IF EXISTS billing_id;

-- Step 5: Update indexes
-- Add index on upload_id for faster filtering
CREATE INDEX IF NOT EXISTS idx_change_logs_upload_id
  ON upl_change_logs(upload_id);

-- Verify existing indexes are still present:
-- idx_change_logs_claim_id
-- idx_change_logs_timestamp
-- idx_change_logs_field_name

COMMENT ON COLUMN upl_change_logs.change_log_id IS 'Primary key for change log entries';
COMMENT ON COLUMN upl_change_logs.upload_id IS 'Links to the file upload that caused this change';
COMMENT ON COLUMN upl_change_logs.username IS 'Name of user or SYSTEM for automated changes';
