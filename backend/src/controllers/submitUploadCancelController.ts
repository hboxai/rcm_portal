import { Request, Response } from 'express';
import pool from '../config/db.js';
import { deleteFromS3 } from '../services/s3.js';

// Mark a submit upload as FAILED if user cancels before commit.
// Only applies to SUBMIT_EXCEL uploads that are not already COMMITTED.
export async function cancelSubmitUpload(req: Request, res: Response) {
  try {
    const { upload_id } = req.body || {};
    if (!upload_id) return res.status(400).json({ error: 'upload_id required' });

    const r = await pool.query(
      `SELECT upload_id, file_kind, status, s3_bucket, s3_key FROM rcm_file_uploads WHERE upload_id=$1 LIMIT 1`,
      [upload_id]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Upload not found' });
    const row = r.rows[0];
    if (row.file_kind !== 'SUBMIT_EXCEL') return res.status(400).json({ error: 'Wrong upload kind' });

  if (row.status === 'COMPLETED') {
      return res.status(409).json({ error: 'Already committed; cannot cancel' });
    }

    // If already FAILED, treat as idempotent success; otherwise set to FAILED
  if (row.status !== 'FAILED') {
      await pool.query(
        `UPDATE rcm_file_uploads
           SET status='FAILED', message=$1, processing_completed_at=COALESCE(processing_completed_at, NOW())
         WHERE upload_id=$2`,
        ['Cancelled by user before commit', upload_id]
      );
    }
  // Best-effort S3 cleanup
  await deleteFromS3({ bucket: row.s3_bucket, key: row.s3_key });

  // Return current status after update
  const st = await pool.query(`SELECT status FROM rcm_file_uploads WHERE upload_id=$1`, [upload_id]);
  return res.json({ upload_id, status: st.rows?.[0]?.status || 'FAILED' });
  } catch (err: any) {
    console.error('cancelSubmitUpload error:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
