-- Migration: 001_add_rcm_portal_users.sql
-- Purpose: Create extension table for portal-specific user attributes without modifying the legacy api_hboxuser table.
-- Strategy: Extension pattern (1:1 via FK) so we can later detach from api_hboxuser by moving auth logic progressively.

CREATE TABLE IF NOT EXISTS rcm_portal_users (
  user_id INTEGER PRIMARY KEY REFERENCES api_hboxuser(id) ON DELETE CASCADE,
  portal_role TEXT NOT NULL DEFAULT 'User', -- 'Admin' | 'User'
  status TEXT NOT NULL DEFAULT 'active',    -- 'active' | 'disabled'
  last_login_portal TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rcm_portal_users_status ON rcm_portal_users(status);
CREATE INDEX IF NOT EXISTS idx_rcm_portal_users_portal_role ON rcm_portal_users(portal_role);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION trg_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_rcm_portal_users ON rcm_portal_users;
CREATE TRIGGER trg_touch_rcm_portal_users
BEFORE UPDATE ON rcm_portal_users
FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

-- Seed initial portal rows for existing BA/BU users (idempotent)
INSERT INTO rcm_portal_users (user_id, portal_role)
SELECT u.id, CASE WHEN u.type = 'BA' THEN 'Admin' ELSE 'User' END
FROM api_hboxuser u
LEFT JOIN rcm_portal_users rpu ON rpu.user_id = u.id
WHERE rpu.user_id IS NULL AND (u.type = 'BA' OR u.type = 'BU');
