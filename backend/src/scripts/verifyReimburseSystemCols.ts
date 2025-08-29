import pool from '../config/db.js';

async function main() {
  try {
    const cols = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='api_bil_claim_reimburse'
        AND column_name IN ('bil_claim_reimburse_id','bil_claim_submit_id','upload_id','s3_pdf_url','ocr_status','ocr_log','created_at','updated_at')
      ORDER BY column_name;
    `);
    console.log('Columns:', cols.rows.map((r: { column_name: string }) => r.column_name));

    const pk = await pool.query(`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conrelid = 'api_bil_claim_reimburse'::regclass AND contype='p';
    `);
    console.log('PK:', pk.rows);

    const sample = await pool.query(`
      SELECT r.bil_claim_reimburse_id, r.bil_claim_submit_id, s.bil_claim_submit_id AS submit_id,
             r.upload_id, u.file_kind, u.s3_url
      FROM api_bil_claim_reimburse r
      LEFT JOIN api_bil_claim_submit s ON s.bil_claim_submit_id = r.bil_claim_submit_id
      LEFT JOIN rcm_file_uploads u ON u.upload_id = r.upload_id
      LIMIT 5;
    `);
    console.log('Sample join rows (up to 5):');
    console.table(sample.rows);
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  }
}

main().then(()=>process.exit(0));
