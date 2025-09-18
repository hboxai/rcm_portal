-- Migration: 012_add_perf_indexes.sql
-- Add helpful indexes for frequent lookups and joins

-- Reimburse table indexes
CREATE INDEX IF NOT EXISTS idx_reimburse_upload_id
  ON api_bil_claim_reimburse (upload_id);

CREATE INDEX IF NOT EXISTS idx_reimburse_submit_id
  ON api_bil_claim_reimburse (bil_claim_submit_id);

CREATE INDEX IF NOT EXISTS idx_reimburse_patient_id
  ON api_bil_claim_reimburse (patient_id);

CREATE INDEX IF NOT EXISTS idx_reimburse_cpt_id
  ON api_bil_claim_reimburse (cpt_id);

CREATE INDEX IF NOT EXISTS idx_reimburse_charge_dt
  ON api_bil_claim_reimburse (charge_dt);

-- Submit table indexes for idempotency and lookups
CREATE INDEX IF NOT EXISTS idx_submit_payor_reference_id
  ON api_bil_claim_submit (payor_reference_id);

CREATE INDEX IF NOT EXISTS idx_submit_oa_claimid
  ON api_bil_claim_submit (oa_claimid);

-- Composite index to support composite business key fallback in findExistingSubmit
CREATE INDEX IF NOT EXISTS idx_submit_composite_business
  ON api_bil_claim_submit (clinic_id, insurerid, fromdateofservice1, cpt1, totalcharges);
