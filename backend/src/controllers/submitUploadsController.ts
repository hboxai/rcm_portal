import { Request, Response } from 'express';
import pool from '../config/db.js';
import { getPresignedGetUrl, downloadFromS3, headObject } from '../services/s3.js';
import { processSubmitUpload } from '../services/submitProcessor.js';
import { getClaimHistory, getUploadChanges } from '../services/auditLog.js';

// New: fetch submit claims across all uploads with optional filters
export async function getAllSubmitClaims(req: Request, res: Response) {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
    const offset = (page - 1) * limit;

  const claimId = (req.query.claimId as string | undefined)?.trim();
  const billingId = (req.query.billingId as string | undefined)?.trim();
  const patientId = (req.query.patientId as string | undefined)?.trim();
  const patientName = (req.query.patientName as string | undefined)?.trim();
  const clinicName = (req.query.clinicName as string | undefined)?.trim();
  const dateOfBirth = (req.query.dateOfBirth as string | undefined)?.trim();
  const payerName = (req.query.payerName as string | undefined)?.trim();
  const cptCode = (req.query.cptCode as string | undefined)?.trim();
    // Status is not reliably present on submit table; accept but ignore safely
    // const status = (req.query.status as string | undefined)?.trim();

    const where: string[] = [];
    const params: any[] = [];
    if (claimId) { params.push(`%${claimId}%`); where.push(`CAST(oa_claimid AS TEXT) ILIKE $${params.length}`); }
    if (billingId) { params.push(`%${billingId}%`); where.push(`CAST(claim_id AS TEXT) ILIKE $${params.length}`); }
    if (patientId) { params.push(`%${patientId}%`); where.push(`CAST(patient_id AS TEXT) ILIKE $${params.length}`); }
  if (patientName) { params.push(`%${patientName}%`); where.push(`(COALESCE(patientfirst,'') || ' ' || COALESCE(patientlast,'')) ILIKE $${params.length}`); }
    if (clinicName) { params.push(`%${clinicName}%`); where.push(`COALESCE(facilityname,'') ILIKE $${params.length}`); }
    if (dateOfBirth) { params.push(dateOfBirth); where.push(`patientdob = $${params.length}::date`); }
    if (payerName) { params.push(`%${payerName}%`); where.push(`COALESCE(insuranceplanname,'') ILIKE $${params.length}`); }
    if (cptCode) {
      // Search across cpt_code_id1..cpt_code_id6
      const param = `%${cptCode}%`;
      const base = params.length;
      params.push(param, param, param, param, param, param);
      where.push(`(COALESCE(cpt_code_id1,'') ILIKE $${base + 1} OR COALESCE(cpt_code_id2,'') ILIKE $${base + 2} OR COALESCE(cpt_code_id3,'') ILIKE $${base + 3} OR COALESCE(cpt_code_id4,'') ILIKE $${base + 4} OR COALESCE(cpt_code_id5,'') ILIKE $${base + 5} OR COALESCE(cpt_code_id6,'') ILIKE $${base + 6})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalSql = `SELECT COUNT(*)::int AS total FROM api_bil_claim_submit ${whereSql}`;
    const totalRes = await pool.query(totalSql, params);
    const total = totalRes.rows[0]?.total ?? 0;

    const rowsSql = `
      SELECT claim_id, patientfirst, patientlast, patient_id, insuranceplanname, insurancepayerid,
        oa_claimid, payor_reference_id, totalcharges, cpt_code_id1,
        facilityname, payor_status, cycle
      FROM api_bil_claim_submit
      ${whereSql}
      ORDER BY claim_id
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const rowsRes = await pool.query(rowsSql, [...params, limit, offset]);

    const data = rowsRes.rows.map((r: any) => ({
      claimId: String(r.claim_id),
      oa_claim_id: r.oa_claimid ?? null,
      payor_reference_id: r.payor_reference_id ?? null,
      patientfirst: r.patientfirst ?? '',
      patientlast: r.patientlast ?? '',
      patient_id: r.patient_id ?? '',
      prim_ins: r.insuranceplanname ?? '',
      cpt_code: r.cpt_code_id1 ?? '',
      total_amt: r.totalcharges ?? 0,
      claim_status: '',
      cycle: r.cycle ?? 1,
      // pass-throughs for preview card
      facilityname: r.facilityname ?? null,
      payor_status: r.payor_status ?? null,
    }));

    return res.json({ data, totalCount: total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err: any) {
    console.error('getAllSubmitClaims error:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}

// New: fetch a single submit claim row by ID (all columns)
export async function getSubmitClaimById(req: Request, res: Response) {
  try {
    const idRaw = (req.params as any).id;
    const id = parseInt(String(idRaw), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const r = await pool.query(`SELECT * FROM api_bil_claim_submit WHERE claim_id=$1 LIMIT 1`, [id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
    return res.json({ data: r.rows[0] });
  } catch (err: any) {
    console.error('getSubmitClaimById error:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}

export async function listSubmitUploads(req: Request, res: Response) {
  try {
    const clinic = (req.query.clinic as string | undefined)?.trim();
    const status = (req.query.status as string | undefined)?.trim();
    const search = (req.query.search as string | undefined)?.trim();
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const offset = parseInt(String(req.query.offset ?? '0'), 10) || 0;

    const where: string[] = ["file_kind='SUBMIT_EXCEL'"];
    const params: any[] = [];
    if (clinic) { params.push(`%${clinic}%`); where.push(`COALESCE(clinic,'') ILIKE $${params.length}`); }
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (search) { params.push(`%${search}%`); where.push(`original_filename ILIKE $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalSql = `SELECT COUNT(*)::int AS total FROM rcm_file_uploads ${whereSql}`;
    const totalRes = await pool.query(totalSql, params);
    const total = totalRes.rows[0]?.total ?? 0;

    // items with claims_count
    const itemsSql = `
      SELECT
        u.upload_id,
        u.clinic,
        u.file_kind,
        u.original_filename,
        u.row_count,
        u.status,
        u.message,
        u.created_by,
        u.created_at,
        (
          SELECT COUNT(*)::int FROM api_bil_claim_submit s WHERE s.upload_id = u.upload_id
        ) AS claims_count
      FROM rcm_file_uploads u
      ${whereSql}
      ORDER BY u.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const itemsRes = await pool.query(itemsSql, [...params, limit, offset]);

    const items = itemsRes.rows.map((r: any) => ({
      upload_id: String(r.upload_id),
      clinic: r.clinic ?? '',
      file_kind: 'SUBMIT_EXCEL' as const,
      original_filename: r.original_filename ?? '',
      row_count: r.row_count ?? null,
      status: r.status ?? 'PENDING',
      message: r.message ?? null,
      created_by: r.created_by ?? null,
      created_at: r.created_at,
      claims_count: r.claims_count ?? 0,
    }));

    return res.json({ items, total });
  } catch (err: any) {
    console.error('listSubmitUploads error:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}

export async function getSubmitUploadDownloadUrl(req: Request, res: Response) {
  try {
    const { upload_id } = req.params as { upload_id: string };
    const r = await pool.query(
      `SELECT s3_bucket, s3_key, file_kind FROM rcm_file_uploads WHERE upload_id=$1 AND s3_bucket IS NOT NULL AND s3_key IS NOT NULL LIMIT 1`,
      [upload_id]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Upload not found or missing S3 location' });
    const { s3_bucket, s3_key, file_kind } = r.rows[0];
    if (file_kind !== 'SUBMIT_EXCEL') return res.status(400).json({ error: 'Unsupported file kind' });
    const head = await headObject({ bucket: s3_bucket, key: s3_key });
    if (!('exists' in head) || head.exists !== true) {
      return res.status(410).json({ error: 'S3 object missing' });
    }
    const url = await getPresignedGetUrl({ bucket: s3_bucket, key: s3_key, expiresInSeconds: 900 });
    return res.json({ url });
  } catch (err: any) {
    console.error('getSubmitUploadDownloadUrl error:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}

// Optional server-side preview that reads from S3 and parses limited rows
export async function serverPreviewFromS3(req: Request, res: Response) {
  try {
    const { upload_id } = req.params as { upload_id: string };
    const rows = Math.min(parseInt(String(req.query.rows ?? '100'), 10) || 100, 1000);
    const r = await pool.query(
      `SELECT original_filename, s3_bucket, s3_key, file_kind FROM rcm_file_uploads WHERE upload_id=$1 AND s3_bucket IS NOT NULL AND s3_key IS NOT NULL LIMIT 1`,
      [upload_id]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Upload not found or missing S3 location' });
    const { original_filename, s3_bucket, s3_key, file_kind } = r.rows[0];
    if (file_kind !== 'SUBMIT_EXCEL') return res.status(400).json({ error: 'Unsupported file kind' });
    const head = await headObject({ bucket: s3_bucket, key: s3_key });
    if (!('exists' in head) || head.exists !== true) {
      return res.status(410).json({ error: 'S3 object missing' });
    }

    const buf = await downloadFromS3({ bucket: s3_bucket, key: s3_key });
    // Parse via SheetJS
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheetNames: string[] = wb.SheetNames || [];
    const firstSheet = wb.Sheets[sheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false });
    const headers: string[] = (raw[0] as string[]) || [];
    const outRows: any[] = [];
    for (let i = 1; i < raw.length && outRows.length < rows; i++) {
      const line = raw[i] as any[];
      if (!line || !line.some(v => v != null && String(v).trim() !== '')) continue;
      const obj: any = {};
      headers.forEach((h, idx) => { obj[h] = line?.[idx] ?? ''; });
      outRows.push(obj);
    }
    return res.json({ upload_id, original_filename, sheet_names: sheetNames, columns: headers, rows: outRows });
  } catch (err: any) {
    console.error('serverPreviewFromS3 error:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}

export async function getClaimsBySubmitUpload(req: Request, res: Response) {
  try {
    const { upload_id } = req.params as { upload_id: string };
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
    const offset = (page - 1) * limit;

    const totalRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM api_bil_claim_submit WHERE upload_id=$1`,
      [upload_id]
    );
    const total = totalRes.rows[0]?.total ?? 0;

    const rowsRes = await pool.query(
      `SELECT claim_id, patientfirst, patientlast, patient_id, insuranceplanname, insurancepayerid, oa_claimid, payor_reference_id, totalcharges, cpt_code_id1,
       facilityname, payor_status
       FROM api_bil_claim_submit
       WHERE upload_id=$1
       ORDER BY claim_id
       LIMIT $2 OFFSET $3`,
      [upload_id, limit, offset]
    );

  const data = rowsRes.rows.map((r: any) => ({
      claimId: String(r.claim_id),
      oa_claim_id: r.oa_claimid ?? null,
      payor_reference_id: r.payor_reference_id ?? null,
      patientfirst: r.patientfirst ?? '',
      patientlast: r.patientlast ?? '',
      patient_id: r.patient_id ?? '',
      prim_ins: r.insuranceplanname ?? '',
      cpt_code: r.cpt_code_id1 ?? '',
      total_amt: r.totalcharges ?? 0,
      claim_status: '',
      // pass-throughs for preview card
      facilityname: r.facilityname ?? null,
      payor_status: r.payor_status ?? null,
    }));

    return res.json({ data, totalCount: total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err: any) {
    console.error('getClaimsBySubmitUpload error:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}

// New: compute delete impact counts for a submit upload
export async function getSubmitUploadDeleteImpact(req: Request, res: Response) {
  try {
    const { upload_id } = req.params as { upload_id: string };
    // Ensure the upload exists and is a SUBMIT_EXCEL
    const meta = await pool.query(
      `SELECT file_kind FROM rcm_file_uploads WHERE upload_id=$1 LIMIT 1`,
      [upload_id]
    );
    if (!meta.rowCount) return res.status(404).json({ error: 'Upload not found' });
    if (meta.rows[0].file_kind !== 'SUBMIT_EXCEL') {
      return res.status(400).json({ error: 'Only SUBMIT_EXCEL uploads are supported' });
    }

    // Count submit claims
    const submitCountRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM api_bil_claim_submit WHERE upload_id=$1`,
      [upload_id]
    );
    const submit_claims = submitCountRes.rows[0]?.n ?? 0;

    // Count reimburse rows that would be affected
    let reimburse_rows = 0;
    try {
      const reimbRes = await pool.query(
        `WITH s AS (
           SELECT claim_id FROM api_bil_claim_submit WHERE upload_id=$1
         )
         SELECT (
           SELECT COUNT(*)::int FROM api_bil_claim_reimburse r
           WHERE r.upload_id=$1 OR r.claim_id IN (SELECT claim_id FROM s)
         ) AS n`,
        [upload_id]
      );
      reimburse_rows = reimbRes.rows[0]?.n ?? 0;
    } catch (e: any) {
      // If reimburse table missing, treat as zero without failing
      if (String(e?.code) !== '42P01') throw e;
    }

    return res.json({ upload_id, submit_claims, reimburse_rows });
  } catch (err: any) {
    console.error('getSubmitUploadDeleteImpact error:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}

// New: Process a submit upload (parse Excel, detect duplicates, update/insert claims)
export async function processSubmitUploadEndpoint(req: Request, res: Response) {
  try {
    const { upload_id } = req.params as { upload_id: string };
    const username = (req as any).user?.username || 'SYSTEM';

    // Get upload metadata
    const uploadRes = await pool.query(
      `SELECT upload_id, s3_bucket, s3_key, file_kind, status FROM rcm_file_uploads WHERE upload_id=$1 LIMIT 1`,
      [upload_id]
    );

    if (!uploadRes.rowCount) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    const upload = uploadRes.rows[0];

    if (upload.file_kind !== 'SUBMIT_EXCEL') {
      return res.status(400).json({ error: 'Only SUBMIT_EXCEL uploads can be processed' });
    }

    if (!upload.s3_bucket || !upload.s3_key) {
      return res.status(400).json({ error: 'Upload missing S3 location' });
    }

    if (upload.status === 'PROCESSING') {
      return res.status(409).json({ error: 'Upload is already being processed' });
    }

    // Update status to PROCESSING
    await pool.query(
      `UPDATE rcm_file_uploads SET status='PROCESSING', processing_started_at=NOW() WHERE upload_id=$1`,
      [upload_id]
    );

    // Process the upload (async background processing would be better in production)
    const result = await processSubmitUpload(
      upload.upload_id,
      upload.s3_bucket,
      upload.s3_key,
      username
    );

    return res.json({
      upload_id,
      success: result.success,
      processed: result.processed,
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (err: any) {
    console.error('processSubmitUploadEndpoint error:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}

// New: Get change history for a specific claim
export async function getClaimChangeHistory(req: Request, res: Response) {
  try {
    const { claim_id } = req.params as { claim_id: string };
    const claimId = parseInt(claim_id, 10);

    if (!Number.isFinite(claimId)) {
      return res.status(400).json({ error: 'Invalid claim_id' });
    }

    const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10) || 100, 500);
    const history = await getClaimHistory(claimId, limit);

    return res.json({ claim_id: claimId, history });
  } catch (err: any) {
    console.error('getClaimChangeHistory error:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}

// New: Get all changes from a specific upload
export async function getUploadChangeLog(req: Request, res: Response) {
  try {
    const { upload_id } = req.params as { upload_id: string };
    const limit = Math.min(parseInt(String(req.query.limit ?? '1000'), 10) || 1000, 5000);
    
    const changes = await getUploadChanges(upload_id, limit);

    return res.json({ upload_id, changes });
  } catch (err: any) {
    console.error('getUploadChangeLog error:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
