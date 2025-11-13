import { Request, Response } from 'express';
import pool from '../config/db.js';

type ParsedRow = {
  submit_cpt_id?: string;
  billing_id?: number;
  patient_id?: string;
  cpt_code?: string;
  dos?: string; // YYYY-MM-DD
  prim_amt?: number | null;
  prim_chk_det?: string | null;
  prim_recv_dt?: string | null;
  prim_denial_code?: string | null;
  sec_amt?: number | null;
  sec_chk_det?: string | null;
  sec_recv_dt?: string | null;
  sec_denial_code?: string | null;
  pat_amt?: number | null;
  pat_recv_dt?: string | null;
  allowed_amt?: number | null;
  write_off_amt?: number | null;
  claim_status?: string | null;
  raw_json?: any;
};

function safeStr(v: any): string | null {
  if (v === undefined || v === null) return null;
  return String(v);
}

async function logChange(
  client: any,
  claimId: string | number,
  fieldName: string,
  oldValue: any,
  newValue: any,
  source: 'SYSTEM' | 'MANUAL' | 'OFFICE_ALLY',
  username: string
): Promise<void> {
  await client.query(
    `INSERT INTO upl_change_logs (claim_id, username, billing_id, field_name, old_value, new_value, source, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [
      String(claimId),
      username,
      null,
      fieldName,
      oldValue == null ? null : String(oldValue),
      newValue == null ? null : String(newValue),
      source
    ]
  );
}

function calculateBalance(row: any): { bal_amt: number; claim_status: string } {
  const charge = parseFloat(row.charge_amt) || 0;
  const prim = parseFloat(row.prim_amt) || 0;
  const sec = parseFloat(row.sec_amt) || 0;
  const pat = parseFloat(row.pat_amt) || 0;
  const writeOff = parseFloat(row.write_off_amt) || 0;
  const bal_amt = charge - (prim + sec + pat) - writeOff;
  let claim_status = 'IN_PROGRESS';
  if (Math.abs(bal_amt) < 0.01) {
    claim_status = 'PAID';
  } else if (row.prim_denial_code || row.sec_denial_code) {
    if (prim > 0 || sec > 0 || pat > 0) claim_status = 'PARTIAL_DENIAL';
    else claim_status = 'DENIED';
  }
  return { bal_amt: Math.max(0, bal_amt), claim_status };
}

export async function triggerParseForEraFile(req: Request, res: Response) {
  const client = await pool.connect();
  try {
    const eraFileId = Number(req.params.id);
    const username = (req as any).user?.username || 'system';
    if (!eraFileId || Number.isNaN(eraFileId)) {
      return res.status(400).json({ error: 'Invalid era file id' });
    }

    // Ensure era file exists
    const f = await client.query('SELECT * FROM era_files WHERE id=$1', [eraFileId]);
    if (f.rowCount === 0) return res.status(404).json({ error: 'ERA file not found' });

    const body = req.body || {};
    const rows: ParsedRow[] = Array.isArray(body.rows) ? body.rows : [];

    await client.query('BEGIN');

    // Create batch
    const batchRes = await client.query(
      `INSERT INTO era_parse_batches (era_file_id, claim_id, created_by, created_by_id, status, source_format, total_rows, parsed_rows, warnings)
       VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        eraFileId,
        f.rows[0].claim_id ?? null,
        username,
        rows.length ? 'PENDING' : 'PENDING',
        safeStr(body.source_format) || 'json',
        rows.length || 0,
        rows.length || 0,
        null
      ]
    );
    const batch = batchRes.rows[0];

    // If rows provided, stage them now
    if (rows.length) {
      for (const r of rows) {
        const proposed = {
          prim_amt: r.prim_amt ?? null,
          prim_chk_det: r.prim_chk_det ?? null,
          prim_recv_dt: r.prim_recv_dt ?? null,
          prim_denial_code: r.prim_denial_code ?? null,
          sec_amt: r.sec_amt ?? null,
          sec_chk_det: r.sec_chk_det ?? null,
          sec_recv_dt: r.sec_recv_dt ?? null,
          sec_denial_code: r.sec_denial_code ?? null,
          pat_amt: r.pat_amt ?? null,
          pat_recv_dt: r.pat_recv_dt ?? null,
          allowed_amt: r.allowed_amt ?? null,
          write_off_amt: r.write_off_amt ?? null,
          claim_status: r.claim_status ?? null,
        };
        await client.query(
          `INSERT INTO era_parse_rows (
            batch_id, submit_cpt_id, billing_id, patient_id, cpt_code, dos,
            prim_amt, prim_chk_det, prim_recv_dt, prim_denial_code,
            sec_amt, sec_chk_det, sec_recv_dt, sec_denial_code,
            pat_amt, pat_recv_dt, allowed_amt, write_off_amt, claim_status,
            raw_json, proposed_updates
          ) VALUES (
            $1,$2,$3,$4,$5,$6,
            $7,$8,$9,$10,
            $11,$12,$13,$14,
            $15,$16,$17,$18,$19,
            $20,$21
          )`,
          [
            batch.batch_id,
            r.submit_cpt_id ?? null,
            r.billing_id ?? null,
            r.patient_id ?? null,
            r.cpt_code ?? null,
            r.dos ?? null,
            r.prim_amt ?? null,
            r.prim_chk_det ?? null,
            r.prim_recv_dt ?? null,
            r.prim_denial_code ?? null,
            r.sec_amt ?? null,
            r.sec_chk_det ?? null,
            r.sec_recv_dt ?? null,
            r.sec_denial_code ?? null,
            r.pat_amt ?? null,
            r.pat_recv_dt ?? null,
            r.allowed_amt ?? null,
            r.write_off_amt ?? null,
            r.claim_status ?? null,
            r.raw_json ? JSON.stringify(r.raw_json) : null,
            JSON.stringify(proposed)
          ]
        );
      }
    }

    await client.query('COMMIT');
    return res.status(202).json({ success: true, batch });
  } catch (err: any) {
    await pool.query('ROLLBACK');
    console.error('triggerParseForEraFile error', err);
    return res.status(500).json({ error: 'Failed to trigger/ingest ERA parse', message: err.message });
  }
}

export async function getLatestBatchForEraFile(req: Request, res: Response) {
  const client = await pool.connect();
  try {
    const eraFileId = Number(req.params.id);
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const pageSize = Math.max(1, Math.min(500, parseInt(String(req.query.pageSize || '200'), 10)));
    const offset = (page - 1) * pageSize;

    const b = await client.query(
      `SELECT * FROM era_parse_batches WHERE era_file_id=$1 ORDER BY batch_id DESC LIMIT 1`,
      [eraFileId]
    );
    if (b.rowCount === 0) return res.status(404).json({ error: 'No parse batch for this ERA file' });
    const batch = b.rows[0];
    const rows = await client.query(
      `SELECT * FROM era_parse_rows WHERE batch_id=$1 ORDER BY row_id LIMIT $2 OFFSET $3`,
      [batch.batch_id, pageSize, offset]
    );
    const count = await client.query(`SELECT COUNT(*)::int AS n FROM era_parse_rows WHERE batch_id=$1`, [batch.batch_id]);
    return res.json({ batch, rows: rows.rows, total: count.rows[0].n, page, pageSize });
  } catch (err: any) {
    console.error('getLatestBatchForEraFile error', err);
    return res.status(500).json({ error: 'Failed to load parse batch', message: err.message });
  } finally {
    client.release();
  }
}

export async function reviewRows(req: Request, res: Response) {
  const client = await pool.connect();
  try {
    const batchId = Number(req.params.batchId);
    const { rowIds, reviewed } = req.body || {};
    const username = (req as any).user?.username || 'system';
    if (!Array.isArray(rowIds) || rowIds.length === 0) return res.status(400).json({ error: 'rowIds required' });
    await client.query(
      `UPDATE era_parse_rows SET reviewed=$1, reviewer=$2, reviewed_at=NOW()
       WHERE batch_id=$3 AND row_id = ANY($4::bigint[])`,
      [!!reviewed, username, batchId, rowIds]
    );
    return res.json({ success: true });
  } catch (err: any) {
    console.error('reviewRows error', err);
    return res.status(500).json({ error: 'Failed to update review flags', message: err.message });
  } finally {
    client.release();
  }
}

export async function commitBatch(req: Request, res: Response) {
  const client = await pool.connect();
  try {
    const batchId = Number(req.params.batchId);
    const username = (req as any).user?.username || 'system';
    const onlyReviewed = String(req.query.onlyReviewed || 'true') === 'true';

    const b = await client.query(`SELECT * FROM era_parse_batches WHERE batch_id=$1`, [batchId]);
    if (b.rowCount === 0) return res.status(404).json({ error: 'Batch not found' });
    const batch = b.rows[0];

    const rowsRes = await client.query(
      `SELECT * FROM era_parse_rows WHERE batch_id=$1 ${onlyReviewed ? 'AND reviewed=true' : ''} ORDER BY row_id`,
      [batchId]
    );
    const rows = rowsRes.rows;
    if (rows.length === 0) return res.status(400).json({ error: 'No rows to commit' });

    await client.query('BEGIN');
    let matched = 0;
    let updated = 0;
    let notFound = 0;

    for (const r of rows) {
      // Find matching reimburse record
      let findQuery = '';
      let findParams: any[] = [];
      if (r.submit_cpt_id) {
        findQuery = `SELECT * FROM api_bil_claim_reimburse WHERE submit_cpt_id = $1`;
        findParams = [r.submit_cpt_id];
      } else if (r.billing_id) {
        findQuery = `SELECT * FROM api_bil_claim_reimburse WHERE bil_claim_submit_id = $1`;
        findParams = [r.billing_id];
      } else if (r.patient_id && r.cpt_code && r.dos) {
        findQuery = `SELECT * FROM api_bil_claim_reimburse WHERE patient_id=$1 AND cpt_id=$2 AND charge_dt=$3`;
        findParams = [r.patient_id, r.cpt_code, r.dos];
      } else {
        notFound++;
        continue;
      }

      const existing = await client.query(findQuery, findParams);
      if (existing.rowCount === 0) { notFound++; continue; }
      matched++;
      const row = existing.rows[0];
      const reimburseId = row.bil_claim_reimburse_id;

      const updates: any = {};
      const updateFields: string[] = [];

      const paymentFields = [
        'prim_amt', 'prim_chk_det', 'prim_recv_dt', 'prim_denial_code',
        'sec_amt', 'sec_chk_det', 'sec_recv_dt', 'sec_denial_code',
        'pat_amt', 'pat_recv_dt',
        'allowed_amt', 'write_off_amt', 'claim_status'
      ];

      for (const f of paymentFields) {
        const v = r[f];
        if (v !== undefined && v !== null && v !== '') {
          if (row[f] !== v) {
            updates[f] = v;
            updateFields.push(f);
          }
        }
      }

      if (updateFields.length > 0) {
        const setClauses = updateFields.map((f, idx) => `${f} = $${idx + 2}`).join(', ');
        const params = [reimburseId, ...updateFields.map(f => updates[f])];
        await client.query(
          `UPDATE api_bil_claim_reimburse SET ${setClauses}, updated_at=NOW() WHERE bil_claim_reimburse_id=$1`,
          params
        );

        const updatedRow = { ...row, ...updates };
        const { bal_amt, claim_status } = calculateBalance(updatedRow);
        await client.query(
          `UPDATE api_bil_claim_reimburse SET bal_amt=$1, claim_status=$2, claim_status_type='PAYER', updated_at=NOW() WHERE bil_claim_reimburse_id=$3`,
          [bal_amt, claim_status, reimburseId]
        );

        // Log field changes
        for (const f of updateFields) {
          await logChange(client, reimburseId, f, row[f], updates[f], 'SYSTEM', username);
        }
        // Log derived changes
        if (row.bal_amt !== undefined && row.bal_amt !== null) {
          if (Number(row.bal_amt) !== Number(bal_amt)) {
            await logChange(client, reimburseId, 'bal_amt', row.bal_amt, bal_amt, 'SYSTEM', username);
          }
        }
        if (row.claim_status !== undefined && row.claim_status !== null) {
          if (String(row.claim_status) !== String(claim_status)) {
            await logChange(client, reimburseId, 'claim_status', row.claim_status, claim_status, 'SYSTEM', username);
          }
        }
        updated++;
      }
    }

    await client.query(
      `UPDATE era_parse_batches SET status='COMMITTED', completed_at=NOW() WHERE batch_id=$1`,
      [batchId]
    );
    await client.query('COMMIT');

    return res.json({ success: true, stats: { total: rows.length, matched, updated, notFound }, batch: { ...batch, status: 'COMMITTED' } });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('commitBatch error', err);
    return res.status(500).json({ error: 'Failed to commit parsed ERA rows', message: err.message });
  } finally {
    client.release();
  }
}
