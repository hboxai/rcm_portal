import pool from '../config/db.js';

// Script to check the schema of api_bil_claim_reimburse table (legacy upl_billing_reimburse removed)
async function checkTableSchema() {
  try {
    console.log('Checking schema for api_bil_claim_reimburse table...');
    
    const query = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'api_bil_claim_reimburse'
      ORDER BY ordinal_position;
    `;
    
    const result = await pool.query(query);
    
    console.log('Table schema:');
    console.table(result.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking table schema:', error);
    process.exit(1);
  }
}

checkTableSchema();
