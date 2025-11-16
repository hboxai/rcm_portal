import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

let sslEnabled = process.env.DB_SSL_ENABLED === 'true';
// Auto-enable SSL for Aptible tunnels if not explicitly disabled
if (!sslEnabled && process.env.DB_HOST?.endsWith('.aptible.in')) {
  console.log('Auto-enabling SSL because host appears to be an Aptible tunnel.');
  sslEnabled = true;
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: sslEnabled ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    require: true
  } : false,
});

async function runMigration(migrationFile: string) {
  const migrationPath = path.join(__dirname, 'src', 'migrations', migrationFile);
  
  if (!fs.existsSync(migrationPath)) {
    console.log(`❌ Migration file not found: ${migrationFile}`);
    return false;
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  console.log(`\n🔄 Running migration: ${migrationFile}`);
  
  try {
    await pool.query(sql);
    console.log(`✅ Successfully ran: ${migrationFile}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error running ${migrationFile}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('=== Starting Database Migrations ===\n');
  
  const migrations = [
    '006_add_submit_system_columns.sql',
    '023_rename_primary_key_to_claim_id.sql',
    '024_add_unique_constraints_cpt_code_ids.sql',
    '025_modify_upl_change_logs.sql',
  ];

  let successCount = 0;
  let failCount = 0;

  for (const migration of migrations) {
    const success = await runMigration(migration);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n=== Migration Summary ===');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Total: ${migrations.length}`);

  // Verify changes
  console.log('\n=== Verifying Schema Changes ===');
  
  try {
    // Check api_bil_claim_submit columns
    const submitCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'api_bil_claim_submit'
        AND column_name IN ('claim_id', 'upload_id', 'cpt_code_id1', 'cpt_code_id2')
      ORDER BY column_name;
    `);
    console.log('\n✅ api_bil_claim_submit columns:');
    console.table(submitCols.rows);

    // Check unique constraints
    const constraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'api_bil_claim_submit'
        AND constraint_name LIKE 'uq_cpt_code_id%'
      ORDER BY constraint_name;
    `);
    console.log('\n✅ Unique constraints on CPT Code IDs:');
    console.table(constraints.rows);

    // Check upl_change_logs columns
    const logCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'upl_change_logs'
      ORDER BY ordinal_position;
    `);
    console.log('\n✅ upl_change_logs columns:');
    console.table(logCols.rows);

  } catch (error: any) {
    console.error('❌ Error verifying schema:', error.message);
  }

  await pool.end();
}

main().catch(console.error);
