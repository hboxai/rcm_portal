import pool from '../config/db.js';

async function quickReset() {
  console.log('Starting database reset...');
  
  const tables = [
    'rcm_portal_auth_users',
    'rcm_portal_users', 
    'upl_change_logs',
    'api_bil_claim_reimburse',
    'api_hboxuser',
    'app_migrations'
  ];
  
  for (const table of tables) {
    try {
      await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`Dropped: ${table}`);
    } catch (e: any) {
      console.log(`Skip: ${table} - ${e.message.split('\n')[0]}`);
    }
  }
  
  console.log('Reset complete!');
  process.exit(0);
}

quickReset();
