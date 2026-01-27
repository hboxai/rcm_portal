import crypto from 'crypto';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

// Configuration
const REFRESH_TOKEN_LENGTH = 64;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const MAX_REFRESH_TOKENS_PER_USER = 5; // Limit active tokens per user

export interface RefreshTokenData {
  id: number;
  userId: number;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Generate a cryptographically secure refresh token
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(REFRESH_TOKEN_LENGTH).toString('hex');
}

/**
 * Hash a refresh token for storage (never store plain tokens)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Store a refresh token in the database
 */
export async function storeRefreshToken(
  userId: number,
  token: string,
  userAgent?: string,
  ipAddress?: string
): Promise<void> {
  const hashedToken = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  try {
    // First, clean up old tokens for this user (keep only last N-1 to make room for new one)
    await pool.query(
      `DELETE FROM rcm_portal_refresh_tokens 
       WHERE user_id = $1 
       AND id NOT IN (
         SELECT id FROM rcm_portal_refresh_tokens 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2
       )`,
      [userId, MAX_REFRESH_TOKENS_PER_USER - 1]
    );

    // Store the new token
    await pool.query(
      `INSERT INTO rcm_portal_refresh_tokens 
       (user_id, token_hash, expires_at, user_agent, ip_address) 
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, hashedToken, expiresAt, userAgent, ipAddress]
    );

    logger.debug({ userId }, 'Refresh token stored');
  } catch (error) {
    logger.error({ error, userId }, 'Failed to store refresh token');
    throw error;
  }
}

/**
 * Validate a refresh token and return user ID if valid
 */
export async function validateRefreshToken(token: string): Promise<number | null> {
  const hashedToken = hashToken(token);

  try {
    const result = await pool.query(
      `SELECT user_id, expires_at FROM rcm_portal_refresh_tokens 
       WHERE token_hash = $1 AND expires_at > NOW() AND revoked_at IS NULL`,
      [hashedToken]
    );

    if (result.rows.length === 0) {
      logger.debug('Refresh token not found or expired');
      return null;
    }

    return result.rows[0].user_id;
  } catch (error) {
    logger.error({ error }, 'Failed to validate refresh token');
    return null;
  }
}

/**
 * Revoke a specific refresh token
 */
export async function revokeRefreshToken(token: string): Promise<boolean> {
  const hashedToken = hashToken(token);

  try {
    const result = await pool.query(
      `UPDATE rcm_portal_refresh_tokens 
       SET revoked_at = NOW() 
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hashedToken]
    );

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    logger.error({ error }, 'Failed to revoke refresh token');
    return false;
  }
}

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 */
export async function revokeAllUserTokens(userId: number): Promise<void> {
  try {
    await pool.query(
      `UPDATE rcm_portal_refresh_tokens 
       SET revoked_at = NOW() 
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );

    logger.info({ userId }, 'All refresh tokens revoked for user');
  } catch (error) {
    logger.error({ error, userId }, 'Failed to revoke all user tokens');
    throw error;
  }
}

/**
 * Rotate a refresh token - revoke old and issue new
 * This is the secure way to use refresh tokens
 */
export async function rotateRefreshToken(
  oldToken: string,
  userAgent?: string,
  ipAddress?: string
): Promise<{ newToken: string; userId: number } | null> {
  const hashedOldToken = hashToken(oldToken);

  try {
    // Get user ID and verify token in a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Validate and get user ID
      const result = await client.query(
        `SELECT user_id FROM rcm_portal_refresh_tokens 
         WHERE token_hash = $1 AND expires_at > NOW() AND revoked_at IS NULL`,
        [hashedOldToken]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const userId = result.rows[0].user_id;

      // Revoke old token
      await client.query(
        `UPDATE rcm_portal_refresh_tokens 
         SET revoked_at = NOW() 
         WHERE token_hash = $1`,
        [hashedOldToken]
      );

      // Generate and store new token
      const newToken = generateRefreshToken();
      const hashedNewToken = hashToken(newToken);
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      await client.query(
        `INSERT INTO rcm_portal_refresh_tokens 
         (user_id, token_hash, expires_at, user_agent, ip_address) 
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, hashedNewToken, expiresAt, userAgent, ipAddress]
      );

      await client.query('COMMIT');

      logger.debug({ userId }, 'Refresh token rotated');
      return { newToken, userId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error({ error }, 'Failed to rotate refresh token');
    return null;
  }
}

/**
 * Clean up expired tokens (call periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  try {
    const result = await pool.query(
      `DELETE FROM rcm_portal_refresh_tokens 
       WHERE expires_at < NOW() OR revoked_at IS NOT NULL`
    );

    const deleted = result.rowCount ?? 0;
    if (deleted > 0) {
      logger.info({ deleted }, 'Cleaned up expired refresh tokens');
    }
    return deleted;
  } catch (error) {
    logger.error({ error }, 'Failed to cleanup expired tokens');
    return 0;
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);
