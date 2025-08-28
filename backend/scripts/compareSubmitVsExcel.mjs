import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

const norm = (s) => (s || '')
  .toString()
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, '')
  .replace(/[^A-Za-z0-9]/g, '')
  .toUpperCase();

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
  const envPath = findRootEnv(process.cwd());
  if (envPath) dotenv.config({ path: envPath });
  else dotenv.config();
}

async function getSubmitColumns(tableName = 'api_bil_claim_submit') {
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
    // Find schema for the table
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

function readExcelHeaders(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  const headerRow = (rows[0] || []).map(String);
  return { sheetName, headers: headerRow };
}

function diffSets(dbCols, excelHeaders) {
  const dbNormMap = new Map(dbCols.map(c => [norm(c), c]));
  const excelNormMap = new Map(excelHeaders.map(h => [norm(h), h]));

  const missingInExcel = [];
  for (const [n, orig] of dbNormMap.entries()) {
    if (!excelNormMap.has(n)) missingInExcel.push(orig);
  }
  const extraInExcel = [];
  for (const [n, orig] of excelNormMap.entries()) {
    if (!dbNormMap.has(n)) extraInExcel.push(orig);
  }
  const matched = [];
  for (const [n, dbOrig] of dbNormMap.entries()) {
    const ex = excelNormMap.get(n);
    if (ex) matched.push({ db: dbOrig, excel: ex });
  }
  return { missingInExcel, extraInExcel, matched };
}

async function main() {
  const fileArg = process.argv.slice(2).join(' ').trim();
  if (!fileArg) {
    console.error('Usage: node backend/scripts/compareSubmitVsExcel.mjs "<path-to-excel>"');
    process.exit(2);
  }
  const filePath = path.isAbsolute(fileArg) ? fileArg : path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(2);
  }

  loadEnv();
  const { schema, table, columns } = await getSubmitColumns('api_bil_claim_submit');
  const { sheetName, headers } = readExcelHeaders(filePath);

  const { missingInExcel, extraInExcel, matched } = diffSets(columns, headers);

  console.log(`Table: ${schema}.${table}`);
  console.log('DB columns count:', columns.length);
  console.log('Excel sheet:', sheetName);
  console.log('Excel headers count:', headers.length);
  console.log('---');
  console.log('Matched (name-insensitive):', matched.length);
  // Print first 30 matches for brevity
  console.log(matched.slice(0, 30));
  if (matched.length > 30) console.log(`... and ${matched.length - 30} more`);
  console.log('---');
  console.log('Missing in Excel (present in DB, absent in Excel):', missingInExcel.length);
  console.log(missingInExcel);
  console.log('---');
  console.log('Extra in Excel (not present in DB):', extraInExcel.length);
  console.log(extraInExcel);

  const ok = missingInExcel.length === 0;
  console.log('RESULT:', ok ? 'Excel headers fully cover the submit table columns.' : 'Excel headers DO NOT fully cover the submit table columns.');
}

main().catch(err => { console.error(err); process.exit(1); });
