#!/usr/bin/env node

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootEnvPath = join(__dirname, '../../.env');
dotenv.config({ path: rootEnvPath });

let sslEnabled = process.env.DB_SSL_ENABLED === 'true';
if (!sslEnabled && process.env.DB_HOST?.endsWith('.aptible.in')) {
  sslEnabled = true;
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: sslEnabled ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
  } : false
});

async function searchSubmitTables() {
  try {
    const result = await pool.query(`
      SELECT 
        table_schema,
        table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
      AND (
        table_name ILIKE '%submit%'
        OR table_name ILIKE '%bill%'
        OR table_name ILIKE '%claim%'
      )
      ORDER BY table_name;
    `);

    console.log('\n===== TABLES CONTAINING "submit", "bill", or "claim" =====\n');
    
    if (result.rows.length === 0) {
      console.log('No matching tables found.');
    } else {
      result.rows.forEach(row => {
        console.log(`  ${row.table_schema}.${row.table_name}`);
      });
    }

    console.log(`\n\nTotal matching tables: ${result.rows.length}\n`);
    
  } catch (error) {
    console.error('Error searching tables:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

searchSubmitTables();
