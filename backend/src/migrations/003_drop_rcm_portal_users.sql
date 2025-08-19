-- Migration: 003_drop_rcm_portal_users.sql
-- Purpose: Remove obsolete extension table now that rcm_portal_auth_users is authoritative.

DROP TABLE IF EXISTS rcm_portal_users CASCADE;
