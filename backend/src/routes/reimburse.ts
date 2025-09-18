import { Router } from 'express';
import pool from '../config/db.js';
import { z } from 'zod';

const router = Router();

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
    const billingId = req.query.billingId ? String(req.query.billingId) : undefined; // maps to bil_claim_submit_id

    const conditions: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (patient_id) { conditions.push(`patient_id = $${i++}`); params.push(patient_id); }
    if (prim_ins)   { conditions.push(`prim_ins ILIKE $${i++}`); params.push(`%${prim_ins}%`); }
    if (cpt_code)   { conditions.push(`cpt_id::text = $${i++}`); params.push(cpt_code.trim()); }
    if (dos)        { conditions.push(`charge_dt = $${i++}::date`); params.push(dos); }
    if (upload_id)  { conditions.push(`upload_id = $${i++}`); params.push(upload_id); }
    if (billingId)  { conditions.push(`bil_claim_submit_id::text = $${i++}`); params.push(billingId.trim()); }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const baseSelect = `
      SELECT 
        r.bil_claim_reimburse_id AS id,
        r.bil_claim_submit_id   AS billing_id,
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
        -- Enrichments from submit table
  s.patientfirst AS first_name,
  s.patientlast  AS last_name,
  (s.patientfirst || ' ' || s.patientlast) AS patientname,
  s.facilityname,
  s.facilityname AS clinicname,
        s.oa_claimid,
        s.payor_reference_id
  FROM api_bil_claim_reimburse r
  INNER JOIN api_bil_claim_submit s ON s.bil_claim_submit_id = r.bil_claim_submit_id
      ${whereSql ? whereSql.replace(/\b(\w+)\b/g, (m) => {
        // Qualify unqualified column names in whereSql to r.* to avoid ambiguity
        const cols = ['patient_id','prim_ins','cpt_id','charge_dt','upload_id','bil_claim_submit_id'];
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
         INNER JOIN api_bil_claim_submit s ON s.bil_claim_submit_id = r.bil_claim_submit_id 
         ${whereSql ? whereSql.replace(/\b(\w+)\b/g, (m) => {
           const cols = ['patient_id','prim_ins','cpt_id','charge_dt','upload_id','bil_claim_submit_id'];
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
