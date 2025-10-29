import { Request, Response } from 'express';
import pool from '../config/db.js';
import { deleteFromS3 } from '../services/s3.js';

/**
 * Admin-only: Delete a submit upload and all related claims
 * - Writes a compact audit record per deleted submit row into rcm_submit_line_audit
 * - Deletes reimburse rows linked by upload_id or bil_claim_submit_id
 * - Deletes submit rows by upload_id
 * - Hard-deletes the rcm_file_uploads row so it no longer appears in listings
 * - Attempts best-effort S3 object deletion
 */
export async function deleteSubmitUpload(req: Request, res: Response) {
  const { upload_id } = req.params as { upload_id: string };
  const actor = (req.user?.email || req.user?.username || 'system') as string;

  // Validate upload exists and is a submit file
  const meta = await pool.query(
    `SELECT upload_id, file_kind, original_filename, s3_bucket, s3_key
     FROM rcm_file_uploads
     WHERE upload_id=$1 LIMIT 1`,
    [upload_id]
  );
  if (!meta.rowCount) return res.status(404).json({ error: 'Upload not found' });
  const row = meta.rows[0];
  if (row.file_kind !== 'SUBMIT_EXCEL') {
    return res.status(400).json({ error: 'Only SUBMIT_EXCEL uploads can be deleted here' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Count related rows first
    const submitRows = await client.query(
      `SELECT * FROM api_bil_claim_submit WHERE upload_id=$1`,
      [upload_id]
    );
    const submitIds: number[] = submitRows.rows.map((r: any) => Number(r.bil_claim_submit_id));

    // Write compact audit entries (one per submit row) into rcm_submit_line_audit if table exists
    // Use COALESCE of cpt_id1..6 to satisfy NOT NULL submit_cpt_id, skip rows without any cpt_id
    try {
      await client.query(
        `INSERT INTO rcm_submit_line_audit (
            submit_cpt_id, bil_claim_submit_id, line_index, cycle, upload_id, changed_by, hash_old, hash_new, old_line, new_line, diff
         )
         SELECT
           COALESCE(s.cpt_id1,s.cpt_id2,s.cpt_id3,s.cpt_id4,s.cpt_id5,s.cpt_id6) AS submit_cpt_id,
           s.bil_claim_submit_id,
           0 AS line_index,
           COALESCE(s.cycle,1) AS cycle,
           s.upload_id,
           $1::text AS changed_by,
           NULL::text AS hash_old,
           NULL::text AS hash_new,
           to_jsonb(s) AS old_line,
           NULL::jsonb AS new_line,
           jsonb_build_object('action','deleted_upload','reason','admin_delete') AS diff
         FROM api_bil_claim_submit s
         WHERE s.upload_id=$2 AND COALESCE(s.cpt_id1,s.cpt_id2,s.cpt_id3,s.cpt_id4,s.cpt_id5,s.cpt_id6) IS NOT NULL`,
        [actor, upload_id]
      );
    } catch (e: any) {
      // If audit table doesn't exist, skip silently
      if (String(e?.code) !== '42P01') throw e;
    }

    // Delete reimburse rows linked to this upload or to the submit ids
    let reimburseDeleted = 0;
    try {
      const delReimburse = await client.query(
        `DELETE FROM api_bil_claim_reimburse
         WHERE upload_id=$1 OR ($2::bigint[] IS NOT NULL AND bil_claim_submit_id = ANY($2::bigint[]))`,
        [upload_id, submitIds.length ? submitIds : null]
      );
      reimburseDeleted = delReimburse.rowCount || 0;
    } catch (e: any) {
      // If reimburse table missing, continue deleting submit rows
      if (String(e?.code) !== '42P01') throw e;
    }

    // Delete submit rows
    const delSubmit = await client.query(
      `DELETE FROM api_bil_claim_submit WHERE upload_id=$1`,
      [upload_id]
    );
    const submitDeleted = delSubmit.rowCount || submitRows.rowCount || 0;

    // Remove the file upload row entirely so it no longer appears in lists
    await client.query(
      `DELETE FROM rcm_file_uploads WHERE upload_id=$1`,
      [upload_id]
    );

    await client.query('COMMIT');

    // Best-effort S3 delete (outside transaction)
    await deleteFromS3({ bucket: row.s3_bucket, key: row.s3_key });

    return res.json({ success: true, upload_id, deleted: { submit: submitDeleted, reimburse: reimburseDeleted } });
  } catch (err: any) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('deleteSubmitUpload error:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  } finally {
    client.release();
  }
}
