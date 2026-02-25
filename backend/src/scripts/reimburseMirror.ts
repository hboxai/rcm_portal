import pool from '../config/db.js';
import { mirrorReimburseForUpload } from '../services/reimburse.js';

async function main() {
  const uploadId = process.argv.includes('--upload') ? process.argv[process.argv.indexOf('--upload') + 1] : undefined;
  console.log('Reimburse mirror start', uploadId ? `for upload ${uploadId}` : '(all missing)');
  const before = await pool.query('SELECT COUNT(*)::int AS n FROM api_bil_claim_reimburse');
  const res = await mirrorReimburseForUpload(uploadId);
  const after = await pool.query('SELECT COUNT(*)::int AS n FROM api_bil_claim_reimburse');
  console.log(`Created=${res.created} Updated=${res.updated} Deleted=${res.deleted}; total now: ${after.rows[0].n} (was ${before.rows[0].n})`);

  if (uploadId) {
    const a = await pool.query(
      `SELECT COUNT(*)::int AS n FROM api_bil_claim_submit WHERE upload_id=$1`, [uploadId]
    );
    const b = await pool.query(
      `SELECT COUNT(*)::int AS n FROM api_bil_claim_reimburse WHERE upload_id=$1`, [uploadId]
    );
    console.log(`Counts for upload ${uploadId}: submit=${a.rows[0].n}, reimburse=${b.rows[0].n}`);
    const sample = await pool.query(
  `SELECT s.bil_claim_submit_id AS submit_id, s.oa_claimid AS claim_id,
      to_char((SELECT MIN(dv) FROM (VALUES
                 (NULLIF(NULLIF(s.dateofservice1::text,'') , '')::date),
                 (NULLIF(NULLIF(s.dateofservice2::text,'') , '')::date),
                 (NULLIF(NULLIF(s.dateofservice3::text,'') , '')::date),
                 (NULLIF(NULLIF(s.dateofservice4::text,'') , '')::date),
                 (NULLIF(NULLIF(s.dateofservice5::text,'') , '')::date),
                 (NULLIF(NULLIF(s.dateofservice6::text,'') , '')::date)
       ) v(dv)), 'FMMM/FMDD/YYYY') AS charge_dt,
              NULLIF(NULLIF(s.totalcharges::text,'') , '')::numeric AS charge_amt,
              s.insuranceplanname AS prim_ins,
              r.claim_status
         FROM api_bil_claim_submit s
         JOIN api_bil_claim_reimburse r USING (bil_claim_submit_id)
        WHERE s.upload_id=$1
        ORDER BY s.bil_claim_submit_id
        LIMIT 10`, [uploadId]
    );
    if (res.samples?.length) {
      console.log('Sample lines:');
      for (const row of res.samples) console.log(row);
    } else if (sample.rowCount) {
      console.log('Sample lines:');
      for (const row of sample.rows) console.log(row);
    }
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
