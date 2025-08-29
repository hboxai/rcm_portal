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

export async function mirrorReimburseForUpload(uploadId?: string): Promise<MirrorResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const scopeSql = uploadId ? 'WHERE upload_id = $1' : '';
    const params = uploadId ? [uploadId] : [];
    const sel = await client.query(
      `SELECT bil_claim_submit_id, upload_id, patient_id, insuranceplanname, payor_reference_id, oa_claimid,
              cpt1, cpt2, cpt3, cpt4, cpt5, cpt6,
              charges1, charges2, charges3, charges4, charges5, charges6,
              units1, units2, units3, units4, units5, units6,
              placeofservice1, placeofservice2, placeofservice3, placeofservice4, placeofservice5, placeofservice6,
              diagcodepointer1, diagcodepointer2, diagcodepointer3, diagcodepointer4, diagcodepointer5, diagcodepointer6,
              renderingphysnpi1, renderingphysnpi2, renderingphysnpi3, renderingphysnpi4, renderingphysnpi5, renderingphysnpi6,
              fromdateofservice1, fromdateofservice2, fromdateofservice3, fromdateofservice4, fromdateofservice5, fromdateofservice6
         FROM api_bil_claim_submit
       ${scopeSql}`, params);

    let created = 0, updated = 0, deleted = 0;
    const submit_rows = sel.rowCount ?? 0;

    for (const s of sel.rows) {
  const candidates: Array<{ cpt_id: string; charge_dt: string | null; charge_amt: number }>
        = [];
      for (let i = 1; i <= 6; i++) {
        const cpt = normCpt(s[`cpt${i}`]);
        const amt = parseAmt(s[`charges${i}`]);
        const dt = toPgDate(s[`fromdateofservice${i}`]);
        if (!cpt || amt == null) continue;
  // prim_cmt must remain NULL per requirement; do not compose comments
  candidates.push({ cpt_id: cpt, charge_dt: dt, charge_amt: amt });
      }

      // Upsert per candidate
      for (const c of candidates) {
    const u = await client.query(
          `UPDATE api_bil_claim_reimburse
              SET patient_id=$1, upload_id=$2, claim_id=$3, payor_reference_id=$4,
                  charge_amt=$5, prim_ins=$6, bal_amt=$5, claim_status='SUBMITTED', claim_status_type='PAYER',
      prim_cmt=NULL, updated_at=NOW()
    WHERE bil_claim_submit_id=$7 AND cpt_id=$8 AND charge_dt=$9::date`,
          [
            s.patient_id ?? null,
            s.upload_id,
            s.oa_claimid ?? null,
            s.payor_reference_id ?? null,
            c.charge_amt,
    s.insuranceplanname ?? null,
            s.bil_claim_submit_id,
            c.cpt_id,
      c.charge_dt,
          ]
        );
        if (u.rowCount && u.rowCount > 0) {
          updated += u.rowCount;
        } else {
          const ins = await client.query(
            `INSERT INTO api_bil_claim_reimburse (
               bil_claim_submit_id, upload_id, patient_id, cpt_id, era_filename,
               claim_id, payor_reference_id,
               charge_dt, charge_amt,
               prim_ins, bal_amt, claim_status, claim_status_type,
               prim_cmt
             ) VALUES ($1,$2,$3,$4,NULL,$5,$6,$7::date,$8,$9,$8,'SUBMITTED','PAYER',NULL)
             RETURNING bil_claim_reimburse_id`,
            [
              s.bil_claim_submit_id,
              s.upload_id,
              s.patient_id ?? null,
              c.cpt_id,
              s.oa_claimid ?? null,
              s.payor_reference_id ?? null,
              c.charge_dt,
              c.charge_amt,
              s.insuranceplanname ?? null,
              // prim_cmt intentionally NULL
            ]
          );
          if (ins.rowCount) created += ins.rowCount;
        }
      }

      // Deletion sweep for stale CPT/date combos
      // Null-safe deletion: remove rows whose (cpt_id, charge_dt) not in candidates
      let d;
      if (candidates.length > 0) {
        const keep = candidates;
  d = await client.query(
          `DELETE FROM api_bil_claim_reimburse r
             WHERE r.bil_claim_submit_id = $1
               AND NOT EXISTS (
                 SELECT 1 FROM (
       VALUES ${keep.map((_, i) => `($${i * 2 + 2}::text, $${i * 2 + 3}::date)`).join(',')}
                 ) AS v(cpt_id, charge_dt)
                 WHERE v.cpt_id = r.cpt_id AND (
                   (v.charge_dt IS NULL AND r.charge_dt IS NULL) OR
                   (v.charge_dt IS NOT NULL AND r.charge_dt = v.charge_dt)
                 )
               )`,
          [s.bil_claim_submit_id, ...keep.flatMap(c => [c.cpt_id, c.charge_dt])]
        );
      } else {
        d = await client.query(
          `DELETE FROM api_bil_claim_reimburse WHERE bil_claim_submit_id = $1`,
          [s.bil_claim_submit_id]
        );
      }
  deleted += d.rowCount ?? 0;
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
    return { submit_rows, created, updated, deleted, samples };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
