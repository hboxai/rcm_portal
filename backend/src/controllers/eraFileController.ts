import { Request, Response } from 'express';
import pool from '../config/db.js';
import { uploadToS3, getPresignedGetUrl, deleteFromS3 } from '../services/s3.js';
import { parseEraPdf } from '../services/pdfParser.js';

const ERA_BUCKET = process.env.S3_BUCKET || '';

export const uploadEraFilesGlobal = async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, message: 'No files uploaded.' });
  }
  if (!ERA_BUCKET) {
    return res.status(500).json({ success: false, message: 'S3_BUCKET is not configured on server' });
  }
  const username = (req as any).user?.username || 'system';
  const userId = (req as any).user?.id || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created: any[] = [];

    for (const file of files) {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `era/global/${Date.now()}-${safeName}`;
      const contentType = file.mimetype || 'application/pdf';

      const { s3Url } = await uploadToS3({ bucket: ERA_BUCKET, key, body: file.buffer, contentType });
      const ins = await client.query(
        `INSERT INTO era_files (claim_id, original_filename, content_type, size_bytes, s3_bucket, s3_key, s3_url, uploaded_by, uploaded_by_id)
         VALUES (NULL,$1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id::text, claim_id::text, original_filename, content_type, size_bytes, s3_bucket, s3_key, s3_url, uploaded_by, uploaded_at`,
        [file.originalname, contentType, file.size || null, ERA_BUCKET, key, s3Url, username, userId]
      );
      created.push(ins.rows[0]);
    }

    await client.query('COMMIT');

    const items = await Promise.all(created.map(async (r) => {
      let url = r.s3_url || '';
      if (r.s3_bucket && r.s3_key) {
        try { url = await getPresignedGetUrl({ bucket: r.s3_bucket, key: r.s3_key, expiresInSeconds: 900 }); } catch {}
      }
      return { ...r, url };
    }));
    return res.status(201).json({ success: true, message: 'ERA PDFs uploaded', data: items });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('uploadEraFilesGlobal error', err);
    return res.status(500).json({ success: false, message: 'Failed to upload ERA PDFs', error: err.message });
  } finally {
    client.release();
  }
};

export const listEraFilesGlobal = async (req: Request, res: Response) => {
  const limit = Math.max(1, Math.min(200, parseInt(String(req.query.limit || '50'), 10)));
  try {
    const r = await pool.query(
      `SELECT id::text, claim_id::text, original_filename, content_type, size_bytes, s3_bucket, s3_key, s3_url, uploaded_by, uploaded_at
       FROM era_files
       WHERE claim_id IS NULL
       ORDER BY uploaded_at DESC
       LIMIT $1`,
      [limit]
    );
    const rows = r.rows;
    const data = await Promise.all(rows.map(async (row: any) => {
      let url = row.s3_url || '';
      if (row.s3_bucket && row.s3_key) {
        try { url = await getPresignedGetUrl({ bucket: row.s3_bucket, key: row.s3_key, expiresInSeconds: 900 }); } catch {}
      }
      return { ...row, url };
    }));
    return res.json({ success: true, data });
  } catch (err: any) {
    console.error('listEraFilesGlobal error', err);
    return res.status(500).json({ success: false, message: 'Failed to list ERA PDFs', error: err.message });
  }
};

export const deleteEraFileGlobal = async (req: Request, res: Response) => {
  const id = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(`SELECT id::text, s3_bucket, s3_key FROM era_files WHERE id=$1 AND claim_id IS NULL`, [id]);
    if (!r.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'ERA file not found' });
    }
    const row = r.rows[0];
    if (row.s3_bucket && row.s3_key) {
      await deleteFromS3({ bucket: row.s3_bucket, key: row.s3_key });
    }
    await client.query(`DELETE FROM era_files WHERE id=$1`, [id]);
    await client.query('COMMIT');
    return res.json({ success: true });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('deleteEraFileGlobal error', err);
    return res.status(500).json({ success: false, message: 'Failed to delete ERA PDF', error: err.message });
  } finally {
    client.release();
  }
};

export const autoParseEraFile = async (req: Request, res: Response) => {
  const eraFileId = req.params.id;
  const username = (req as any).user?.username || 'system';
  const userId = (req as any).user?.id || null;

  const client = await pool.connect();
  try {
    // Get ERA file record
    const fileResult = await client.query(
      `SELECT id::text, s3_bucket, s3_key, original_filename FROM era_files WHERE id=$1`,
      [eraFileId]
    );
    if (!fileResult.rowCount) {
      return res.status(404).json({ success: false, message: 'ERA file not found' });
    }
    const eraFile = fileResult.rows[0];

    // Parse the PDF
    console.log(`Auto-parsing ERA PDF: ${eraFile.original_filename}`);
    const rows = await parseEraPdf(eraFile.s3_bucket, eraFile.s3_key);

    if (rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No claim data found in PDF. The PDF may be in an unsupported format or contain no recognizable claim information.' 
      });
    }

    // Create parse batch
    await client.query('BEGIN');
    const batchInsert = await client.query(
      `INSERT INTO era_parse_batches (era_file_id, parsed_by, parsed_by_id, row_count, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id::text, era_file_id::text, parsed_by, parsed_at, row_count, status`,
      [eraFileId, username, userId, rows.length]
    );
    const batch = batchInsert.rows[0];
    const batchId = batch.id;

    // Insert parsed rows
    for (const row of rows) {
      await client.query(
        `INSERT INTO era_parse_rows 
         (batch_id, submit_cpt_id, billing_id, patient_id, cpt_code, dos, 
          prim_amt, prim_chk_det, prim_recv_dt, sec_amt, pat_amt, 
          allowed_amt, write_off_amt, claim_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          batchId,
          row.submit_cpt_id || null,
          row.billing_id || null,
          row.patient_id || null,
          row.cpt_code || null,
          row.dos || null,
          row.prim_amt || null,
          row.prim_chk_det || null,
          row.prim_recv_dt || null,
          row.sec_amt || null,
          row.pat_amt || null,
          row.allowed_amt || null,
          row.write_off_amt || null,
          row.claim_status || null
        ]
      );
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `Auto-parsed ${rows.length} claim rows from PDF`,
      data: {
        batch,
        rowCount: rows.length
      }
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('autoParseEraFile error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to auto-parse ERA PDF', 
      error: err.message 
    });
  } finally {
    client.release();
  }
};
