import pool from './db.js';
const CLAIM_HISTORY_TABLE = process.env.CLAIM_HISTORY_TABLE || 'upl_change_logs';

/**
 * Database initialization script
 * Creates necessary tables if they don't exist
 */
export const initializeDatabase = async () => {
  console.log('Running database initialization...');
  
  try {
    // Check if upl_change_logs table exists
  const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
    AND table_name = '${CLAIM_HISTORY_TABLE}'
      );
    `;
    
    const tableExists = await pool.query(tableCheckQuery);
    
    // If upl_change_logs table doesn't exist, create it
    if (!tableExists.rows[0].exists && CLAIM_HISTORY_TABLE === 'upl_change_logs') {
      console.log(`Creating ${CLAIM_HISTORY_TABLE} table...`);
      
      const createTableQuery = `
  CREATE TABLE ${CLAIM_HISTORY_TABLE} (
          id SERIAL PRIMARY KEY,
          claim_id INTEGER NOT NULL,
          user_id INTEGER,
          username VARCHAR(255),
          cpt_id INTEGER,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          field_name VARCHAR(100) NOT NULL,
          old_value TEXT,
          new_value TEXT,
          action_type VARCHAR(20) CHECK (action_type IN ('created', 'updated', 'deleted'))
        );
      `;
      
      await pool.query(createTableQuery);
  console.log(`${CLAIM_HISTORY_TABLE} table created successfully`);
    } else {
  console.log(`${CLAIM_HISTORY_TABLE} table already exists (or using external history table)`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Database initialization failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export default initializeDatabase;