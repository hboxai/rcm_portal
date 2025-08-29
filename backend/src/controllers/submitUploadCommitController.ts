import { Request, Response } from 'express';
import pool from '../config/db.js';
import { downloadFromS3 } from '../services/s3.js';
import XLSX from 'xlsx';
import crypto from 'crypto';
import { alias, norm as normHdr } from '../utils/headerMap.js';
import { coerce, colType } from '../utils/coerce.js';
import { mirrorReimburseForUpload } from '../services/reimburse.js';

// Required fields refer to mapped property names (see headerMap values)
const REQUIRED_MAPPED = [
  'insurerid','patientlast','patientfirst','patientdob',
  'insuranceplanname','insurancepayerid',
  'fromdateofservice1','cpt1','charges1'
];

// headerMap replaced by rule-driven mapper (alias + auto-match)

const norm = (s: any) => String(s ?? '').normalize('NFKC').trim();
const key = (s: any) => norm(s).replace(/\s+/g, '').toLowerCase();

// Note: date handling is in coerce() to preserve display strings and avoid timezone shifts.

function mapRow(excelRow: Record<string, any>, schemaColumns: Set<string>, warnings: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [hdr, rawVal] of Object.entries(excelRow)) {
    const k = normHdr(String(hdr));
    const key = alias[k] ?? k; // alias or normalized
    if (!schemaColumns.has(key)) {
      if (warnings.length < 200) warnings.push(`Unmapped header: "${hdr}"`);
      continue;
    }
    const t = colType[key] ?? 'text';
    const val = coerce(rawVal, t as any);
    if (rawVal != null && val === null && String(rawVal).trim() !== '') {
      if (warnings.length < 200) warnings.push(`Coercion failed: header="${hdr}" value="${rawVal}" → ${t}`);
    }
    out[key] = val;
  }
  // derive totals
  if ((out['units1'] == null || out['units1'] === '') && out['cpt1']) out['units1'] = 1;
  if ((out['charges1'] == null || out['charges1'] === '') && out['totalcharges'] != null) {
    const u = Number(out['units1'] ?? 1);
    const tnum = Number(out['totalcharges']);
    if (isFinite(tnum) && isFinite(u) && u > 0) out['charges1'] = tnum / u;
  }
  return out;
}

// Best-sheet selection for Excel files: choose the sheet with the most matches for required groups
const SHEET_SYNONYMS: Record<string, string[]> = {
  patient_id: ['PatientID','Patient Id','PatientId','Patient #','Patient Number'],
  patientfirst: ['PatientFirst','Patient First','PatientFirstName','FirstName','First Name'],
  patientlast: ['PatientLast','Patient Last','PatientLastName','LastName','Last Name'],
  patientdob: ['PatientDOB','DOB','DateOfBirth','Date of Birth','Birth Date'],
  fromdateofservice1: ['FromDateOfService1','From DOS1','From DOS','Service Start','ServiceDate1','DateOfService','DOS','Service Date'],
  cpt1: ['CPT1','CPT','CPT Code','CPT-1'],
  charges1: ['Charges1','Charge1','Charge Amount','ChargeAmt1','Charge Amount 1','Charge','Amount'],
};

const nk = (s: string) => s.normalize('NFKC').trim().replace(/\s+/g,'').toLowerCase();

function scoreSheetHeaders(headers: string[]): number {
  const set = new Set(headers.map(nk));
  let score = 0;
  for (const arr of Object.values(SHEET_SYNONYMS)) {
    const any = arr.some(h => set.has(nk(h)));
    if (any) score++;
  }
  return score;
}

function pickBestSheet(wb: XLSX.WorkBook): { sheetName: string; rows: any[]; headers: string[] } {
  let best: { name: string; rows: any[]; headers: string[]; score: number } | null = null;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, blankrows: false });
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const score = scoreSheetHeaders(headers);
    if (!best || score > best.score) best = { name, rows, headers, score };
  }
  if (!best) {
    const name = wb.SheetNames[0];
    const ws = wb.Sheets[name];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, blankrows: false });
    const headers = rows.length ? Object.keys(rows[0]) : [];
    return { sheetName: name, rows, headers };
  }
  return { sheetName: best.name, rows: best.rows, headers: best.headers };
}

function hasRequiredMapped(row: Record<string, any>): boolean {
  // minimal set
  for (const r of ['insurerid','patientlast','patientfirst','patientdob','fromdateofservice1','cpt1','charges1']) {
    if (!(r in row)) return false;
    const v = row[r];
    if (v == null || v === '') return false;
  }
  // insurance: allow either payer ID or plan name
  const hasPayerId = row.insurancepayerid != null && row.insurancepayerid !== '';
  const hasPlanName = row.insuranceplanname != null && row.insuranceplanname !== '';
  if (!hasPayerId && !hasPlanName) return false;
  return true;
}

function listMissingFields(row: Record<string, any>): string[] {
  const missing: string[] = [];
  const must = ['insurerid','patientlast','patientfirst','patientdob','fromdateofservice1','cpt1','charges1'];
  for (const k of must) if (!(k in row) || row[k] == null || row[k] === '') missing.push(k);
  const hasPayerId = row.insurancepayerid != null && row.insurancepayerid !== '';
  const hasPlanName = row.insuranceplanname != null && row.insuranceplanname !== '';
  if (!hasPayerId && !hasPlanName) missing.push('insurancepayerid|insuranceplanname');
  return missing;
}

async function findExistingSubmit(client: any, keys: { payor_reference_id?: string | null; oa_claimid?: string | null; clinic_id?: any; insurerid?: any; fromdateofservice1?: any; cpt1?: any; totalcharges?: any; }) {
  if (keys.payor_reference_id) {
    const r = await client.query('SELECT bil_claim_submit_id FROM api_bil_claim_submit WHERE payor_reference_id=$1 LIMIT 1', [keys.payor_reference_id]);
    if (r.rowCount) return r.rows[0].bil_claim_submit_id;
  }
  if (keys.oa_claimid) {
    const r = await client.query('SELECT bil_claim_submit_id FROM api_bil_claim_submit WHERE oa_claimid=$1 LIMIT 1', [keys.oa_claimid]);
    if (r.rowCount) return r.rows[0].bil_claim_submit_id;
  }
  const r = await client.query(
    `SELECT bil_claim_submit_id FROM api_bil_claim_submit
     WHERE COALESCE(clinic_id::text,'')=COALESCE($1::text,'')
     AND COALESCE(insurerid::text,'')=COALESCE($2::text,'')
       AND fromdateofservice1::date = $3::date
       AND COALESCE(cpt1::text,'')=COALESCE($4::text,'')
       AND COALESCE(totalcharges::numeric,0)=COALESCE($5::numeric,0)
     LIMIT 1`,
   [keys.clinic_id ?? null, keys.insurerid ?? null, keys.fromdateofservice1 ?? null, keys.cpt1 ?? null, keys.totalcharges ?? null]
  );
  return r.rowCount ? r.rows[0].bil_claim_submit_id : null;
}

type ColumnInfo = { data_type: string; max_length: number | null };
type ColumnTypes = Record<string, ColumnInfo>;

async function getTableColumnTypes(client: any, tableName: string, schema = 'public'): Promise<ColumnTypes> {
  const r = await client.query(
    `SELECT column_name, data_type, character_maximum_length
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2`,
    [schema, tableName]
  );
  const map: ColumnTypes = {};
  for (const row of r.rows) map[String(row.column_name)] = { data_type: String(row.data_type), max_length: row.character_maximum_length == null ? null : Number(row.character_maximum_length) };
  return map;
}

function sanitizeByType(row: Record<string, any>, colTypes: ColumnTypes): { clean: Record<string, any>; notes: string[] } {
  const clean: Record<string, any> = { ...row };
  const notes: string[] = [];
  const isInt = (t: string) => ['integer','bigint','smallint'].includes(t);
  const isNum = (t: string) => ['numeric','decimal','double precision','real'].includes(t);
  for (const [k, v] of Object.entries(row)) {
    const info = colTypes[k];
    if (!info || v == null || v === '') continue;
    const t = info.data_type;
    if (isInt(t)) {
      if (typeof v === 'number' && Number.isInteger(v)) continue;
      const s = String(v).trim();
      if (/^[+-]?\d+$/.test(s)) {
        clean[k] = Number(s);
      } else {
        clean[k] = null;
        notes.push(`Field ${k}: non-integer value '${s}' set to null`);
      }
    } else if (isNum(t)) {
      if (typeof v === 'number' && Number.isFinite(v)) continue;
      const s = String(v).trim().replace(/[^0-9.\-]/g, '');
      const n = s === '' ? NaN : Number(s);
      if (!Number.isNaN(n)) clean[k] = n; else { clean[k] = null; notes.push(`Field ${k}: non-numeric value '${v}' set to null`); }
    } else if ((t === 'character varying' || t === 'character' || t === 'char') && info.max_length != null) {
      // Handle varchar/char with max length, especially length=1 flag columns
      let s = v;
      if (typeof s === 'boolean') {
        s = s ? 'Y' : 'N';
      } else {
        const sv = String(s).trim();
        if (info.max_length === 1) {
          if (/^(y|yes|true|1)$/i.test(sv)) s = 'Y';
          else if (/^(n|no|false|0)$/i.test(sv)) s = 'N';
          else if (/^(male|m)$/i.test(sv)) s = 'M';
          else if (/^(female|f)$/i.test(sv)) s = 'F';
          else s = sv ? sv[0].toUpperCase() : null;
        } else {
          s = sv;
        }
      }
      if (typeof s === 'string' && info.max_length != null && s.length > info.max_length) {
        notes.push(`Field ${k}: value truncated to ${info.max_length} chars`);
        s = s.slice(0, info.max_length);
      }
      clean[k] = s;
    }
  }
  return { clean, notes };
}

export async function commitSubmitUpload(req: Request, res: Response) {
  const t0 = Date.now();
  const { upload_id } = req.body || {};
  if (!upload_id) return res.status(400).json({ error: 'upload_id required' });

  try {
    const up = await pool.query(
      `SELECT upload_id, file_kind, status, s3_bucket, s3_key, s3_url, clinic
       FROM rcm_file_uploads WHERE upload_id=$1 LIMIT 1`,
      [upload_id]
    );
    if (!up.rowCount) return res.status(422).json({ error: 'Upload not found' });
    const row = up.rows[0];
    if (row.file_kind !== 'SUBMIT_EXCEL') return res.status(422).json({ error: 'Wrong upload kind' });
    if (row.status !== 'COMPLETED') return res.status(422).json({ error: 'Upload status not COMPLETED' });

    // Fetch file content
    const bucket = row.s3_bucket;
    const keyObj = row.s3_key;
    if (!bucket || !keyObj) return res.status(422).json({ error: 'Upload has no S3 location' });
    const buf = await downloadFromS3({ bucket, key: keyObj });

    // Parse
  // Read dates as formatted text to avoid JS Date timezone shifts
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: false, raw: false });
  const { rows, headers } = pickBestSheet(wb);
  const normHeaders = headers.map(h => ({ raw: h, k: key(h) }));

    // Build a case-insensitive projection using headerMap
    const inserts: number[] = [];
    const updates: number[] = [];
    let skipped = 0;
    const warnings: string[] = [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
  const colTypes = await getTableColumnTypes(client, 'api_bil_claim_submit');
  const schemaColumns = new Set(Object.keys(colTypes));

      for (let i = 0; i < rows.length; i++) {
  const raw = rows[i];
  const mapped = mapRow(raw, schemaColumns, warnings);

        // sensible defaults and computed fields
        if (mapped.units1 == null || mapped.units1 === '') mapped.units1 = 1;
        if (mapped.totalcharges == null || mapped.totalcharges === '') {
          const c = Number(mapped.charges1 ?? 0);
          const u = Number(mapped.units1 ?? 1);
          const total = isFinite(c) && isFinite(u) ? c * u : mapped.charges1 ?? null;
          mapped.totalcharges = total;
        }

        // system fields
        mapped.upload_id = upload_id;
        mapped.source_system = 'OFFICE_ALLY';

        if (!hasRequiredMapped(mapped)) {
          skipped++;
          if (warnings.length < 50) {
            const miss = listMissingFields(mapped);
            warnings.push(`Row ${i+2} skipped: missing ${miss.join(', ')}`);
          }
          continue;
        }

        // Business key
  const business = {
          payor_reference_id: mapped.payor_reference_id ?? null,
          oa_claimid: mapped.oa_claimid ?? null,
          clinic_id: mapped.clinic_id ?? null,
          insurerid: mapped.insurerid,
          fromdateofservice1: mapped.fromdateofservice1,
          cpt1: mapped.cpt1,
          totalcharges: mapped.totalcharges,
        };

        let existingId = await findExistingSubmit(client, business);
        // Fallback idempotency per upload via content hash of business subset
        let contentHash: string | null = null;
        if (!existingId) {
          const subset = {
            upload_id,
            insurerid: mapped.insurerid,
            fromdateofservice1: mapped.fromdateofservice1,
            cpt1: mapped.cpt1,
            totalcharges: mapped.totalcharges,
          };
          contentHash = crypto.createHash('sha256').update(JSON.stringify(subset)).digest('hex');
          const er = await client.query('SELECT bil_claim_submit_id FROM api_bil_claim_submit WHERE upload_id=$1 AND content_sha256=$2 LIMIT 1', [upload_id, contentHash]);
          if (er.rowCount) existingId = er.rows[0].bil_claim_submit_id;
        }
        // type sanitization against DB column types
        const { clean, notes } = sanitizeByType(mapped, colTypes);
        if (notes.length) {
          const remain = 100 - warnings.length;
          if (remain > 0) warnings.push(...notes.slice(0, remain).map(n => `Row ${i+2}: ${n}`));
        }

  // Ensure idempotency metadata
  if (!('upload_id' in clean)) clean.upload_id = upload_id;
  if (!('source_system' in clean)) clean.source_system = 'OFFICE_ALLY';
  if (contentHash && !('content_sha256' in clean)) clean.content_sha256 = contentHash;

  const cols = Object.keys(clean);
  const vals = Object.values(clean);

        if (!existingId) {
          const colSql = cols.map(c => '"'+c+'"').join(',');
          const ph = vals.map((_, idx) => `$${idx + 1}`).join(',');
          const sql = `INSERT INTO api_bil_claim_submit (${colSql}) VALUES (${ph}) RETURNING bil_claim_submit_id`;
          const r = await client.query(sql, vals);
          inserts.push(r.rows[0].bil_claim_submit_id);
        } else {
          const setSql = cols.map((c, idx) => '"'+c+'"' + `=$${idx + 1}`).join(',');
          const sql = `UPDATE api_bil_claim_submit SET ${setSql} WHERE bil_claim_submit_id=$${cols.length + 1}`;
          await client.query(sql, [...vals, existingId]);
          updates.push(existingId);
        }
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

  // Mirror into reimburse table for this upload (per-CPT lines, idempotent)
  const mirror = await mirrorReimburseForUpload(upload_id);
  const duration = Date.now() - t0;
    const inserted_count = inserts.length;
    const updated_count = updates.length;
    const skipped_count = skipped;

  const msg = `Committed ${inserted_count + updated_count} rows (inserted ${inserted_count}, updated ${updated_count}, skipped ${skipped_count}); Reimburse: created=${mirror.created}, updated=${mirror.updated}, deleted=${mirror.deleted}`;
    await pool.query(
      `UPDATE rcm_file_uploads
         SET message=$1,
             row_count=COALESCE(row_count, $2),
             status='COMPLETED',
             processing_completed_at=NOW()
       WHERE upload_id=$3`,
      [msg, inserted_count + updated_count, upload_id]
    );

    return res.status(200).json({
      upload_id,
      inserted_count,
      updated_count,
      skipped_count,
      warnings,
      duration_ms: duration,
      reimburse: {
        submit_rows: mirror.submit_rows,
        created: mirror.created,
        updated: mirror.updated,
        deleted: mirror.deleted,
        samples: mirror.samples,
      }
    });
  } catch (err: any) {
    console.error('commitSubmitUpload error:', err);
    try {
      if (upload_id) {
        await pool.query(
          `UPDATE rcm_file_uploads SET status='FAILED', message=$1 WHERE upload_id=$2`,
          [String(err?.message || 'Commit failed'), upload_id]
        );
      }
    } catch {}
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
