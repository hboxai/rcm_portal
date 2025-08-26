import pool from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function resetDatabase() {
  console.log('🔥 Starting complete database reset...');
  
  try {
    // Test connection first
    const testResult = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful:', testResult.rows[0]);
    
    console.log('📋 Dropping tables...');
    
    // Drop tables individually with better error handling
    const tablesToDrop = [
      'rcm_portal_auth_users',
      'rcm_portal_users', 
      'upl_change_logs',
      'api_bil_claim_reimburse',
      'api_hboxuser',
      'app_migrations'
    ];
    
    for (const table of tablesToDrop) {
      try {
        await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`✅ Dropped table: ${table}`);
      } catch (error: any) {
        console.log(`⚠️  Table ${table}: ${error.message}`);
      }
    }
    
    // Drop functions and sequences
    try {
      await pool.query('DROP FUNCTION IF EXISTS trg_touch_updated_at() CASCADE');
      console.log('✅ Dropped function: trg_touch_updated_at');
    } catch (error: any) {
      console.log(`⚠️  Function: ${error.message}`);
    }
    
    // Check remaining tables
    const remaining = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND (
          table_name LIKE 'api_%' 
          OR table_name LIKE 'rcm_%' 
          OR table_name LIKE 'upl_%'
          OR table_name = 'app_migrations'
        )
    `);
    
    if (remaining.rows.length === 0) {
      console.log('✅ Database reset completed successfully!');
      console.log('🎉 All RCM Portal tables have been removed');
    } else {
      console.log('⚠️  Some tables still remain:');
      remaining.rows.forEach((row: any) => console.log(`  - ${row.table_name}`));
    }
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    throw error;
  }
}

// Run the reset if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  resetDatabase()
    .then(() => {
      console.log('✨ Reset complete - exiting');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Reset failed:', error);
      process.exit(1);
    });
}

export default resetDatabase;
