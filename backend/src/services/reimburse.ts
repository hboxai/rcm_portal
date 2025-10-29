import pool from '../config/db.js';

type MirrorResult = {
  submit_rows: number;
  created: number;
  updated: number;
  deleted: number;
  samples: Array<{ submit_id: number; cpt_id: string; charge_dt: string | null; charge_amt: number | null; prim_cmt: string | null }>
};

function toPgDate(input: any): string | null {
  if (input == null) return null;
  if (input instanceof Date) {
    const y = input.getUTCFullYear();
    const m = (input.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = input.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(input).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d+(?:\.\d+)?$/.test(s)) {
    const days = Math.floor(Number(s));
    const base = Date.UTC(1899, 11, 30); // Excel serial base
    const ms = base + days * 86400000;
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = d.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  const mdy = s.replace(/\//g, '-');
  const m = mdy.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const mm = Math.min(12, Math.max(1, Number(m[1])));
    const dd = Math.min(31, Math.max(1, Number(m[2])));
    const yy = Number(m[3]);
    const d = new Date(Date.UTC(yy, mm - 1, dd));
    const y = d.getUTCFullYear();
    const mm2 = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd2 = d.getUTCDate().toString().padStart(2, '0');
    return `${y}-${mm2}-${dd2}`;
  }
  return null;
}

function parseAmt(v: any): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function normCpt(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim().toUpperCase();
  if (!s || s === '0') return null;
  return s;
}

function normSubmitCptId(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s;
}

export async function mirrorReimburseForUpload(uploadId?: string): Promise<MirrorResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Scope selection
    const scopeSql = uploadId ? 'WHERE upload_id = $1' : '';
    const params = uploadId ? [uploadId] : [];
    const sel = await client.query(
      `SELECT bil_claim_submit_id, upload_id, patient_id, insuranceplanname, payor_reference_id, oa_claimid,
              cpt1, cpt2, cpt3, cpt4, cpt5, cpt6,
              cpt_id1, cpt_id2, cpt_id3, cpt_id4, cpt_id5, cpt_id6,
              charges1, charges2, charges3, charges4, charges5, charges6,
              fromdateofservice1, fromdateofservice2, fromdateofservice3, fromdateofservice4, fromdateofservice5, fromdateofservice6
         FROM api_bil_claim_submit
       ${scopeSql}`, params
    );

    const submit_rows = sel.rowCount ?? 0;

    // Build candidate reimburse lines in memory (fast) and stage into a temp table for set-based ops
    type Cand = {
      bil_claim_submit_id: number;
      upload_id: string | null;
      patient_id: number | null;
      cpt_id: string;
      charge_dt: string | null;
      charge_amt: number;
      claim_id: string | null;
      payor_reference_id: string | null;
      prim_ins: string | null;
      submit_cpt_id: string | null;
    };

    const candidates: Cand[] = [];
    for (const s of sel.rows) {
      for (let i = 1; i <= 6; i++) {
        const cpt = normCpt(s[`cpt${i}`]);
        const amt = parseAmt(s[`charges${i}`]);
        const dt = toPgDate(s[`fromdateofservice${i}`]);
        const sid = normSubmitCptId(s[`cpt_id${i}`]);
        // New rule: consider a claim line only when submit cpt_id for that line is present
        if (!cpt || amt == null || !sid) continue;
        candidates.push({
          bil_claim_submit_id: Number(s.bil_claim_submit_id),
          upload_id: s.upload_id ?? null,
          patient_id: s.patient_id == null ? null : Number(s.patient_id),
          cpt_id: cpt,
          charge_dt: dt,
          charge_amt: amt,
          claim_id: s.oa_claimid ?? null,
          payor_reference_id: s.payor_reference_id ?? null,
          prim_ins: s.insuranceplanname ?? null,
          submit_cpt_id: sid,
        });
      }
    }

    // Create temp table
    await client.query(`
      CREATE TEMP TABLE IF NOT EXISTS tmp_reimburse_candidates (
        bil_claim_submit_id bigint not null,
        upload_id uuid,
        patient_id bigint,
        cpt_id text not null,
        charge_dt date,
        charge_amt numeric,
        claim_id text,
        payor_reference_id text,
        prim_ins text,
        submit_cpt_id text
      ) ON COMMIT DROP
    `);

    // Truncate in case it existed
    await client.query('TRUNCATE tmp_reimburse_candidates');

    // Batch insert candidates into temp table for performance
    const batchSize = 1000;
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      if (batch.length === 0) continue;
  const cols = ['bil_claim_submit_id','upload_id','patient_id','cpt_id','charge_dt','charge_amt','claim_id','payor_reference_id','prim_ins','submit_cpt_id'];
      const valuesSql = batch
        .map((_, rowIdx) => `(${cols.map((__, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`).join(',')})`)
        .join(',');
      const values = batch.flatMap(b => [
        b.bil_claim_submit_id,
        b.upload_id,
        b.patient_id,
        b.cpt_id,
        b.charge_dt,
        b.charge_amt,
        b.claim_id,
        b.payor_reference_id,
        b.prim_ins,
        b.submit_cpt_id,
      ]);
      await client.query(
        `INSERT INTO tmp_reimburse_candidates (${cols.join(',')}) VALUES ${valuesSql}`,
        values
      );
    }

    // Set-based UPDATE existing reimburse rows
    const upd = await client.query(
      `UPDATE api_bil_claim_reimburse r
          SET patient_id = c.patient_id,
              upload_id = c.upload_id,
              claim_id = c.claim_id,
              payor_reference_id = c.payor_reference_id,
              charge_amt = c.charge_amt,
              prim_ins = c.prim_ins,
              bal_amt = c.charge_amt,
              claim_status = 'SUBMITTED',
              claim_status_type = 'PAYER',
              prim_cmt = NULL,
              submit_cpt_id = c.submit_cpt_id,
              updated_at = NOW()
        FROM tmp_reimburse_candidates c
       WHERE r.bil_claim_submit_id = c.bil_claim_submit_id
         AND r.cpt_id = c.cpt_id
         AND ((r.charge_dt IS NULL AND c.charge_dt IS NULL) OR (r.charge_dt = c.charge_dt))`
    );

    // Set-based INSERT for new rows
    const ins = await client.query(
      `INSERT INTO api_bil_claim_reimburse (
         bil_claim_reimburse_id,
         bil_claim_submit_id, upload_id, patient_id, cpt_id, era_filename,
         claim_id, payor_reference_id,
         charge_dt, charge_amt,
         prim_ins, bal_amt, claim_status, claim_status_type,
         prim_cmt,
         submit_cpt_id
       )
       SELECT nextval('public.api_bil_claim_reimburse_bil_claim_reimburse_id_seq'),
              c.bil_claim_submit_id, c.upload_id, c.patient_id, c.cpt_id, NULL,
              c.claim_id, c.payor_reference_id,
              c.charge_dt, c.charge_amt,
              c.prim_ins, c.charge_amt, 'SUBMITTED', 'PAYER',
              NULL,
              c.submit_cpt_id
         FROM tmp_reimburse_candidates c
    LEFT JOIN api_bil_claim_reimburse r
           ON r.bil_claim_submit_id = c.bil_claim_submit_id
          AND r.cpt_id = c.cpt_id
          AND ((r.charge_dt IS NULL AND c.charge_dt IS NULL) OR (r.charge_dt = c.charge_dt))
        WHERE r.bil_claim_reimburse_id IS NULL`
    );

    // Set-based DELETE of stale rows (only for the current upload scope)
    let del;
    if (uploadId) {
      del = await client.query(
        `DELETE FROM api_bil_claim_reimburse r
          WHERE r.upload_id = $1
            AND NOT EXISTS (
              SELECT 1 FROM tmp_reimburse_candidates c
               WHERE r.bil_claim_submit_id = c.bil_claim_submit_id
                 AND r.cpt_id = c.cpt_id
                 AND ((r.charge_dt IS NULL AND c.charge_dt IS NULL) OR (r.charge_dt = c.charge_dt))
            )`,
        [uploadId]
      );
    } else {
      // If no specific uploadId, we can't safely delete globally; skip deletion in this mode
      del = { rowCount: 0 } as any;
    }

    // Samples for this upload
    const samples: MirrorResult['samples'] = [];
    if (uploadId) {
      const smp = await client.query(
        `SELECT bil_claim_submit_id AS submit_id, cpt_id,
                to_char(charge_dt, 'FMMM/FMDD/YYYY') AS charge_dt, charge_amt::numeric, prim_cmt
           FROM api_bil_claim_reimburse
          WHERE upload_id=$1
          ORDER BY bil_claim_reimburse_id
          LIMIT 3`,
        [uploadId]
      );
      for (const r of smp.rows) {
        samples.push({
          submit_id: Number(r.submit_id),
          cpt_id: String(r.cpt_id),
          charge_dt: r.charge_dt ?? null,
          charge_amt: r.charge_amt == null ? null : Number(r.charge_amt),
          prim_cmt: r.prim_cmt ?? null,
        });
      }
    }

    await client.query('COMMIT');
    return { submit_rows, created: ins.rowCount ?? 0, updated: upd.rowCount ?? 0, deleted: del.rowCount ?? 0, samples };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
