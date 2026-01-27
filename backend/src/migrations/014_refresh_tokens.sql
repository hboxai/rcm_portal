-- Migration: Create refresh tokens table
-- Version: 014
-- Description: Add table for JWT refresh token storage with rotation support

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

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON rcm_portal_refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON rcm_portal_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON rcm_portal_refresh_tokens(expires_at);

-- Comment on table
COMMENT ON TABLE rcm_portal_refresh_tokens IS 'Stores hashed refresh tokens for JWT token rotation';
COMMENT ON COLUMN rcm_portal_refresh_tokens.token_hash IS 'SHA256 hash of the refresh token (never store plain tokens)';
COMMENT ON COLUMN rcm_portal_refresh_tokens.revoked_at IS 'When token was revoked (null = active)';
