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
  return client.query(`SELECT * FROM api_bil_claim_submit LIMIT 1`);
}).then(result => {
  console.log('Sample row from api_bil_claim_submit:');
  if (result.rows.length > 0) {
    console.log(JSON.stringify(result.rows[0], null, 2));
  } else {
    console.log('No rows found');
  }
}).catch(console.error).finally(() => client.end());
