import pool from './db.js';

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
        AND table_name = 'upl_change_logs'
      );
    `;
    
    const tableExists = await pool.query(tableCheckQuery);
    
    // If upl_change_logs table doesn't exist, create it
    if (!tableExists.rows[0].exists) {
      console.log('Creating upl_change_logs table...');
      
      const createTableQuery = `
        CREATE TABLE upl_change_logs (
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
      console.log('upl_change_logs table created successfully');
    } else {
      console.log('upl_change_logs table already exists');
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