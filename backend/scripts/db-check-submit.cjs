const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { Client } = require('pg');

async function main() {
  const uploadId = process.argv[2];
  if (!uploadId) { console.error('usage: node scripts/db-check-submit.cjs <upload_id>'); process.exit(2); }
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { require: true, rejectUnauthorized: false },
  });
  await client.connect();
  const cnt = await client.query(
    'SELECT COUNT(*) AS rows, upload_id FROM api_bil_claim_submit WHERE upload_id = $1 GROUP BY upload_id',
    [uploadId]
  );
  const sample = await client.query(
    'SELECT patient_id, cpt1, fromdateofservice1, totalcharges, upload_id, source_system, created_at FROM api_bil_claim_submit WHERE upload_id = $1 LIMIT 5',
    [uploadId]
  );
  console.log('COUNT:', JSON.stringify(cnt.rows));
  console.log('SAMPLE:', JSON.stringify(sample.rows));
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
