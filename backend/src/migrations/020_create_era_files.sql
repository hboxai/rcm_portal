-- Migration: 020_create_era_files.sql
-- Purpose: Store ERA (Remittance Advice) PDF metadata linked to claims and S3

CREATE TABLE IF NOT EXISTS era_files (
  id               BIGSERIAL PRIMARY KEY,
  claim_id         BIGINT NOT NULL,               -- links to api_bil_claim_reimburse.bil_claim_reimburse_id
  original_filename TEXT NOT NULL,
  content_type     TEXT DEFAULT 'application/pdf',
  size_bytes       BIGINT,
  s3_bucket        TEXT,
  s3_key           TEXT,
  s3_url           TEXT,
  uploaded_by      TEXT,                          -- username
  uploaded_by_id   BIGINT,                        -- optional user id
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  virus_scan_status TEXT,                         -- optional AV status (e.g., CLEAN/INFECTED/SKIPPED)
  virus_scan_log    TEXT
);

CREATE INDEX IF NOT EXISTS idx_era_files_claim_id ON era_files (claim_id);
CREATE INDEX IF NOT EXISTS idx_era_files_uploaded_at ON era_files (uploaded_at DESC);
