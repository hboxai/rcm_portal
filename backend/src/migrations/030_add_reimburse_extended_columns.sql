-- Migration 030: Add extended columns to api_bil_claim_reimburse
-- Purpose: Support complete reimburse file data with patient info, service details, and payment tracking

-- Add patient demographic columns
ALTER TABLE api_bil_claim_reimburse
  ADD COLUMN IF NOT EXISTS patient_emr_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Add service/CPT details
ALTER TABLE api_bil_claim_reimburse
  ADD COLUMN IF NOT EXISTS cpt_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS service_start DATE,
  ADD COLUMN IF NOT EXISTS service_end DATE,
  ADD COLUMN IF NOT EXISTS icd_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS units INTEGER,
  ADD COLUMN IF NOT EXISTS provider_name VARCHAR(255);

-- Add claim identifiers
ALTER TABLE api_bil_claim_reimburse
  ADD COLUMN IF NOT EXISTS oa_claim_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS oa_visit_id VARCHAR(100);

-- Add financial columns - allowed amounts
ALTER TABLE api_bil_claim_reimburse
  ADD COLUMN IF NOT EXISTS allowed_amt NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS allowed_add_amt NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS allowed_exp_amt NUMERIC(12,2);

-- Add primary insurance payment tracking
ALTER TABLE api_bil_claim_reimburse
  ADD COLUMN IF NOT EXISTS prim_amt NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS prim_post_dt DATE,
  ADD COLUMN IF NOT EXISTS prim_chk_det VARCHAR(255),
  ADD COLUMN IF NOT EXISTS prim_recv_dt DATE,
  ADD COLUMN IF NOT EXISTS prim_chk_amt NUMERIC(12,2);

-- Add secondary insurance payment tracking
ALTER TABLE api_bil_claim_reimburse
  ADD COLUMN IF NOT EXISTS sec_ins VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sec_amt NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS sec_post_dt DATE,
  ADD COLUMN IF NOT EXISTS sec_chk_det VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sec_recv_dt DATE,
  ADD COLUMN IF NOT EXISTS sec_chk_amt NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS sec_cmt TEXT;

-- Add patient payment tracking
ALTER TABLE api_bil_claim_reimburse
  ADD COLUMN IF NOT EXISTS pat_amt NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS pat_recv_dt DATE;

-- Add summary financial columns
ALTER TABLE api_bil_claim_reimburse
  ADD COLUMN IF NOT EXISTS total_amt NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS write_off_amt NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS charges_adj_amt NUMERIC(12,2);

-- Add reimbursement metrics
ALTER TABLE api_bil_claim_reimburse
  ADD COLUMN IF NOT EXISTS reimb_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS status VARCHAR(50);

-- Create indexes for commonly queried columns
CREATE INDEX IF NOT EXISTS idx_reimburse_patient_emr_no ON api_bil_claim_reimburse(patient_emr_no);
CREATE INDEX IF NOT EXISTS idx_reimburse_oa_claim_id ON api_bil_claim_reimburse(oa_claim_id);
CREATE INDEX IF NOT EXISTS idx_reimburse_service_start ON api_bil_claim_reimburse(service_start);
CREATE INDEX IF NOT EXISTS idx_reimburse_status ON api_bil_claim_reimburse(status);

-- Add comments for documentation
COMMENT ON COLUMN api_bil_claim_reimburse.patient_emr_no IS 'Patient EMR/Medical Record Number';
COMMENT ON COLUMN api_bil_claim_reimburse.cpt_code IS 'CPT procedure code';
COMMENT ON COLUMN api_bil_claim_reimburse.service_start IS 'Service start date';
COMMENT ON COLUMN api_bil_claim_reimburse.service_end IS 'Service end date';
COMMENT ON COLUMN api_bil_claim_reimburse.allowed_amt IS 'Insurance allowed amount';
COMMENT ON COLUMN api_bil_claim_reimburse.prim_amt IS 'Primary insurance payment amount';
COMMENT ON COLUMN api_bil_claim_reimburse.sec_amt IS 'Secondary insurance payment amount';
COMMENT ON COLUMN api_bil_claim_reimburse.pat_amt IS 'Patient responsibility amount';
COMMENT ON COLUMN api_bil_claim_reimburse.total_amt IS 'Total payment received';
COMMENT ON COLUMN api_bil_claim_reimburse.write_off_amt IS 'Write-off/adjustment amount';
COMMENT ON COLUMN api_bil_claim_reimburse.reimb_pct IS 'Reimbursement percentage';
COMMENT ON COLUMN api_bil_claim_reimburse.status IS 'Current claim status';
