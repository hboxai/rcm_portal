import pool from '../config/db.js';

function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const uploadId = getArg('--upload');
  if (!uploadId) {
    console.error('Usage: tsx src/scripts/reimburseReport.ts --upload <upload_id>');
    process.exit(2);
  }

  console.log(`Report for upload ${uploadId}`);

  const [{ rows: sRows }, { rows: rRows }] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS n FROM api_bil_claim_submit WHERE upload_id=$1', [uploadId]),
    pool.query('SELECT COUNT(*)::int AS n FROM api_bil_claim_reimburse WHERE upload_id=$1', [uploadId]),
  ]);

  const submitCount = sRows[0]?.n ?? 0;
  const reimburseCount = rRows[0]?.n ?? 0;
  console.log(`Counts: submit=${submitCount}, reimburse=${reimburseCount}`);

  const sample = await pool.query(
    `SELECT s.bil_claim_submit_id AS submit_id,
            s.oa_claimid AS claim_id,
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
  LEFT JOIN api_bil_claim_reimburse r
         ON r.bil_claim_submit_id = s.bil_claim_submit_id
      WHERE s.upload_id=$1
      ORDER BY s.bil_claim_submit_id
      LIMIT 10`, [uploadId]
  );

  if (!sample.rowCount) {
    console.log('No rows to sample.');
  } else {
    console.log('Samples (up to 10):');
    for (const row of sample.rows) {
      console.log({
        ...row,
        charge_dt: row.charge_dt ?? null
      });
    }
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
