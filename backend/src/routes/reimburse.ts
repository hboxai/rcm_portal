import { Router } from 'express';
import pool from '../config/db.js';
import { z } from 'zod';
import multer from 'multer';
import { uploadReimburseExcel } from '../controllers/reimburseUploadController.js';
import { previewReimburseUpload } from '../controllers/reimburseUploadPreviewController.js';
import { commitReimburseUpload } from '../controllers/reimburseUploadCommitController.js';

const router = Router();

// Multer configuration for Excel uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const validExts = ['.xlsx', '.xls', '.csv'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (validExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, and .csv files are allowed'));
    }
  }
});

// POST /api/reimburse/upload-excel - Upload reimbursement Excel file (old method)
router.post('/upload-excel', upload.single('file'), uploadReimburseExcel);

// POST /api/reimburse/preview - Preview reimburse upload (new method)
router.post('/preview', upload.single('file'), previewReimburseUpload);

// POST /api/reimburse/commit - Commit reimburse upload (new method)
router.post('/commit', commitReimburseUpload);

// New: list reimburse uploads from rcm_file_uploads
router.get('/uploads', async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const offset = parseInt(String(req.query.offset ?? '0'), 10) || 0;
    const search = (req.query.search as string | undefined)?.trim();

    const where: string[] = ["file_kind IN ('REIMBURSE_EXCEL','REIMBURSE_PDF')"]; 
    const params: any[] = [];
    if (search) { params.push(`%${search}%`); where.push(`original_filename ILIKE $${params.length}`); }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const totalRes = await pool.query(`SELECT COUNT(*)::int AS total FROM rcm_file_uploads ${whereSql}`, params);
    const total = totalRes.rows[0]?.total ?? 0;

    const itemsRes = await pool.query(
      `SELECT u.upload_id, u.clinic, u.file_kind, u.original_filename, u.row_count, u.status, u.message, u.created_by, u.created_at,
              (SELECT COUNT(*)::int FROM api_bil_claim_reimburse r WHERE r.upload_id = u.upload_id) AS reimburse_count
         FROM rcm_file_uploads u
         ${whereSql}
         ORDER BY u.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const items = itemsRes.rows.map((r: any) => ({
      upload_id: String(r.upload_id),
      clinic: r.clinic ?? '',
      file_kind: r.file_kind as 'REIMBURSE_EXCEL' | 'REIMBURSE_PDF',
      original_filename: r.original_filename ?? '',
      row_count: r.row_count ?? null,
      status: r.status ?? 'PENDING',
      message: r.message ?? null,
      created_by: r.created_by ?? null,
      created_at: r.created_at,
      reimburse_count: r.reimburse_count ?? 0,
    }));

    return res.json({ items, total });
  } catch (err: any) {
    console.error('list reimburse uploads error:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// GET /api/reimburse/search - parity with claims search
router.get('/search', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '10'), 10) || 10));
    const offset = (page - 1) * limit;

    const patient_id = req.query.patient_id ? String(req.query.patient_id) : undefined;
    const prim_ins = req.query.prim_ins ? String(req.query.prim_ins) : undefined;
    const cpt_code = req.query.cpt_code ? String(req.query.cpt_code) : undefined; // maps to cpt_id
    const dos = req.query.dos ? String(req.query.dos) : undefined; // maps to charge_dt
    const upload_id = req.query.upload_id ? String(req.query.upload_id) : undefined;
    const billingId = req.query.billingId ? String(req.query.billingId) : undefined; // maps to submit_claim_id

    const conditions: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (patient_id) { conditions.push(`patient_id = $${i++}`); params.push(patient_id); }
    if (prim_ins)   { conditions.push(`prim_ins ILIKE $${i++}`); params.push(`%${prim_ins}%`); }
    if (cpt_code)   { conditions.push(`cpt_id::text = $${i++}`); params.push(cpt_code.trim()); }
    if (dos)        { conditions.push(`charge_dt = $${i++}::date`); params.push(dos); }
    if (upload_id)  { conditions.push(`upload_id = $${i++}`); params.push(upload_id); }
    if (billingId)  { conditions.push(`submit_claim_id::text = $${i++}`); params.push(billingId.trim()); }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const baseSelect = `
      SELECT 
        r.bil_claim_reimburse_id AS id,
        r.submit_claim_id   AS billing_id,
        r.upload_id,
        r.patient_id,
        r.cpt_id::text          AS cpt_code,
        r.charge_dt,
        r.charge_amt,
        r.allowed_amt,
        r.allowed_add_amt,
        r.allowed_exp_amt,
        r.total_amt,
        r.write_off_amt,
        r.bal_amt,
        r.reimb_pct,
        r.claim_status,
        r.claim_status_type,
        r.prim_ins,
        r.prim_amt,
        r.prim_post_dt,
        r.prim_chk_det,
        r.prim_recv_dt,
        r.prim_chk_amt,
        r.prim_cmt,
        r.sec_ins,
        r.sec_amt,
        r.sec_post_dt,
        r.sec_chk_det,
        r.sec_recv_dt,
        r.sec_chk_amt,
        r.sec_cmt,
        r.sec_denial_code,
        r.pat_amt,
        r.pat_recv_dt,
        r.oa_claim_id,
        r.oa_visit_id,
        r.patient_emr_no,
        r.first_name AS r_first_name,
        r.last_name AS r_last_name,
        r.date_of_birth,
        r.cpt_code AS r_cpt_code,
        r.service_start,
        r.service_end,
        r.icd_code,
        r.units,
        r.provider_name,
        r.charges_adj_amt,
        r.status AS r_status,
  s.patientfirst AS first_name,
  s.patientlast  AS last_name,
  (s.patientfirst || ' ' || s.patientlast) AS patientname,
  s.facilityname,
  s.facilityname AS clinicname,
        s.oa_claimid AS s_oa_claimid,
        s.payor_reference_id
  FROM api_bil_claim_reimburse r
  INNER JOIN api_bil_claim_submit s ON s.claim_id = r.submit_claim_id
      ${whereSql ? whereSql.replace(/\b(\w+)\b/g, (m) => {
        // Qualify unqualified column names in whereSql to r.* to avoid ambiguity
        const cols = ['patient_id','prim_ins','cpt_id','charge_dt','upload_id','submit_claim_id'];
        return cols.includes(m) ? `r.${m}` : m;
      }) : ''}
      ORDER BY r.bil_claim_reimburse_id DESC
      LIMIT $${i} OFFSET $${i + 1}
    `;

    const [rows, count] = await Promise.all([
      pool.query(baseSelect, [...params, limit, offset]),
      pool.query(
        `SELECT COUNT(*)::int AS n 
         FROM api_bil_claim_reimburse r 
         INNER JOIN api_bil_claim_submit s ON s.claim_id = r.submit_claim_id 
         ${whereSql ? whereSql.replace(/\b(\w+)\b/g, (m) => {
           const cols = ['patient_id','prim_ins','cpt_id','charge_dt','upload_id','submit_claim_id'];
           return cols.includes(m) ? `r.${m}` : m;
         }) : ''}
        `,
        params
      )
    ]);

    return res.json({
      success: true,
      data: rows.rows,
      totalCount: count.rows[0]?.n || 0,
      page,
      limit,
      totalPages: Math.ceil((count.rows[0]?.n || 0) / limit)
    });
  } catch (error: any) {
    console.error('Error in reimburse search:', error);
    return res.status(500).json({ success: false, message: 'Failed to search reimburse claims', error: error.message });
  }
});

// GET /api/reimburse?upload_id=UUID&page=1&pageSize=50
router.get('/', async (req, res) => {
  const uploadId = String(req.query.upload_id || '');
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize || '50'), 10) || 50));
  if (!uploadId) return res.status(400).json({ error: 'upload_id required' });
  const offset = (page - 1) * pageSize;
  const [rows, count] = await Promise.all([
    pool.query(
      `SELECT * FROM api_bil_claim_reimburse WHERE upload_id=$1 ORDER BY bil_claim_reimburse_id LIMIT $2 OFFSET $3`,
      [uploadId, pageSize, offset]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS n FROM api_bil_claim_reimburse WHERE upload_id=$1`, [uploadId]
    )
  ]);
  res.json({
    page,
    pageSize,
    total: count.rows[0].n,
    rows: rows.rows,
  });
});

const updatableSchema = z.object({
  allowed_amt: z.number().nullable().optional(),
  allowed_add_amt: z.number().nullable().optional(),
  allowed_exp_amt: z.number().nullable().optional(),
  prim_ins: z.string().nullable().optional(),
  prim_amt: z.number().nullable().optional(),
  prim_post_dt: z.string().datetime().nullable().optional(),
  prim_chk_det: z.string().nullable().optional(),
  prim_recv_dt: z.string().datetime().nullable().optional(),
  prim_chk_amt: z.number().nullable().optional(),
  prim_status: z.string().nullable().optional(),
  prim_denial_code: z.string().nullable().optional(),
  prim_cmt: z.string().nullable().optional(),
  sec_ins: z.string().nullable().optional(),
  sec_amt: z.number().nullable().optional(),
  sec_post_dt: z.string().datetime().nullable().optional(),
  sec_chk_det: z.string().nullable().optional(),
  sec_recv_dt: z.string().datetime().nullable().optional(),
  sec_chk_amt: z.number().nullable().optional(),
  sec_status: z.string().nullable().optional(),
  sec_denial_code: z.string().nullable().optional(),
  sec_cmt: z.string().nullable().optional(),
  pat_pymt_type: z.string().nullable().optional(),
  pat_amt: z.number().nullable().optional(),
  pat_post_dt: z.string().datetime().nullable().optional(),
  pat_recv_dt: z.string().datetime().nullable().optional(),
  total_amt: z.number().nullable().optional(),
  charges_adjust: z.number().nullable().optional(),
  sequestarian_adjust: z.number().nullable().optional(),
  feesschedule_adjust: z.number().nullable().optional(),
  write_off_amt: z.number().nullable().optional(),
  bal_amt: z.number().nullable().optional(),
  reimb_pct: z.number().nullable().optional(),
  claim_status: z.string().nullable().optional(),
  claim_status_type: z.string().nullable().optional(),
  payor_reference_id: z.string().nullable().optional(),
  claim_id: z.string().nullable().optional(),
});

// PUT /api/reimburse/:id
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const parse = updatableSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });

  const fields = parse.data as Record<string, any>;
  if (Object.keys(fields).length === 0) return res.status(400).json({ error: 'No fields to update' });

  const cols = Object.keys(fields);
  const vals = Object.values(fields);
  const setSql = cols.map((c, i) => `${c}=$${i + 1}`).join(',');

  const r = await pool.query(
    `UPDATE api_bil_claim_reimburse SET ${setSql}, updated_at=NOW() WHERE bil_claim_reimburse_id=$${cols.length + 1} RETURNING *`,
    [...vals, id]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
});

export default router;
