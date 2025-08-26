-- Complete database reset script for RCM Portal
-- This will remove ALL tables used by the application

-- Drop tables in reverse dependency order to avoid foreign key constraints

-- Drop portal-specific tables first
DROP TABLE IF EXISTS rcm_portal_auth_users CASCADE;
DROP TABLE IF EXISTS rcm_portal_users CASCADE;

-- Drop change logs table
DROP TABLE IF EXISTS upl_change_logs CASCADE;

-- Drop claims/billing table
DROP TABLE IF EXISTS api_bil_claim_reimburse CASCADE;

-- Drop user table
DROP TABLE IF EXISTS api_hboxuser CASCADE;

-- Drop migration tracking
DROP TABLE IF EXISTS app_migrations CASCADE;

-- Drop any triggers and functions that might exist
DROP FUNCTION IF EXISTS trg_touch_updated_at() CASCADE;

-- Clean up any sequences that might be left behind
DROP SEQUENCE IF EXISTS api_hboxuser_id_seq CASCADE;
DROP SEQUENCE IF EXISTS api_bil_claim_reimburse_id_seq CASCADE;
DROP SEQUENCE IF EXISTS upl_change_logs_id_seq CASCADE;
DROP SEQUENCE IF EXISTS rcm_portal_auth_users_id_seq CASCADE;

-- Verify tables are gone
SELECT 'Tables remaining:' as status;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND (
    table_name LIKE 'api_%' 
    OR table_name LIKE 'rcm_%' 
    OR table_name LIKE 'upl_%'
    OR table_name = 'app_migrations'
  );

PRINT 'Database reset complete. All RCM Portal tables have been dropped.';
