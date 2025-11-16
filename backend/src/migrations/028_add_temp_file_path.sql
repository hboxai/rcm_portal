-- Migration 028: Add temp_file_path column and make s3_url nullable
-- This allows storing files temporarily during preview before S3 upload

-- Add temp_file_path column to store local temporary file path
ALTER TABLE rcm_file_uploads 
ADD COLUMN temp_file_path VARCHAR(500);

-- Make s3_url nullable since it won't exist until commit
ALTER TABLE rcm_file_uploads 
ALTER COLUMN s3_url DROP NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN rcm_file_uploads.temp_file_path IS 'Temporary local file path during preview phase, before S3 upload';
COMMENT ON COLUMN rcm_file_uploads.s3_url IS 'S3 URL after commit, nullable during preview phase';
