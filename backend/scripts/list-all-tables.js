#!/usr/bin/env node

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from root .env file
const rootEnvPath = join(__dirname, '../../.env');
dotenv.config({ path: rootEnvPath });

// Database configuration
let sslEnabled = process.env.DB_SSL_ENABLED === 'true';
// Auto-enable SSL for Aptible tunnels
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

async function listAllTables() {
  try {
    const result = await pool.query(`
      SELECT 
        table_schema,
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_schema = t.table_schema AND table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `);

    console.log('\n===== ALL DATABASE TABLES =====\n');
    
    if (result.rows.length === 0) {
      console.log('No tables found.');
    } else {
      const tablesBySchema = {};
      
      result.rows.forEach(row => {
        if (!tablesBySchema[row.table_schema]) {
          tablesBySchema[row.table_schema] = [];
        }
        tablesBySchema[row.table_schema].push(row);
      });

      for (const schema of Object.keys(tablesBySchema).sort()) {
        console.log(`\n[Schema: ${schema}]`);
        tablesBySchema[schema].forEach(row => {
          console.log(`  ├─ ${row.table_name} (${row.column_count} columns)`);
        });
      }
    }

    console.log('\n================================\n');
    console.log(`Total tables: ${result.rows.length}`);
    
  } catch (error) {
    console.error('Error listing tables:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

listAllTables();
