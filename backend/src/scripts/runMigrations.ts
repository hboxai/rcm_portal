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

function maybeTransformSql(name: string, originalSql: string): string | null {
  // Skip entire files via regex (e.g., to avoid running certain migrations in prod)
  const skipRegex = process.env.MIGRATIONS_SKIP_REGEX;
  if (skipRegex) {
    try {
      const rx = new RegExp(skipRegex, 'i');
      if (rx.test(name)) {
        console.log(`Skipping migration by regex (${skipRegex}): ${name}`);
        return null;
      }
    } catch (e) {
      console.warn('Invalid MIGRATIONS_SKIP_REGEX, ignoring:', skipRegex);
    }
  }

  let sql = originalSql;

  // Optionally strip trigger/function DDL to be prod-safe
  const strip = String(process.env.MIGRATIONS_STRIP_TRIGGER_DDL || '').toLowerCase();
  if (strip === '1' || strip === 'true' || strip === 'yes') {
    // Remove common trigger/function blocks; keep idempotent table/index changes
    sql = sql
      // Drop CREATE TRIGGER lines
      .replace(/(^|\n)\s*CREATE\s+TRIGGER[\s\S]*?;\s*(?=\n|$)/gi, '\n-- [stripped CREATE TRIGGER]\n')
      // Drop DROP TRIGGER lines
      .replace(/(^|\n)\s*DROP\s+TRIGGER[\s\S]*?;\s*(?=\n|$)/gi, '\n-- [stripped DROP TRIGGER]\n')
      // Drop CREATE OR REPLACE FUNCTION ... RETURNS TRIGGER ... LANGUAGE plpgsql;
      .replace(/(^|\n)\s*CREATE\s+(OR\s+REPLACE\s+)?FUNCTION[\s\S]*?LANGUAGE\s+plpgsql\s*;\s*(?=\n|$)/gi, '\n-- [stripped FUNCTION]\n')
      // Drop DROP FUNCTION lines
      .replace(/(^|\n)\s*DROP\s+FUNCTION[\s\S]*?;\s*(?=\n|$)/gi, '\n-- [stripped DROP FUNCTION]\n');
  }
  return sql;
}

async function applyMigration(name: string, rawSql: string) {
  console.log(`Applying migration: ${name}`);
  try {
    const transformed = maybeTransformSql(name, rawSql);
    if (transformed === null) {
      console.log(`Migration ${name} skipped`);
      await pool.query('INSERT INTO app_migrations (name) VALUES ($1)', [name]);
      return;
    }
    await pool.query('BEGIN');
    await pool.query(transformed);
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
