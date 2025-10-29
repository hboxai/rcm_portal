-- Migration: 017_create_submit_line_audit.sql
-- Purpose: Full change history per submit service line (by submit_cpt_id)

CREATE TABLE IF NOT EXISTS public.rcm_submit_line_audit (
  id bigserial PRIMARY KEY,
  submit_cpt_id text NOT NULL,
  bil_claim_submit_id bigint NOT NULL,
  line_index smallint NOT NULL,
  cycle integer NOT NULL,
  upload_id uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text,
  hash_old text,
  hash_new text,
  old_line jsonb,
  new_line jsonb,
  diff jsonb
);

CREATE INDEX IF NOT EXISTS idx_rcm_submit_line_audit_cpt ON public.rcm_submit_line_audit (submit_cpt_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_rcm_submit_line_audit_submit ON public.rcm_submit_line_audit (bil_claim_submit_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_rcm_submit_line_audit_upload ON public.rcm_submit_line_audit (upload_id);
