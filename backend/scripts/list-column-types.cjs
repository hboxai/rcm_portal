const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { Client } = require('pg');

async function main() {
  const table = (process.argv[2] || 'api_bil_claim_submit').toLowerCase();
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: (process.env.DB_SSL_ENABLED === 'true' || (process.env.DB_HOST || '').endsWith('.aptible.in'))
      ? { require: true, rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : false,
  });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1
       ORDER BY ordinal_position`,
      [table]
    );
    console.log(`Column types for ${table}:`);
    for (const r of rows) console.log(`${r.column_name}\t${r.data_type}`);
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
