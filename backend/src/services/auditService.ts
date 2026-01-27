/**
 * Audit Service
 * 
 * Logs sensitive operations for security compliance and monitoring.
 * Stores audit logs in the database for later review.
 */

import { query } from '../config/db.js';

export interface AuditLogEntry {
  userId?: number | string;
  username?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
}

// Audit action types for consistency
export const AuditActions = {
  // Authentication
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  
  // User Management
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  
  // Data Access
  CLAIM_VIEW: 'CLAIM_VIEW',
  CLAIM_SEARCH: 'CLAIM_SEARCH',
  CLAIM_EXPORT: 'CLAIM_EXPORT',
  
  // File Operations
  FILE_UPLOAD: 'FILE_UPLOAD',
  FILE_DOWNLOAD: 'FILE_DOWNLOAD',
  FILE_DELETE: 'FILE_DELETE',
  
  // Admin Operations
  SETTINGS_CHANGE: 'SETTINGS_CHANGE',
  BULK_OPERATION: 'BULK_OPERATION',
} as const;

export type AuditAction = typeof AuditActions[keyof typeof AuditActions];

/**
 * Log an audit event to the database
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO rcm_portal_audit_logs 
       (user_id, username, action, resource, resource_id, details, ip_address, user_agent, status, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        entry.userId || null,
        entry.username || null,
        entry.action,
        entry.resource,
        entry.resourceId || null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ipAddress || null,
        entry.userAgent || null,
        entry.status,
        entry.errorMessage || null,
      ]
    );
  } catch (error) {
    // Don't throw - audit logging should never break the main operation
    console.error('Failed to write audit log:', error);
  }
}

/**
 * Query audit logs with filters
 */
export async function getAuditLogs(filters: {
  userId?: number;
  action?: string;
  resource?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ logs: any[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(filters.userId);
  }
  if (filters.action) {
    conditions.push(`action = $${paramIndex++}`);
    params.push(filters.action);
  }
  if (filters.resource) {
    conditions.push(`resource = $${paramIndex++}`);
    params.push(filters.resource);
  }
  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }
  if (filters.startDate) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filters.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM rcm_portal_audit_logs ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get logs
  const logsResult = await query(
    `SELECT * FROM rcm_portal_audit_logs ${whereClause} 
     ORDER BY created_at DESC 
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return {
    logs: logsResult.rows,
    total,
  };
}

/**
 * Helper to extract client info from request
 */
export function getClientInfo(req: any): { ipAddress: string; userAgent: string } {
  const ipAddress = req.ip || 
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
    req.connection?.remoteAddress || 
    'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  return { ipAddress, userAgent };
}

export default {
  logAudit,
  getAuditLogs,
  getClientInfo,
  AuditActions,
};
