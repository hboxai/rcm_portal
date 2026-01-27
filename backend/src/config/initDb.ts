import pool from './db.js';
import createAuditLogsTable from '../migrations/createAuditLogsTable.js';

/**
 * Create refresh tokens table for JWT refresh token rotation
 */
const createRefreshTokensTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS rcm_portal_refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES rcm_portal_auth_users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      revoked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
      user_agent TEXT,
      ip_address VARCHAR(45)
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON rcm_portal_refresh_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON rcm_portal_refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON rcm_portal_refresh_tokens(expires_at);
  `;
  
  await pool.query(createTableQuery);
  console.log('Refresh tokens table created or already exists');
};

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
    
    // Create audit logs table
    await createAuditLogsTable();
    
    // Create refresh tokens table for JWT refresh token rotation
    await createRefreshTokensTable();
    
    return { success: true };
  } catch (error) {
    console.error('Database initialization failed:', error);
    return { success: false, error };
  }
};

export default initializeDatabase;