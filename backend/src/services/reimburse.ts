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

    // Scope selection for counting
    const scopeSql = uploadId ? 'WHERE upload_id = $1' : '';
    const params = uploadId ? [uploadId] : [];
    
    // Get count of submit rows
    const countRes = await client.query(
      `SELECT COUNT(*) as cnt FROM api_bil_claim_submit ${scopeSql}`,
      params
    );
    const submit_rows = Number(countRes.rows[0]?.cnt ?? 0);

    // Create temp table for candidates
    await client.query(`
      CREATE TEMP TABLE tmp_reimburse_candidates (
        submit_claim_id bigint not null,
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

    // SQL-based unpivot using UNION ALL - eliminates in-memory processing
    // This approach is much faster for large datasets as it leverages DB-side filtering
    const insertSql = `
      INSERT INTO tmp_reimburse_candidates 
        (submit_claim_id, upload_id, patient_id, cpt_id, charge_dt, charge_amt, 
         claim_id, payor_reference_id, prim_ins, submit_cpt_id)
      SELECT 
        claim_id::bigint,
        upload_id,
        CASE WHEN patient_id IS NOT NULL THEN patient_id::bigint ELSE NULL END,
        UPPER(TRIM(cpt1)) AS cpt_id,
        CASE 
          WHEN fromdateofservice1 IS NOT NULL 
            AND fromdateofservice1::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          THEN fromdateofservice1::date
          ELSE NULL
        END AS charge_dt,
        charges1::numeric AS charge_amt,
        oa_claimid,
        payor_reference_id,
        insuranceplanname,
        TRIM(cpt_code_id1) AS submit_cpt_id
      FROM api_bil_claim_submit
      WHERE UPPER(TRIM(COALESCE(cpt1, ''))) != '' 
        AND UPPER(TRIM(COALESCE(cpt1, ''))) != '0'
        AND charges1 IS NOT NULL
        AND charges1::numeric > 0
        AND TRIM(COALESCE(cpt_code_id1, '')) != ''
        ${scopeSql ? 'AND upload_id = $1' : ''}
      
      UNION ALL
      
      SELECT 
        claim_id::bigint, upload_id,
        CASE WHEN patient_id IS NOT NULL THEN patient_id::bigint ELSE NULL END,
        UPPER(TRIM(cpt2)),
        CASE WHEN fromdateofservice2 IS NOT NULL AND fromdateofservice2::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN fromdateofservice2::date ELSE NULL END,
        charges2::numeric,
        oa_claimid, payor_reference_id, insuranceplanname,
        TRIM(cpt_code_id2)
      FROM api_bil_claim_submit
      WHERE UPPER(TRIM(COALESCE(cpt2, ''))) != ''
        AND UPPER(TRIM(COALESCE(cpt2, ''))) != '0'
        AND charges2 IS NOT NULL
        AND charges2::numeric > 0
        AND TRIM(COALESCE(cpt_code_id2, '')) != ''
        ${scopeSql ? 'AND upload_id = $1' : ''}
      
      UNION ALL
      
      SELECT 
        claim_id::bigint, upload_id,
        CASE WHEN patient_id IS NOT NULL THEN patient_id::bigint ELSE NULL END,
        UPPER(TRIM(cpt3)),
        CASE WHEN fromdateofservice3 IS NOT NULL AND fromdateofservice3::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN fromdateofservice3::date ELSE NULL END,
        charges3::numeric,
        oa_claimid, payor_reference_id, insuranceplanname,
        TRIM(cpt_code_id3)
      FROM api_bil_claim_submit
      WHERE UPPER(TRIM(COALESCE(cpt3, ''))) != ''
        AND UPPER(TRIM(COALESCE(cpt3, ''))) != '0'
        AND charges3 IS NOT NULL
        AND charges3::numeric > 0
        AND TRIM(COALESCE(cpt_code_id3, '')) != ''
        ${scopeSql ? 'AND upload_id = $1' : ''}
      
      UNION ALL
      
      SELECT 
        claim_id::bigint, upload_id,
        CASE WHEN patient_id IS NOT NULL THEN patient_id::bigint ELSE NULL END,
        UPPER(TRIM(cpt4)),
        CASE WHEN fromdateofservice4 IS NOT NULL AND fromdateofservice4::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN fromdateofservice4::date ELSE NULL END,
        charges4::numeric,
        oa_claimid, payor_reference_id, insuranceplanname,
        TRIM(cpt_code_id4)
      FROM api_bil_claim_submit
      WHERE UPPER(TRIM(COALESCE(cpt4, ''))) != ''
        AND UPPER(TRIM(COALESCE(cpt4, ''))) != '0'
        AND charges4 IS NOT NULL
        AND charges4::numeric > 0
        AND TRIM(COALESCE(cpt_code_id4, '')) != ''
        ${scopeSql ? 'AND upload_id = $1' : ''}
      
      UNION ALL
      
      SELECT 
        claim_id::bigint, upload_id,
        CASE WHEN patient_id IS NOT NULL THEN patient_id::bigint ELSE NULL END,
        UPPER(TRIM(cpt5)),
        CASE WHEN fromdateofservice5 IS NOT NULL AND fromdateofservice5::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN fromdateofservice5::date ELSE NULL END,
        charges5::numeric,
        oa_claimid, payor_reference_id, insuranceplanname,
        TRIM(cpt_code_id5)
      FROM api_bil_claim_submit
      WHERE UPPER(TRIM(COALESCE(cpt5, ''))) != ''
        AND UPPER(TRIM(COALESCE(cpt5, ''))) != '0'
        AND charges5 IS NOT NULL
        AND charges5::numeric > 0
        AND TRIM(COALESCE(cpt_code_id5, '')) != ''
        ${scopeSql ? 'AND upload_id = $1' : ''}
      
      UNION ALL
      
      SELECT 
        claim_id::bigint, upload_id,
        CASE WHEN patient_id IS NOT NULL THEN patient_id::bigint ELSE NULL END,
        UPPER(TRIM(cpt6)),
        CASE WHEN fromdateofservice6 IS NOT NULL AND fromdateofservice6::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN fromdateofservice6::date ELSE NULL END,
        charges6::numeric,
        oa_claimid, payor_reference_id, insuranceplanname,
        TRIM(cpt_code_id6)
      FROM api_bil_claim_submit
      WHERE UPPER(TRIM(COALESCE(cpt6, ''))) != ''
        AND UPPER(TRIM(COALESCE(cpt6, ''))) != '0'
        AND charges6 IS NOT NULL
        AND charges6::numeric > 0
        AND TRIM(COALESCE(cpt_code_id6, '')) != ''
        ${scopeSql ? 'AND upload_id = $1' : ''}
    `;

    await client.query(insertSql, params);

    // Create indexes on temp table for optimal JOIN performance
    await client.query(`
      CREATE INDEX idx_tmp_candidates_lookup 
      ON tmp_reimburse_candidates(submit_claim_id, cpt_id, charge_dt)
    `);
    
    await client.query(`
      CREATE INDEX idx_tmp_candidates_upload 
      ON tmp_reimburse_candidates(upload_id)
    `);

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
       WHERE r.submit_claim_id = c.submit_claim_id
         AND r.cpt_id = c.cpt_id
         AND ((r.charge_dt IS NULL AND c.charge_dt IS NULL) OR (r.charge_dt = c.charge_dt))`
    );

    // Set-based INSERT for new rows
    const ins = await client.query(
      `INSERT INTO api_bil_claim_reimburse (
         bil_claim_reimburse_id,
         submit_claim_id, upload_id, patient_id, cpt_id, era_filename,
         claim_id, payor_reference_id,
         charge_dt, charge_amt,
         prim_ins, bal_amt, claim_status, claim_status_type,
         prim_cmt,
         submit_cpt_id
       )
       SELECT nextval('public.api_bil_claim_reimburse_bil_claim_reimburse_id_seq'),
              c.submit_claim_id, c.upload_id, c.patient_id, c.cpt_id, NULL,
              c.claim_id, c.payor_reference_id,
              c.charge_dt, c.charge_amt,
              c.prim_ins, c.charge_amt, 'SUBMITTED', 'PAYER',
              NULL,
              c.submit_cpt_id
         FROM tmp_reimburse_candidates c
    LEFT JOIN api_bil_claim_reimburse r
           ON r.submit_claim_id = c.submit_claim_id
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
               WHERE r.submit_claim_id = c.submit_claim_id
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
        `SELECT submit_claim_id AS submit_id, cpt_id,
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
