import pool from '../config/db.js';

async function main() {
  try {
    const res = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='api_bil_claim_submit'
        AND column_name IN ('cpt_id1','cpt_id2','cpt_id3','cpt_id4','cpt_id5','cpt_id6')
      ORDER BY column_name;
    `);
    const found = res.rows.map((r: { column_name: string }) => r.column_name);
    console.log('Found submit cpt_id columns:', found);
    const missing = ['cpt_id1','cpt_id2','cpt_id3','cpt_id4','cpt_id5','cpt_id6'].filter(c => !found.includes(c));
    if (missing.length) {
      console.error('Missing columns:', missing);
      process.exit(1);
    }
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  }
}

main().then(()=>process.exit(0));
