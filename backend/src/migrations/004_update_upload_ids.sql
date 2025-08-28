-- Migration to update upload IDs from UUID to readable format
-- This will preserve existing data while changing the ID format

BEGIN;

-- First, create new columns with the readable format
ALTER TABLE rcm_uploads ADD COLUMN IF NOT EXISTS new_id VARCHAR(50);
ALTER TABLE rcm_upload_claim_links ADD COLUMN IF NOT EXISTS new_upload_id VARCHAR(50);

-- Update existing records with readable IDs based on their upload date and filename
UPDATE rcm_uploads 
SET new_id = 
  TO_CHAR(uploaded_at, 'YYYYMMDD-HH24MI') || '-' || 
  UPPER(SUBSTRING(MD5(id::text), 1, 6)) || '-' || 
  UPPER(REGEXP_REPLACE(SUBSTRING(SPLIT_PART(filename, '.', 1), 1, 10), '[^A-Za-z0-9]', '', 'g'))
WHERE new_id IS NULL;

-- Update the links table
UPDATE rcm_upload_claim_links 
SET new_upload_id = (
  SELECT new_id FROM rcm_uploads WHERE rcm_uploads.id = rcm_upload_claim_links.upload_id
);

-- Drop old constraints and create new ones
ALTER TABLE rcm_upload_claim_links DROP CONSTRAINT IF EXISTS rcm_upload_claim_links_pkey;
ALTER TABLE rcm_uploads DROP CONSTRAINT IF EXISTS rcm_uploads_pkey;

-- Drop old columns and rename new ones
ALTER TABLE rcm_uploads DROP COLUMN id;
ALTER TABLE rcm_uploads RENAME COLUMN new_id TO id;
ALTER TABLE rcm_uploads ADD PRIMARY KEY (id);

ALTER TABLE rcm_upload_claim_links DROP COLUMN upload_id;
ALTER TABLE rcm_upload_claim_links RENAME COLUMN new_upload_id TO upload_id;
ALTER TABLE rcm_upload_claim_links ADD PRIMARY KEY (upload_id, submit_id);

COMMIT;
