const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const client = new Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { require: true, rejectUnauthorized: false }
});

client.connect().then(() => {
  return client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'api_bil_claim_submit' ORDER BY ordinal_position`);
}).then(result => {
  console.log('Columns in api_bil_claim_submit:');
  result.rows.forEach(row => console.log('- ' + row.column_name));
}).catch(console.error).finally(() => client.end());
