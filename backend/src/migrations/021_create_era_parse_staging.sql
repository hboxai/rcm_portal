-- Migration: 021_create_era_parse_staging.sql
-- Purpose: Staging tables for parsed ERA data (pending user review before commit)

-- Batch-level metadata
CREATE TABLE IF NOT EXISTS era_parse_batches (
  batch_id          BIGSERIAL PRIMARY KEY,
  era_file_id       BIGINT NOT NULL REFERENCES era_files(id) ON DELETE CASCADE,
  claim_id          BIGINT NULL, -- optional parent claim association
  created_by        TEXT,
  created_by_id     BIGINT,
  status            TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','REVIEWED','COMMITTED','FAILED')),
  source_format     TEXT,           -- e.g., 'excel', 'csv', 'json'
  total_rows        INT DEFAULT 0,
  parsed_rows       INT DEFAULT 0,
  warnings          TEXT,
  started_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_era_parse_batches_file ON era_parse_batches (era_file_id);
CREATE INDEX IF NOT EXISTS idx_era_parse_batches_status ON era_parse_batches (status);

-- Row-level staging of parsed values, before commit to reimburse claims
CREATE TABLE IF NOT EXISTS era_parse_rows (
  row_id            BIGSERIAL PRIMARY KEY,
  batch_id          BIGINT NOT NULL REFERENCES era_parse_batches(batch_id) ON DELETE CASCADE,
  -- Matching keys (any subset may be present)
  submit_cpt_id     TEXT NULL,
  billing_id        BIGINT NULL,
  patient_id        TEXT NULL,
  cpt_code          TEXT NULL,
  dos               DATE NULL,
  -- Extracted fields
  prim_amt          NUMERIC(12,2) NULL,
  prim_chk_det      TEXT NULL,
  prim_recv_dt      DATE NULL,
  prim_denial_code  TEXT NULL,
  sec_amt           NUMERIC(12,2) NULL,
  sec_chk_det       TEXT NULL,
  sec_recv_dt       DATE NULL,
  sec_denial_code   TEXT NULL,
  pat_amt           NUMERIC(12,2) NULL,
  pat_recv_dt       DATE NULL,
  allowed_amt       NUMERIC(12,2) NULL,
  write_off_amt     NUMERIC(12,2) NULL,
  claim_status      TEXT NULL,
  -- Raw captured record and proposed update payload for audit/debug
  raw_json          JSONB,
  proposed_updates  JSONB,
  -- Review flags
  reviewed          BOOLEAN DEFAULT FALSE,
  reviewer          TEXT,
  reviewed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_era_parse_rows_batch ON era_parse_rows (batch_id);
CREATE INDEX IF NOT EXISTS idx_era_parse_rows_match ON era_parse_rows (submit_cpt_id, billing_id, patient_id, cpt_code, dos);
