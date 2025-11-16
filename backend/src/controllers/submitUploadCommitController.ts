import { Request, Response } from 'express';
import pool from '../config/db.js';
import { downloadFromS3, deleteFromS3, uploadToS3 } from '../services/s3.js';
import XLSX from 'xlsx';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { alias, norm as normHdr } from '../utils/headerMap.js';
import { coerce, colType } from '../utils/coerce.js';
import { mirrorReimburseForUpload } from '../services/reimburse.js';

// Required fields refer to mapped property names (see headerMap values)
const REQUIRED_MAPPED = [
  'insurerid','patientlast','patientfirst','patientdob',
  'insuranceplanname','insurancepayerid',
  // row-level validation is relaxed to allow any service line (1..6);
  // per-line checks happen during splitting
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

type ColumnTypeInfo = {
  data_type: string;
  character_maximum_length?: number | null;
  numeric_precision?: number | null;
};

async function getTableColumnTypes(client: any, tableName: string): Promise<Record<string, ColumnTypeInfo>> {
  const q = await client.query(
    `SELECT column_name, data_type, character_maximum_length, numeric_precision
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  const m: Record<string, ColumnTypeInfo> = {};
  for (const r of q.rows) {
    m[r.column_name] = {
      data_type: r.data_type,
      character_maximum_length: r.character_maximum_length,
      numeric_precision: r.numeric_precision,
    };
  }
  return m;
}

function isNumericType(t: string): boolean {
  return /^(integer|bigint|smallint|numeric|decimal|double precision|real)$/i.test(t);
}

function isBooleanType(t: string): boolean {
  return /^(boolean)$/i.test(t);
}

function isDateLikeType(t: string): boolean {
  return /^(date|timestamp|timestamp without time zone|timestamp with time zone)$/i.test(t);
}

// Convert Excel serial date (e.g., 17242) to YYYY-MM-DD (UTC) string
function excelSerialToISO(val: number): string | null {
  if (!Number.isFinite(val)) return null;
  const days = Math.floor(val);
  // Excel's 1900 epoch with the historical bug – use 1899-12-30 base
  const base = Date.UTC(1899, 11, 30);
  const ms = base + days * 86400000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function sanitizeByType(row: Record<string, any>, colTypes: Record<string, ColumnTypeInfo>): { clean: Record<string, any>; notes: string[] } {
  const clean: Record<string, any> = {};
  const notes: string[] = [];
  for (const [k, v] of Object.entries(row)) {
    if (!(k in colTypes)) continue; // ignore extra columns
    const info = colTypes[k];
    let val: any = v;
    if (val === '') val = null;
    if (val != null) {
      const t = info.data_type.toLowerCase();
      if (isNumericType(t)) {
        if (typeof val === 'string') {
          const n = Number(val.replace(/[$,]/g, ''));
          if (!Number.isFinite(n)) {
            notes.push(`Field ${k}: not a number -> NULL`);
            val = null;
          } else {
            val = n;
          }
        } else if (typeof val === 'boolean') {
          val = val ? 1 : 0;
        }
      } else if (isBooleanType(t)) {
        if (typeof val === 'string') {
          const s = val.trim().toLowerCase();
          val = ['1','true','t','yes','y'].includes(s) ? true : ['0','false','f','no','n'].includes(s) ? false : null;
          if (val === null) notes.push(`Field ${k}: invalid boolean -> NULL`);
        }
      } else if (isDateLikeType(t)) {
        // Accept common string date formats as-is; also convert Excel serial numbers
        if (val instanceof Date) {
          val = val.toISOString().slice(0, 10);
        } else if (typeof val === 'number') {
          const iso = excelSerialToISO(val);
          if (iso) val = iso; else notes.push(`Field ${k}: invalid Excel serial date -> NULL`), val = null;
        } else if (typeof val === 'string') {
          const s = val.trim();
          if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s) || /^(\d{1,2})\s*[A-Za-z]{3,}\s*\d{2,4}$/.test(s)) {
            // pass through
            val = s;
          } else if (/^\d+(?:\.\d+)?$/.test(s)) {
            const iso = excelSerialToISO(Number(s));
            if (iso) val = iso; else notes.push(`Field ${k}: invalid Excel serial date -> NULL`), val = null;
          } else {
            // Unknown format: let DB try; if it fails, the row will error – better to null it
            // To be safe, mark as note and null
            notes.push(`Field ${k}: unrecognized date format -> NULL`);
            val = null;
          }
        }
      } else {
        // text-like
        if (typeof val !== 'string') val = String(val);
        const max = info.character_maximum_length ?? undefined;
        if (max && typeof val === 'string' && val.length > max) {
          // Special handling for CHAR(1)/VARCHAR(1) flags to avoid noisy warnings
          if (max === 1) {
            const s = val.trim().toLowerCase();
            if (['1','true','t','yes','y'].includes(s)) {
              val = 'Y';
            } else if (['0','false','f','no','n'].includes(s)) {
              val = 'N';
            } else if (['male','m'].includes(s)) {
              val = 'M';
            } else if (['female','f'].includes(s)) {
              val = 'F';
            } else {
              // Default to first character uppercased
              val = s.charAt(0).toUpperCase();
            }
            // Do not emit a truncation note for expected 1-char normalization
          } else {
            notes.push(`Field ${k}: truncated to ${max} chars`);
            val = val.slice(0, max);
          }
        }
      }
    }
    clean[k] = val;
  }
  return { clean, notes };
}

function hasAnyServiceLine(mapped: Record<string, any>): boolean {
  for (let li = 1; li <= 6; li++) {
    const cpt = mapped[`cpt${li}`];
    const chg = mapped[`charges${li}`];
    const dos = mapped[`fromdateofservice${li}`];
    if (cpt != null && cpt !== '' && chg != null && chg !== '' && dos != null && dos !== '') return true;
  }
  return false;
}

function listMissingForAnyLine(mapped: Record<string, any>): string[] {
  const missing: string[] = [];
  if (!mapped.insurerid) missing.push('insurerid');
  if (!(mapped.patientfirst && mapped.patientlast && mapped.patientdob)) missing.push('patient info');
  if (!(mapped.insurancepayerid || mapped.insuranceplanname)) missing.push('payer id or plan name');
  if (!hasAnyServiceLine(mapped)) missing.push('at least one complete service line');
  return missing;
}

// Deterministic per-line ID generator when input file doesn't supply CPT ID columns
function genLineId(row: Record<string, any>, line: number): string {
  const pref = row.payor_reference_id || row.oa_claimid || row.insurerid || row.patient_id || 'UNK';
  const parts = [
    String(pref ?? ''),
    String(row[`fromdateofservice${line}`] ?? ''),
    String(row[`cpt${line}`] ?? ''),
    String(row[`units${line}`] ?? ''),
    String(row[`charges${line}`] ?? ''),
    String(line)
  ];
  const base = parts.join('|');
  const h = crypto.createHash('sha256').update(base).digest('hex').slice(0, 10);
  const prefix = String(pref ?? 'UNK').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'ID';
  return `${prefix}-${line}-${h}`;
}

/**
 * NO SPLITTING - Each Excel row = 1 submit claim (keeps all CPT1-6 in same row)
 * Reimburse service will extract individual CPT lines using UNION ALL
 */
function prepareClaimFromRow(excelRow: Record<string, any>): Record<string, any> {
  // Return row as-is - no splitting needed
  // Each Excel row becomes 1 claim in api_bil_claim_submit with CPT1-6 populated
  return { ...excelRow };
}

// Canonicalize a line into a stable JSON-ready shape (ordered fields)
function canonicalLine(row: Record<string, any>, i: number): Record<string, any> {
  const out: Record<string, any> = {};
  const keys = [
    `fromdateofservice${i}`,
    `todateofservice${i}`,
    `cpt${i}`,
    `modifiera${i}`,
    `modifierb${i}`,
    `modifierc${i}`,
    `modifierd${i}`,
    `diagcodepointer${i}`,
    `placeofservice${i}`,
    `units${i}`,
    `charges${i}`
  ];
  for (const k of keys) out[k] = row[k] ?? null;
  return out;
}

function hashLine(obj: Record<string, any>): string {
  // Deterministic stringify using known key order from canonicalLine
  const s = JSON.stringify(obj);
  return crypto.createHash('sha256').update(s).digest('hex');
}

function diffLine(oldL: Record<string, any> | null, newL: Record<string, any>): Record<string, [any, any]> {
  const d: Record<string, [any, any]> = {};
  const keys = Object.keys(newL);
  for (const k of keys) {
    const o = oldL ? oldL[k] : undefined;
    const n = newL[k];
    const oNorm = o === '' ? null : o;
    const nNorm = n === '' ? null : n;
    if (oNorm !== nNorm) d[k] = [o, n];
  }
  return d;
}

/**
 * Find existing claim by cpt_code_id1 (split-row model)
 * Returns claim_id if found, null otherwise
 */
async function findClaimByCptCodeId(client: any, cptCodeId: string): Promise<number | null> {
  if (!cptCodeId || String(cptCodeId).trim() === '') return null;
  
  const result = await client.query(
    `SELECT claim_id FROM api_bil_claim_submit WHERE cpt_code_id1 = $1 LIMIT 1`,
    [cptCodeId]
  );
  
  return result.rowCount > 0 ? result.rows[0].claim_id : null;
}

async function findExistingSubmit(client: any, rowObj: Record<string, any>): Promise<number | null> {
  // CPT-ID only matching: find an existing claim whose set of present cpt_id1..6
  // exactly matches the set in the incoming row, ignoring order. No patient/insurer keys.
  const presentCptIds: string[] = [];
  for (let li = 1; li <= 6; li++) {
    // Check both cpt_code_id and cpt_id fields
    const v = rowObj[`cpt_code_id${li}`] || rowObj[`cpt_id${li}`];
    if (v != null && String(v).trim() !== '') presentCptIds.push(String(v));
  }
  if (presentCptIds.length) {
    const targetSig = presentCptIds.slice().sort().join('|');
    const arrParam = presentCptIds;
    const sql = `
      SELECT claim_id, cpt1,cpt2,cpt3,cpt4,cpt5,cpt6,
             cpt_code_id1,cpt_code_id2,cpt_code_id3,cpt_code_id4,cpt_code_id5,cpt_code_id6
        FROM api_bil_claim_submit
       WHERE (cpt1 = ANY($1::text[]) OR cpt2 = ANY($1::text[]) OR cpt3 = ANY($1::text[])
           OR cpt4 = ANY($1::text[]) OR cpt5 = ANY($1::text[]) OR cpt6 = ANY($1::text[])
           OR cpt_code_id1 = ANY($1::text[]) OR cpt_code_id2 = ANY($1::text[]) OR cpt_code_id3 = ANY($1::text[])
           OR cpt_code_id4 = ANY($1::text[]) OR cpt_code_id5 = ANY($1::text[]) OR cpt_code_id6 = ANY($1::text[]))
       ORDER BY claim_id DESC
       LIMIT 100`;
    const cand = await client.query(sql, [arrParam]);
    for (const r of cand.rows) {
      const s: string[] = [];
      for (let li = 1; li <= 6; li++) {
        // Check both cpt_code_id and cpt in database results
        const v = r[`cpt_code_id${li}`] || r[`cpt${li}`];
        if (v != null && String(v).trim() !== '') s.push(String(v));
      }
      if (s.length && s.slice().sort().join('|') === targetSig) {
        return r.claim_id as number;
      }
    }
  }
  return null;
}

export async function commitSubmitUpload(req: Request, res: Response) {
  const t0 = Date.now();
  const { upload_id } = req.body || {};
  console.log('[COMMIT] Starting commit for upload_id:', upload_id);
  if (!upload_id) return res.status(400).json({ error: 'upload_id required' });

  try {
    const up = await pool.query(
      `SELECT upload_id, file_kind, status, s3_bucket, s3_key, s3_url, clinic, temp_file_path, original_filename
       FROM rcm_file_uploads WHERE upload_id=$1 LIMIT 1`,
      [upload_id]
    );
    if (!up.rowCount) return res.status(422).json({ error: 'Upload not found' });
    const row = up.rows[0];
    if (row.file_kind !== 'SUBMIT_EXCEL') return res.status(422).json({ error: 'Wrong upload kind' });
    if (row.status !== 'PENDING' && row.status !== 'COMPLETED') return res.status(422).json({ error: 'Upload status must be PENDING or COMPLETED' });

    let buf: Buffer;
    let bucket: string;
    let keyObj: string;

    // Check if file is in temp storage (preview phase) or already in S3 (re-commit)
    if (row.temp_file_path && fs.existsSync(row.temp_file_path)) {
      // File is in temp storage - upload to S3 now during commit
      console.log('[COMMIT] Uploading from temp storage to S3:', row.temp_file_path);
      
      buf = fs.readFileSync(row.temp_file_path);
      bucket = process.env.S3_BUCKET || '';
      
      // Generate S3 key: submit/{clinic}/{year}/{month}/{upload_id}.ext
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');
      const ext = path.extname(row.original_filename || '.xlsx');
      keyObj = `submit/${row.clinic}/${year}/${month}/${upload_id}${ext}`;
      
      // Upload to S3
      const s3Result = await uploadToS3({ 
        bucket, 
        key: keyObj, 
        body: buf, 
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      // Update database with S3 location
      await pool.query(
        `UPDATE rcm_file_uploads 
         SET s3_bucket=$1, s3_key=$2, s3_url=$3, temp_file_path=NULL, updated_at=NOW() 
         WHERE upload_id=$4`,
        [bucket, keyObj, s3Result.s3Url, upload_id]
      );
      
      // Delete temp file
      try {
        fs.unlinkSync(row.temp_file_path);
        console.log('[COMMIT] Deleted temp file:', row.temp_file_path);
      } catch (err) {
        console.warn('[COMMIT] Failed to delete temp file:', err);
      }
      
      console.log('[COMMIT] File uploaded to S3:', s3Result.s3Url);
    } else if (row.s3_bucket && row.s3_key) {
      // File already in S3 (re-commit or old upload)
      console.log('[COMMIT] Downloading from S3:', row.s3_url);
      bucket = row.s3_bucket;
      keyObj = row.s3_key;
      buf = await downloadFromS3({ bucket, key: keyObj });
    } else {
      return res.status(422).json({ error: 'Upload has no file location (neither temp nor S3)' });
    }

    // Parse workbook
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: false, raw: false });
    const { rows } = pickBestSheet(wb);
    console.log('[COMMIT] Parsed Excel, rows:', rows.length);

    // Debug: Log first row headers to see exact column names
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      console.log('[COMMIT] All headers:', headers);
      console.log('[COMMIT] CPT-related headers:', headers.filter(h => h.toLowerCase().includes('cpt')));
    }

    // Case 14: Re-validate critical data during commit
    let criticalValidationErrors = 0;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const r = rows[i];
      if (!r.PatientFirst || !r.PatientLast || !r.PatientDOB) criticalValidationErrors++;
      if (!r.InsurancePlanName && !r.InsurancePayerID) criticalValidationErrors++;
      if (!r.CPT1 || !r.FromDateOfService1) criticalValidationErrors++;
    }
    if (criticalValidationErrors > 5) {
      await pool.query(
        `UPDATE rcm_file_uploads SET status='FAILED', message='Data validation requirements have changed. Please preview the file again before committing.', updated_at=NOW() WHERE upload_id=$1`,
        [upload_id]
      );
      return res.status(400).json({ status: 'error', message: 'Data validation requirements have changed. Please preview the file again before committing.' });
    }

    // Validate mandatory fields
    const mandatoryFields = [
      'PatientLast',
      'PatientFirst', 
      'PatientDOB',
      'FromDateOfService1',
      'ToDateOfService1',
      'CPT1',
      'CPT CODEID 1'
    ];
    
    const missingFieldErrors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row number (1-indexed + header)
      
      for (const field of mandatoryFields) {
        const value = row[field];
        if (value == null || value === '' || (typeof value === 'string' && value.trim() === '')) {
          missingFieldErrors.push(`Row ${rowNum}: Missing required field "${field}" (value: ${JSON.stringify(value)})`);
        }
      }
      
      // Limit error messages to first 20 to avoid overwhelming response
      if (missingFieldErrors.length >= 20) {
        missingFieldErrors.push(`... and more errors (${rows.length - i - 1} rows remaining)`);
        break;
      }
    }
    
    if (missingFieldErrors.length > 0) {
      console.log('[COMMIT] Validation failed. Available headers:', rows.length > 0 ? Object.keys(rows[0]) : 'No rows');
      console.log('[COMMIT] First 5 errors:', missingFieldErrors.slice(0, 5));
      await pool.query(
        `UPDATE rcm_file_uploads SET status=$1, message=$2, updated_at=NOW() WHERE upload_id=$3`,
        ['FAILED', `Validation failed: Missing mandatory fields\n${missingFieldErrors.join('\n')}`, upload_id]
      );
      return res.status(422).json({ 
        error: 'Validation failed: Missing mandatory fields',
        details: missingFieldErrors 
      });
    }

    // Counters
    const inserts: number[] = [];
    const updates: number[] = [];
    let skipped = 0;
    const warnings: string[] = [];

    // Initialize progress fields
    await pool.query(
      `UPDATE rcm_file_uploads SET row_count=$1, message=$2, updated_at=NOW() WHERE upload_id=$3`,
      [rows.length, `Processing 0/${rows.length} (0%)`, upload_id]
    );

    const client = await pool.connect();
    console.log('[COMMIT] DB client connected, starting transaction');
    try {
      await client.query('BEGIN');
      const colTypes = await getTableColumnTypes(client, 'api_bil_claim_submit');
      const schemaColumns = new Set(Object.keys(colTypes));
      let processed = 0;
      const total = rows.length || 1;
  // Update progress every 1% for real-time feedback
  const progressStep = Math.max(1, Math.floor(total / 100));
      console.log('[COMMIT] Processing', total, 'rows, progress step:', progressStep);
      
      // Optimization: check if table is empty to skip findExistingSubmit queries
      const countResult = await client.query('SELECT COUNT(*) as count FROM api_bil_claim_submit');
      const tableIsEmpty = parseInt(countResult.rows[0].count) === 0;
      console.log('[COMMIT] Table has', countResult.rows[0].count, 'existing rows, empty:', tableIsEmpty);

      // FAST PATH: If table is empty, use bulk INSERT with split-row model
      if (tableIsEmpty) {
        console.log('[COMMIT] Using fast bulk insert path with split-row model');
        const batchSize = 100;
        let claimCount = 0;
        let inserted = 0;
        
        for (let i = 0; i < rows.length; i++) {
          const raw = rows[i];
          const mapped = mapRow(raw, schemaColumns, warnings);
          
          // Basic validation
          const hasPayerId = mapped.insurancepayerid != null && mapped.insurancepayerid !== '';
          const hasPlanName = mapped.insuranceplanname != null && mapped.insuranceplanname !== '';
          const hasInsurer = mapped.insurerid != null && mapped.insurerid !== '';
          const hasPatient = mapped.patientfirst && mapped.patientlast && mapped.patientdob;
          const hasAnyLine = hasAnyServiceLine(mapped);
          
          if (!hasInsurer || !hasPatient || (!hasPayerId && !hasPlanName) || !hasAnyLine) {
            skipped++;
            if (warnings.length < 50) {
              const miss = listMissingForAnyLine(mapped);
              warnings.push(`Row ${i + 2} skipped: missing ${miss.join(', ')}`);
            }
            continue;
          }
          
          // NO SPLIT: Each Excel row = 1 claim (keeps all CPT1-6)
          const rowObj: Record<string, any> = prepareClaimFromRow(mapped);
          rowObj.upload_id = upload_id;
          rowObj.source_system = 'OFFICE_ALLY';
          rowObj.cycle = 1;
          
          // Generate cpt_code_id for each CPT position that has data
          for (let li = 1; li <= 6; li++) {
            if (rowObj[`cpt${li}`] && (!rowObj[`cpt_code_id${li}`] || String(rowObj[`cpt_code_id${li}`]).trim() === '')) {
              rowObj[`cpt_code_id${li}`] = genLineId(rowObj, li);
              rowObj[`cpt_id${li}`] = rowObj[`cpt_code_id${li}`];
            }
            // Set cycle and hash for each populated CPT
            if (rowObj[`cpt${li}`]) {
              rowObj[`cpt_cycle${li}`] = 1;
              const canon = canonicalLine(rowObj, li);
              rowObj[`cpt_hash${li}`] = hashLine(canon);
            }
          }
          
          const { clean } = sanitizeByType(rowObj, colTypes);
          const cols = Object.keys(clean).filter(c => schemaColumns.has(c));
          const vals = cols.map(c => clean[c]);
          
          const colSql = cols.map(c => '"' + c + '"').join(',');
          const ph = vals.map((_, idx) => `$${idx + 1}`).join(',');
          const sql = `INSERT INTO api_bil_claim_submit (${colSql}) VALUES (${ph}) RETURNING claim_id`;
          const r = await client.query(sql, vals);
          inserts.push(r.rows[0].claim_id);
          claimCount++;
          
          // Audit initial state for each CPT line
          for (let li = 1; li <= 6; li++) {
            if (clean[`cpt${li}`] && clean[`cpt_code_id${li}`]) {
              const canon = canonicalLine(clean, li);
              await client.query(
                `INSERT INTO rcm_submit_line_audit (submit_cpt_id, claim_id, line_index, cycle, upload_id, hash_old, hash_new, old_line, new_line, diff)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                [clean[`cpt_code_id${li}`], r.rows[0].claim_id, li, 1, upload_id, null, clean[`cpt_hash${li}`], null, JSON.stringify(canon), JSON.stringify(canon)]
              );
            }
          }
          
          inserted++;
          
          if (claimCount % batchSize === 0) {
            const pct = Math.floor((claimCount / rows.length) * 100);
            await pool.query(
              `UPDATE rcm_file_uploads SET message=$1, updated_at=NOW() WHERE upload_id=$2`,
              [`Bulk inserting ${claimCount} claims from ${i + 1}/${rows.length} rows (${pct}%)`, upload_id]
            );
            console.log(`[COMMIT] Bulk insert progress: ${claimCount} claims from ${i + 1}/${rows.length} rows`);
          }
        }
        
        console.log(`[COMMIT] Bulk insert complete: ${inserts.length} claims from ${rows.length} Excel rows`);
      } else {
        // SLOW PATH: Table has data, check for updates with split-row model
        console.log('[COMMIT] Using row-by-row path with split-row model and update detection');
        
        let inserted = 0;
        let updated = 0;
        const skips: number[] = [];

      for (let i = 0; i < rows.length; i++) {
        if (i === 0 || i === 10 || i === 50 || i % 100 === 0) {
          console.log(`[COMMIT] Processing Excel row ${i + 1}/${total}`);
        }
        const raw = rows[i];
        const mapped = mapRow(raw, schemaColumns, warnings);

        // Basic validation
        const hasPayerId = mapped.insurancepayerid != null && mapped.insurancepayerid !== '';
        const hasPlanName = mapped.insuranceplanname != null && mapped.insuranceplanname !== '';
        const hasInsurer = mapped.insurerid != null && mapped.insurerid !== '';
        const hasPatient = mapped.patientfirst && mapped.patientlast && mapped.patientdob;
        const hasAnyLine = hasAnyServiceLine(mapped);
        
        if (!hasInsurer || !hasPatient || (!hasPayerId && !hasPlanName) || !hasAnyLine) {
          skipped++;
          if (warnings.length < 50) {
            const miss = listMissingForAnyLine(mapped);
            warnings.push(`Row ${i + 2} skipped: missing ${miss.join(', ')}`);
          }
          // Continue to progress tracking
        } else {
          // NO SPLIT: Each Excel row = 1 claim (keeps all CPT1-6)
          const rowObj: Record<string, any> = prepareClaimFromRow(mapped);
          rowObj.upload_id = upload_id;
          rowObj.source_system = 'OFFICE_ALLY';
          
          // Generate cpt_code_id for each CPT position
          const cptCodeIds: string[] = [];
          for (let li = 1; li <= 6; li++) {
            if (rowObj[`cpt${li}`] && (!rowObj[`cpt_code_id${li}`] || String(rowObj[`cpt_code_id${li}`]).trim() === '')) {
              rowObj[`cpt_code_id${li}`] = genLineId(rowObj, li);
              rowObj[`cpt_id${li}`] = rowObj[`cpt_code_id${li}`];
            }
            if (rowObj[`cpt_code_id${li}`]) {
              cptCodeIds.push(rowObj[`cpt_code_id${li}`]);
            }
          }
          
          // Check if ANY of the cpt_code_ids exist (this row exists)
          const existingId = cptCodeIds.length > 0 ? await findClaimByCptCodeId(client, cptCodeIds[0]) : null;
          
          const { clean, notes } = sanitizeByType(rowObj, colTypes);
          if (notes.length) {
            const remain = Math.max(0, 100 - warnings.length);
            if (remain > 0) warnings.push(...notes.slice(0, remain).map((n: string) => `Row ${i + 2}: ${n}`));
          }
          
          const cols = Object.keys(clean).filter(c => schemaColumns.has(c));
          const vals = cols.map(c => clean[c]);
          
          if (!existingId) {
            // INSERT new claim with all CPT lines
            clean.cycle = 1;
            for (let li = 1; li <= 6; li++) {
              if (clean[`cpt${li}`]) {
                clean[`cpt_cycle${li}`] = 1;
                const canon = canonicalLine(clean, li);
                clean[`cpt_hash${li}`] = hashLine(canon);
              }
            }
            
            const insertCols = Object.keys(clean).filter(c => schemaColumns.has(c));
            const insertVals = insertCols.map(c => clean[c]);
            
            const colSql = insertCols.map(c => '"' + c + '"').join(',');
            const ph = insertVals.map((_, idx) => `$${idx + 1}`).join(',');
            const sql = `INSERT INTO api_bil_claim_submit (${colSql}) VALUES (${ph}) RETURNING claim_id`;
            const r = await client.query(sql, insertVals);
            inserts.push(r.rows[0].claim_id);
            
            // Audit each CPT line
            const newId = r.rows[0].claim_id;
            for (let li = 1; li <= 6; li++) {
              if (clean[`cpt${li}`] && clean[`cpt_code_id${li}`]) {
                const canon = canonicalLine(clean, li);
                await client.query(
                  `INSERT INTO rcm_submit_line_audit (submit_cpt_id, claim_id, line_index, cycle, upload_id, hash_old, hash_new, old_line, new_line, diff)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                  [clean[`cpt_code_id${li}`], newId, li, 1, upload_id, null, clean[`cpt_hash${li}`], null, JSON.stringify(canon), JSON.stringify(canon)]
                );
              }
            }
            inserted++;
          } else {
            // UPDATE existing claim - fetch old data for comparison
            const oldData = await client.query(
              `SELECT * FROM api_bil_claim_submit WHERE claim_id=$1`,
              [existingId]
            );
            const oldRow = oldData.rows[0] || {};
            
            // Check if anything actually changed
            let hasChanges = false;
            const fieldsToTrack = cols.filter(c => !['upload_id', 'source_system', 'created_at', 'updated_at'].includes(c));
            for (const col of fieldsToTrack) {
              const oldVal = oldRow[col];
              const newVal = clean[col];
              const oldStr = oldVal == null ? '' : String(oldVal);
              const newStr = newVal == null ? '' : String(newVal);
              if (oldStr !== newStr) {
                hasChanges = true;
                break;
              }
            }
            
            if (!hasChanges) {
              // No changes, skip (Case 5: three-way logic)
              skips.push(existingId);
              skipped++;
            } else {
              // Has changes, UPDATE (Case 5: three-way logic)
              const setSql = cols.map((c, idx) => '"' + c + '"' + `=$${idx + 1}`).join(',');
              await client.query(
                `UPDATE api_bil_claim_submit SET ${setSql} WHERE claim_id=$${cols.length + 1}`,
                [...vals, existingId]
              );
              updates.push(existingId);
              updated++;
              
              // Update cycle and hash for each changed CPT line
              for (let li = 1; li <= 6; li++) {
                if (clean[`cpt${li}`]) {
                  const newCanon = canonicalLine(clean, li);
                  const newHash = hashLine(newCanon);
                  await client.query(
                    `UPDATE api_bil_claim_submit 
                     SET cpt_cycle${li} = COALESCE(cpt_cycle${li}, 1) + 1, 
                         cpt_hash${li} = $1, 
                         cpt_updated_at${li} = NOW(),
                         cycle = COALESCE(cycle, 1) + 1
                     WHERE claim_id = $2`,
                    [newHash, existingId]
                  );
                  
                  // Audit line change
                  const oldCanon = canonicalLine(oldRow, li);
                  const oldHash = oldRow[`cpt_hash${li}`] || null;
                  const diff = diffLine(oldCanon, newCanon);
                  const newCycle = await client.query(`SELECT cpt_cycle${li} FROM api_bil_claim_submit WHERE claim_id=$1`, [existingId]);
                  const lineCycle = Number(newCycle.rows[0]?.[`cpt_cycle${li}`] || 1);
                  
                  if (clean[`cpt_code_id${li}`]) {
                    await client.query(
                      `INSERT INTO rcm_submit_line_audit (submit_cpt_id, claim_id, line_index, cycle, upload_id, changed_at, hash_old, hash_new, old_line, new_line, diff)
                       VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7,$8,$9,$10)`,
                      [clean[`cpt_code_id${li}`], existingId, li, lineCycle, upload_id, oldHash, newHash, JSON.stringify(oldCanon), JSON.stringify(newCanon), JSON.stringify(diff)]
                    );
                  }
                }
              }
              
              // Log field-level changes (Case 5: track changes)
              for (const fieldName of fieldsToTrack) {
                const oldVal = oldRow[fieldName];
                const newVal = clean[fieldName];
                const oldStr = oldVal == null ? '' : String(oldVal);
                const newStr = newVal == null ? '' : String(newVal);
                
                if (oldStr !== newStr) {
                  await client.query(
                    `INSERT INTO upl_change_logs (claim_id, upload_id, username, field_name, old_value, new_value)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [existingId, upload_id, 'SYSTEM', fieldName, oldStr || null, newStr || null]
                  );
                }
              }
            }
          }
        }

        // Progress and cancellation checks
        processed++;
        if (processed % progressStep === 0 || processed === total) {
          const pct = Math.floor((processed / total) * 100);
          await pool.query(
            `UPDATE rcm_file_uploads SET message=$1, updated_at=NOW() WHERE upload_id=$2`,
            [`Processing ${processed}/${total} Excel rows (${pct}%)`, upload_id]
          );
          // Cancellation: if user requested cancel, abort
          const st = await pool.query(`SELECT status FROM rcm_file_uploads WHERE upload_id=$1`, [upload_id]);
          const cur = st.rows?.[0]?.status;
          if (cur === 'FAILED') {
            throw new Error('Cancelled by user');
          }
        }
      }
      } // End of if-else tableIsEmpty

      await client.query('COMMIT');
      console.log('[COMMIT] Transaction committed successfully');
    } catch (e) {
      console.error('[COMMIT] Transaction error:', e);
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Mirror into reimburse table for this upload (per-CPT lines, idempotent)
    console.log('[COMMIT] Starting reimburse mirroring...');
    const mirror = await mirrorReimburseForUpload(upload_id);
    console.log('[COMMIT] Reimburse mirror complete:', mirror);
    
    // Case 17: Verify reimburse mirroring (1:1 with split-row model)
    const expectedReimburseRows = inserts.length + updates.length;
    const actualReimburseRows = mirror.created + mirror.updated;
    console.log(`[COMMIT] Reimburse verification: Expected ${expectedReimburseRows}, Got ${actualReimburseRows}`);
    
    // Allow some tolerance for edge cases, but flag significant mismatches
    const discrepancy = Math.abs(expectedReimburseRows - actualReimburseRows);
    const discrepancyPct = expectedReimburseRows > 0 ? (discrepancy / expectedReimburseRows) * 100 : 0;
    
    if (discrepancyPct > 10 && discrepancy > 5) {
      console.error(`[COMMIT] Reimburse sync mismatch: Expected ${expectedReimburseRows}, got ${actualReimburseRows}`);
      // Log warning but don't rollback (reimburse can be re-synced)
      warnings.push(`Warning: Reimburse synchronization count mismatch (expected ${expectedReimburseRows}, got ${actualReimburseRows}). Claims saved successfully.`);
    }
    
    const duration = Date.now() - t0;
    const inserted_count = inserts.length;
    const updated_count = updates.length;
    const skipped_count = skipped;

    const msg = `Committed ${inserted_count + updated_count} rows (inserted ${inserted_count}, updated ${updated_count}, skipped ${skipped_count}); Reimburse: created=${mirror.created}, updated=${mirror.updated}, deleted=${mirror.deleted}${discrepancyPct > 10 ? ' [sync warning]' : ''}`;
    await pool.query(
      `UPDATE rcm_file_uploads
         SET message=$1,
             row_count=COALESCE(row_count, $2),
             status='COMPLETED',
             processing_completed_at=NOW(),
             updated_at=NOW()
       WHERE upload_id=$3`,
      [msg, inserted_count + updated_count, upload_id]
    );

    // Optional S3 cleanup after successful commit (controlled by env)
    try {
      const delFlag = String(process.env.S3_DELETE_ON_COMMIT || '').trim().toLowerCase();
      const shouldDelete = delFlag === '1' || delFlag === 'true' || delFlag === 'yes';
      if (shouldDelete) {
        await deleteFromS3({ bucket, key: keyObj });
      }
    } catch {}

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
      },
    });
  } catch (err: any) {
    console.error('commitSubmitUpload error:', err);
    try {
      if (upload_id) {
        const meta = await pool.query(`SELECT s3_bucket, s3_key FROM rcm_file_uploads WHERE upload_id=$1`, [upload_id]);
        await pool.query(
          `UPDATE rcm_file_uploads SET status='FAILED', message=$1, updated_at=NOW() WHERE upload_id=$2`,
          [String(err?.message || 'Commit failed'), upload_id]
        );
        // Best-effort cleanup of source object
        try {
          await deleteFromS3({ bucket: meta.rows?.[0]?.s3_bucket, key: meta.rows?.[0]?.s3_key });
        } catch {}
      }
    } catch {}
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
