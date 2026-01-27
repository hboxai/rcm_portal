/**
 * Migration: Create audit logs table
 * 
 * Stores all audit events for security compliance.
 */

import { query } from '../config/db.js';

export async function createAuditLogsTable(): Promise<{ success: boolean; error?: string }> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS rcm_portal_audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        username VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255),
        details JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'success',
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        -- Index for common queries
        CONSTRAINT valid_status CHECK (status IN ('success', 'failure'))
      )
    `);

    // Create indexes for common query patterns
    await query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON rcm_portal_audit_logs(user_id);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON rcm_portal_audit_logs(action);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON rcm_portal_audit_logs(created_at DESC);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON rcm_portal_audit_logs(resource);
    `);

    console.log('Audit logs table created successfully');
    return { success: true };
  } catch (error) {
    console.error('Failed to create audit logs table:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

export default createAuditLogsTable;
