import pool from '../config/db.js';

async function main() {
  try {
    const ddlRes = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='rcm_file_uploads'
      ORDER BY ordinal_position;
    `);
    console.log('Columns in rcm_file_uploads:');
    console.table(ddlRes.rows);

    const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM rcm_file_uploads;`);
    console.log('Row count:', countRes.rows[0].count);

    const viewCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='uploads'
      ORDER BY ordinal_position;
    `);
    console.log('Columns in uploads view:');
    console.table(viewCols.rows);

    const viewCount = await pool.query(`SELECT COUNT(*)::int AS count FROM uploads;`);
    console.log('uploads view row count:', viewCount.rows[0].count);
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  }
}

main().then(()=>process.exit(0));
