-- Migration 029: Add unique constraint for cpt_code_id1 (Split Row Model)
-- In the split-row model, each Excel row with multiple CPTs is split into separate claim rows
-- Each claim row uses only cpt1/cpt_code_id1 position (cpt2-6 are deprecated)
-- This ensures each cpt_code_id is truly globally unique across all claims
-- This allows simple UPDATE logic: one cpt_code_id = one claim

-- CPT Code ID 1 - The primary and only CPT identifier used in split model
CREATE UNIQUE INDEX IF NOT EXISTS unique_cpt_code_id1 
ON api_bil_claim_submit (cpt_code_id1) 
WHERE cpt_code_id1 IS NOT NULL AND TRIM(cpt_code_id1) != '';

-- Also create unique indexes for cpt2-6 for backward compatibility
-- These will prevent accidental usage of these positions after migration
CREATE UNIQUE INDEX IF NOT EXISTS unique_cpt_code_id2 
ON api_bil_claim_submit (cpt_code_id2) 
WHERE cpt_code_id2 IS NOT NULL AND TRIM(cpt_code_id2) != '';

CREATE UNIQUE INDEX IF NOT EXISTS unique_cpt_code_id3 
ON api_bil_claim_submit (cpt_code_id3) 
WHERE cpt_code_id3 IS NOT NULL AND TRIM(cpt_code_id3) != '';

CREATE UNIQUE INDEX IF NOT EXISTS unique_cpt_code_id4 
ON api_bil_claim_submit (cpt_code_id4) 
WHERE cpt_code_id4 IS NOT NULL AND TRIM(cpt_code_id4) != '';

CREATE UNIQUE INDEX IF NOT EXISTS unique_cpt_code_id5 
ON api_bil_claim_submit (cpt_code_id5) 
WHERE cpt_code_id5 IS NOT NULL AND TRIM(cpt_code_id5) != '';

CREATE UNIQUE INDEX IF NOT EXISTS unique_cpt_code_id6 
ON api_bil_claim_submit (cpt_code_id6) 
WHERE cpt_code_id6 IS NOT NULL AND TRIM(cpt_code_id6) != '';

-- Add comments documenting the split-row model
COMMENT ON INDEX unique_cpt_code_id1 IS 'PRIMARY: Ensures cpt_code_id1 is globally unique (split-row model - one CPT per claim)';
COMMENT ON INDEX unique_cpt_code_id2 IS 'DEPRECATED: For backward compatibility only - use cpt1 position in split model';
COMMENT ON INDEX unique_cpt_code_id3 IS 'DEPRECATED: For backward compatibility only - use cpt1 position in split model';
COMMENT ON INDEX unique_cpt_code_id4 IS 'DEPRECATED: For backward compatibility only - use cpt1 position in split model';
COMMENT ON INDEX unique_cpt_code_id5 IS 'DEPRECATED: For backward compatibility only - use cpt1 position in split model';
COMMENT ON INDEX unique_cpt_code_id6 IS 'DEPRECATED: For backward compatibility only - use cpt1 position in split model';
