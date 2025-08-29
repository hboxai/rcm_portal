-- Add content hash for idempotency if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='api_bil_claim_submit'
      AND column_name='content_sha256'
  ) THEN
    ALTER TABLE api_bil_claim_submit ADD COLUMN content_sha256 text;
  END IF;
END $$;

-- Optional supporting index
CREATE INDEX IF NOT EXISTS idx_submit_upload_content_hash
  ON api_bil_claim_submit (upload_id, content_sha256);
