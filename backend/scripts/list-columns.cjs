const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const table = (process.argv[2] || 'api_submit_claim').toLowerCase();

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { require: true, rejectUnauthorized: false },
  });
  try {
    await client.connect();
    const sql = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `;
    const { rows } = await client.query(sql, [table]);
    if (!rows.length) {
      console.log(`No columns found. Table not present or has no columns: ${table}`);
      process.exit(2);
    }
    console.log(`Columns in ${table}:`);
    for (const r of rows) console.log(r.column_name);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    try { await client.end(); } catch {}
  }
}

main();
