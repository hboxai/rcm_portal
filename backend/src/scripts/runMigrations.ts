import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '..', 'migrations');

async function ensureMigrationsTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS app_migrations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

async function getApplied(): Promise<Set<string>> {
  const res = await pool.query('SELECT name FROM app_migrations');
  return new Set(res.rows.map((r: { name: string }) => r.name));
}

async function applyMigration(name: string, sql: string) {
  console.log(`Applying migration: ${name}`);
  try {
    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query('INSERT INTO app_migrations (name) VALUES ($1)', [name]);
    await pool.query('COMMIT');
    console.log(`Migration ${name} applied`);
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }
}

export async function runMigrations() {
  console.log('Migrations directory resolved to:', migrationsDir);
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found, skipping');
    return;
  }
  await ensureMigrationsTable();
  const applied = await getApplied();
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.match(/^\d+.*\.sql$/))
    .sort();

  console.log('Found migration files:', files);
  for (const f of files) {
    if (applied.has(f)) {
      continue;
    }
    const fullPath = path.join(migrationsDir, f);
    const sql = fs.readFileSync(fullPath, 'utf-8');
    await applyMigration(f, sql);
  }
  console.log('Migrations complete');
}

runMigrations().then(() => process.exit(0)).catch(err => { console.error('Migration failed', err); process.exit(1); });
