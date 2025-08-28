import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

function loadEnv() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const rootEnv = path.join(scriptDir, '../../.env');
  const backendEnv = path.join(scriptDir, '../.env');
  if (fs.existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv, override: true });
    console.log(`Loaded env: ${rootEnv}`);
  } else if (fs.existsSync(backendEnv)) {
    dotenv.config({ path: backendEnv, override: true });
    console.log(`Loaded env: ${backendEnv}`);
  } else {
    dotenv.config({ override: true });
    console.log('Loaded env from process environment');
  }
}

async function getPool() {
  const sslEnabled = (process.env.DB_SSL_ENABLED === 'true') || (process.env.DB_HOST || '').endsWith('.aptible.in');
  return new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: sslEnabled ? { require: true, rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
    max: 1,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 10000,
  });
}

async function listForeignKeys(pool, tableName) {
  const client = await pool.connect();
  try {
    const tRes = await client.query(
      `SELECT table_schema, table_name
       FROM information_schema.tables
       WHERE table_name ILIKE $1
       ORDER BY (table_schema='public') DESC, table_schema, table_name
       LIMIT 1`,
      [tableName]
    );
    if (tRes.rowCount === 0) return { table: tableName, schema: null, fks: [] };
    const { table_schema, table_name } = tRes.rows[0];
    const sql = `
      SELECT
        tc.constraint_name,
        kcu.table_schema AS src_schema,
        kcu.table_name   AS src_table,
        kcu.column_name  AS src_column,
        ccu.table_schema AS ref_schema,
        ccu.table_name   AS ref_table,
        ccu.column_name  AS ref_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.constraint_schema = kcu.constraint_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.constraint_schema = tc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND kcu.table_schema = $1 AND kcu.table_name = $2
      ORDER BY kcu.ordinal_position, tc.constraint_name`;
    const res = await client.query(sql, [table_schema, table_name]);
    return {
      schema: table_schema,
      table: table_name,
      fks: res.rows.map(r => ({
        name: r.constraint_name,
        src: `${r.src_schema}.${r.src_table}.${r.src_column}`,
        ref: `${r.ref_schema}.${r.ref_table}.${r.ref_column}`,
      }))
    };
  } finally {
    client.release();
  }
}

async function main() {
  loadEnv();
  console.log(`Using DB host ${process.env.DB_HOST} port ${process.env.DB_PORT}`);
  const pool = await getPool();
  try {
    const submit = await listForeignKeys(pool, 'api_bil_claim_submit');
    const reimburse = await listForeignKeys(pool, 'api_bil_claim_reimburse');
    console.log('---');
    console.log(`${submit.schema}.${submit.table} FKs (${submit.fks.length}):`);
    submit.fks.forEach(fk => console.log(`- ${fk.name}: ${fk.src} -> ${fk.ref}`));
    console.log('---');
    console.log(`${reimburse.schema}.${reimburse.table} FKs (${reimburse.fks.length}):`);
    reimburse.fks.forEach(fk => console.log(`- ${fk.name}: ${fk.src} -> ${fk.ref}`));
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
