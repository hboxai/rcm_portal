import pool from './db.js';

/**
 * Database initialization script
 * Creates necessary tables if they don't exist
 */
export const initializeDatabase = async () => {
  console.log('Running database initialization...');
  
  try {
    // Check if rcm_portal_auth_users table exists
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'rcm_portal_auth_users'
      );
    `;
    
    const tableExists = await pool.query(tableCheckQuery);
    
    // If rcm_portal_auth_users table doesn't exist, create it
    if (!tableExists.rows[0].exists) {
      console.log('Creating rcm_portal_auth_users table...');
      
      const createTableQuery = `
        CREATE TABLE rcm_portal_auth_users (
          id SERIAL PRIMARY KEY,
          email TEXT NOT NULL,
          username TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'User',
          status TEXT NOT NULL DEFAULT 'active',
          last_login_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        CREATE UNIQUE INDEX IF NOT EXISTS uq_rcm_portal_auth_users_email ON rcm_portal_auth_users (LOWER(email));
        CREATE UNIQUE INDEX IF NOT EXISTS uq_rcm_portal_auth_users_username ON rcm_portal_auth_users (LOWER(username));
      `;
      
      await pool.query(createTableQuery);
      console.log('rcm_portal_auth_users table created successfully');
      // Optionally create trigger to maintain updated_at in non-production environments
      try {
        const enableTriggers = String(process.env.DB_ENABLE_TRIGGERS || '').toLowerCase();
        if (enableTriggers === '1' || enableTriggers === 'true' || enableTriggers === 'yes') {
          await pool.query(`
            CREATE OR REPLACE FUNCTION trg_touch_updated_at_auth()
            RETURNS TRIGGER AS $$
            BEGIN
              NEW.updated_at = NOW();
              RETURN NEW;
            END;$$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS trg_touch_rcm_portal_auth_users ON rcm_portal_auth_users;
            CREATE TRIGGER trg_touch_rcm_portal_auth_users
            BEFORE UPDATE ON rcm_portal_auth_users
            FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at_auth();
          `);
          console.log('created updated_at trigger for rcm_portal_auth_users');
        } else {
          console.log('DB_ENABLE_TRIGGERS disabled; not creating triggers');
        }
      } catch (e: any) {
        console.warn('Optional trigger creation skipped or failed:', e?.message || e);
      }
    } else {
      console.log('rcm_portal_auth_users table already exists');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Database initialization failed:', error);
    return { success: false, error };
  }
};

export default initializeDatabase;