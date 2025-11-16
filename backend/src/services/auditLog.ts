import pool from '../config/db.js';

/**
 * Log audit entries to upl_change_logs table
 */

interface ChangeLogEntry {
  claim_id: number;
  username: string;
  upload_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  action_type?: string;
}

/**
 * Log a single "claim_created" entry for a new claim
 */
export async function logClaimCreated(
  claimId: number,
  uploadId: string,
  username: string = 'SYSTEM'
): Promise<void> {
  const sql = `
    INSERT INTO upl_change_logs (claim_id, username, upload_id, field_name, old_value, new_value, action_type, timestamp)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
  `;
  
  await pool.query(sql, [
    claimId,
    username,
    uploadId,
    'claim_created',
    null,
    'New claim inserted',
    'CREATE'
  ]);
}

/**
 * Log multiple field changes for an existing claim
 */
export async function logFieldChanges(
  claimId: number,
  uploadId: string,
  changes: Array<{ field: string; oldValue: any; newValue: any }>,
  username: string = 'SYSTEM'
): Promise<void> {
  if (changes.length === 0) return;

  const values: any[] = [];
  const placeholders: string[] = [];
  
  let paramIndex = 1;
  for (const change of changes) {
    placeholders.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, NOW())`
    );
    
    values.push(
      claimId,
      username,
      uploadId,
      change.field,
      change.oldValue == null ? null : String(change.oldValue),
      change.newValue == null ? null : String(change.newValue),
      'UPDATE'
    );
    
    paramIndex += 7;
  }

  const sql = `
    INSERT INTO upl_change_logs (claim_id, username, upload_id, field_name, old_value, new_value, action_type, timestamp)
    VALUES ${placeholders.join(', ')}
  `;
  
  await pool.query(sql, values);
}

/**
 * Batch log changes for multiple claims
 */
export async function logBatchChanges(
  entries: ChangeLogEntry[],
  username: string = 'SYSTEM'
): Promise<void> {
  if (entries.length === 0) return;

  const values: any[] = [];
  const placeholders: string[] = [];
  
  let paramIndex = 1;
  for (const entry of entries) {
    placeholders.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, NOW())`
    );
    
    values.push(
      entry.claim_id,
      entry.username || username,
      entry.upload_id,
      entry.field_name,
      entry.old_value,
      entry.new_value,
      entry.action_type || 'UPDATE'
    );
    
    paramIndex += 7;
  }

  const sql = `
    INSERT INTO upl_change_logs (claim_id, username, upload_id, field_name, old_value, new_value, action_type, timestamp)
    VALUES ${placeholders.join(', ')}
  `;
  
  await pool.query(sql, values);
}

/**
 * Get change history for a claim
 */
export async function getClaimHistory(claimId: number, limit: number = 100): Promise<any[]> {
  const sql = `
    SELECT change_log_id, claim_id, username, upload_id, field_name, old_value, new_value, action_type, timestamp
    FROM upl_change_logs
    WHERE claim_id = $1
    ORDER BY timestamp DESC
    LIMIT $2
  `;
  
  const result = await pool.query(sql, [claimId, limit]);
  return result.rows;
}

/**
 * Get all changes from a specific upload
 */
export async function getUploadChanges(uploadId: string, limit: number = 1000): Promise<any[]> {
  const sql = `
    SELECT change_log_id, claim_id, username, upload_id, field_name, old_value, new_value, action_type, timestamp
    FROM upl_change_logs
    WHERE upload_id = $1
    ORDER BY timestamp DESC
    LIMIT $2
  `;
  
  const result = await pool.query(sql, [uploadId, limit]);
  return result.rows;
}
