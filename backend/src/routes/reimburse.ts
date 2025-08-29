import { Router } from 'express';
import pool from '../config/db.js';
import { z } from 'zod';

const router = Router();

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
