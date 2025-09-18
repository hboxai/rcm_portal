import pool from '../config/db.js';

async function main() {
  const client = await pool.connect();
  try {
    const sql = `
      SELECT n.nspname AS schemaname, s.relname AS seqname, d.deptype
      FROM pg_class s
      JOIN pg_namespace n ON n.oid = s.relnamespace
      JOIN pg_depend d ON d.objid = s.oid
      JOIN pg_class t ON t.oid = d.refobjid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
      WHERE s.relkind = 'S'
        AND t.relname = 'api_bil_claim_reimburse'
        AND a.attname = 'bil_claim_reimburse_id'
      ORDER BY 1,2`;
    const res = await client.query(sql);
    console.log('Owned sequences:', res.rowCount);
    for (const r of res.rows) {
      console.log(`${r.schemaname}.${r.seqname} deptype=${r.deptype}`);
    }
  } finally {
    client.release();
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
