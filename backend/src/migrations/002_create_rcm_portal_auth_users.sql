-- Migration: 002_create_rcm_portal_auth_users.sql
-- Purpose: Fully detach portal authentication from legacy api_hboxuser table.
-- New standalone auth table holding credentials + role.

CREATE TABLE IF NOT EXISTS rcm_portal_auth_users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'User', -- 'Admin' | 'User'
  status TEXT NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Uniqueness (case-insensitive email & username)
CREATE UNIQUE INDEX IF NOT EXISTS uq_rcm_portal_auth_users_email ON rcm_portal_auth_users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_rcm_portal_auth_users_username ON rcm_portal_auth_users (LOWER(username));

-- Trigger to maintain updated_at
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
