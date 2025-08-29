import pool from '../config/db.js';

async function main() {
  try {
    const res = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='api_bil_claim_submit'
        AND column_name IN ('upload_id','source_system','office_ally_status','office_ally_status_reason','created_at')
      ORDER BY column_name;
    `);
  console.log('Found columns:', res.rows.map((r: { column_name: string }) => r.column_name));
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  }
}

main().then(()=>process.exit(0));
