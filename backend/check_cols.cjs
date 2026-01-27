const { Pool } = require('pg');
const p = new Pool({ 
  host: 'localhost',
  port: 5433,
  database: 'db',
  user: 'aptible',
  password: 'vFo1YTmrORZvc-kaFEGu3MzJbJ-8UsEd',
  ssl: { rejectUnauthorized: false }
});
p.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'api_bil_claim_submit' ORDER BY ordinal_position")
  .then(r => { console.log(r.rows.map(x=>x.column_name).join('\n')); p.end(); })
  .catch(e => { console.error(e); p.end(); });
