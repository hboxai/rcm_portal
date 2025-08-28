import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const norm = (s) => (s || '')
  .toString()
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, '')
  .replace(/[^A-Za-z0-9_]/g, '')
  .toLowerCase();

function findRootEnv(startDir) {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) return candidate;
    const next = path.dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  return null;
}

function loadEnv() {
  // Prefer repo root .env relative to this script: backend/scripts -> ../../.env
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const rootEnv = path.join(scriptDir, '../../.env');
  const backendEnv = path.join(scriptDir, '../.env');
  let loaded = false;
  if (fs.existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv, override: true });
    console.log(`Loaded env: ${rootEnv}`);
    loaded = true;
  }
  if (!loaded && fs.existsSync(backendEnv)) {
    dotenv.config({ path: backendEnv, override: true });
    console.log(`Loaded env: ${backendEnv}`);
    loaded = true;
  }
  if (!loaded) {
    const dynamic = findRootEnv(process.cwd());
    if (dynamic) {
      dotenv.config({ path: dynamic, override: true });
      console.log(`Loaded env: ${dynamic}`);
      loaded = true;
    } else {
      dotenv.config({ override: true });
      console.log('Loaded env from process environment (no .env file found)');
    }
  }
}

async function getColumns(tableName) {
  const sslEnabled = (process.env.DB_SSL_ENABLED === 'true') || (process.env.DB_HOST || '').endsWith('.aptible.in');
  const pool = new Pool({
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
    if (tRes.rowCount === 0) throw new Error(`Table not found: ${tableName}`);
    const { table_schema, table_name } = tRes.rows[0];
    const cRes = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [table_schema, table_name]
    );
    return { schema: table_schema, table: table_name, columns: cRes.rows.map(r => r.column_name) };
  } finally {
    client.release();
    await pool.end();
  }
}

function compareColumns(colsA, colsB) {
  const setA = new Set(colsA.map(norm));
  const setB = new Set(colsB.map(norm));
  const intersection = [...setA].filter(x => setB.has(x));
  const onlyA = colsA.filter(c => !setB.has(norm(c)));
  const onlyB = colsB.filter(c => !setA.has(norm(c)));
  return { intersection, onlyA, onlyB };
}

async function main() {
  loadEnv();
  console.log(`Using DB host ${process.env.DB_HOST} port ${process.env.DB_PORT}`);
  const submit = await getColumns('api_bil_claim_submit');
  const reimburse = await getColumns('api_bil_claim_reimburse');

  const { intersection, onlyA: submitOnly, onlyB: reimburseOnly } = compareColumns(submit.columns, reimburse.columns);

  console.log(`Submit table: ${submit.schema}.${submit.table} -> ${submit.columns.length} columns`);
  console.log(`Reimburse table: ${reimburse.schema}.${reimburse.table} -> ${reimburse.columns.length} columns`);
  console.log('---');
  console.log('Common columns:', intersection.length);
  console.log('Common columns list:', intersection);
  console.log('Submit-only columns:', submitOnly.length);
  console.log('Reimburse-only columns:', reimburseOnly.length);
  console.log('---');
  console.log('First 20 submit-only:', submitOnly.slice(0,20));
  console.log('First 20 reimburse-only:', reimburseOnly.slice(0,20));
}

main().catch(err => { console.error(err); process.exit(1); });
