# ERA OCR Staging → Review → Commit

Minimal contract for integrating a Python (or other) ERA parser that posts parsed rows for review, then commits approved changes into reimbursements.

## Endpoints

- POST /api/era/era-files/:id/parse
  - Auth: Bearer token
  - Body:
    - source_format?: string (e.g., "json", "x12-835")
    - rows?: ParsedRow[] (see schema below)
  - Response: 202 Accepted with { success, batch }

- GET /api/era/era-files/:id/parse/latest
  - Query: page?, pageSize?
  - Response: { batch, rows, total, page, pageSize }

- POST /api/era/era-parses/:batchId/review
  - Body: { rowIds: number[], reviewed: boolean }
  - Response: { success: true }

- POST /api/era/era-parses/:batchId/commit?onlyReviewed=true
  - Applies staged values to matching api_bil_claim_reimburse rows; recalculates bal_amt and claim_status; logs changes to upl_change_logs.
  - Response: { success, stats: { total, matched, updated, notFound }, batch }

Base path is /api/era (e.g., POST /api/era/era-files/123/parse).

## ParsedRow schema

At least one of the matching keys must be present: submit_cpt_id OR billing_id OR (patient_id + cpt_code + dos).

```
type ParsedRow = {
  // Matching keys (choose one strategy)
  submit_cpt_id?: string;
  billing_id?: number;                // bil_claim_submit_id
  patient_id?: string;                // pairs with cpt_code + dos
  cpt_code?: string;                  // CPT identifier used in api_bil_claim_reimburse.cpt_id
  dos?: string;                       // YYYY-MM-DD; matched to charge_dt

  // Payment fields (only non-null values are applied)
  prim_amt?: number | null;
  prim_chk_det?: string | null;
  prim_recv_dt?: string | null;       // YYYY-MM-DD
  prim_denial_code?: string | null;
  sec_amt?: number | null;
  sec_chk_det?: string | null;
  sec_recv_dt?: string | null;        // YYYY-MM-DD
  sec_denial_code?: string | null;
  pat_amt?: number | null;
  pat_recv_dt?: string | null;        // YYYY-MM-DD
  allowed_amt?: number | null;
  write_off_amt?: number | null;
  claim_status?: string | null;       // optional explicit override

  raw_json?: any;                     // optional raw payload for traceability
};
```

Notes
- Only non-null/defined values are applied; empty strings are ignored.
- After applying, bal_amt and claim_status are recomputed server-side and logged.
- All changes are logged to upl_change_logs with source='SYSTEM'.

## Example payload

POST /api/era/era-files/123/parse

```
{
  "source_format": "json",
  "rows": [
    {
      "submit_cpt_id": "SUB-10001-1",
      "prim_amt": 125.00,
      "prim_chk_det": "CHK#12345",
      "prim_recv_dt": "2025-11-10",
      "allowed_amt": 150.00,
      "write_off_amt": 25.00,
      "raw_json": { "line": 1 }
    },
    {
      "patient_id": "PAT-42",
      "cpt_code": "99213",
      "dos": "2025-10-20",
      "sec_amt": 35.00,
      "sec_recv_dt": "2025-11-11",
      "claim_status": "IN_PROGRESS"
    }
  ]
}
```

## Review and commit flow

1) Ingest: POST /api/era/era-files/:id/parse with rows → creates a batch and stores rows.
2) Review: mark selected rows as reviewed via POST /api/era/era-parses/:batchId/review with { rowIds, reviewed: true }.
3) Commit: POST /api/era/era-parses/:batchId/commit?onlyReviewed=true to apply only reviewed rows.

## Python example

See scripts/ingest_era_rows.py. Minimal usage:

```
set BASE_URL=http://localhost:5000
set TOKEN=eyJhbGciOi...
set ERA_FILE_ID=123
python scripts/ingest_era_rows.py eraParsedRows.sample.json
```

Windows PowerShell:

```
$env:BASE_URL = "http://localhost:5000"
$env:TOKEN = "eyJhbGciOi..."
$env:ERA_FILE_ID = "123"
python scripts/ingest_era_rows.py eraParsedRows.sample.json
```

The script posts to /api/era/era-files/$ERA_FILE_ID/parse with the JSON file’s rows.
