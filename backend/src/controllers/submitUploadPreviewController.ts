import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';
import XLSX from 'xlsx';
import pool from '../config/db.js';
import { uploadToS3 } from '../services/s3.js';

// Header synonym groups for robust detection
const HEADER_SYNONYMS: Record<string, string[]> = {
  PatientID: ['PatientID','Patient Id','PatientId','Patient #','Patient Number'],
  PatientLast: ['PatientLast','Patient Last','PatientLastName','LastName','Last Name'],
  PatientFirst: ['PatientFirst','Patient First','PatientFirstName','FirstName','First Name'],
  PatientDOB: ['PatientDOB','DOB','DateOfBirth','Date of Birth','Birth Date'],
  FromDateOfService1: ['FromDateOfService1','From DOS1','From DOS','Service Start','ServiceDate1','DateOfService','DOS','Service Date'],
  CPT1: ['CPT1','CPT','CPT Code','CPT-1'],
  Charges1: ['Charges1','Charge1','Charge Amount','ChargeAmt1','Charge Amount 1','Charge','Amount'],
  InsurancePlanName: ['InsurancePlanName','InsuranceName','PrimaryInsurance'],
  InsurancePayerID: ['InsurancePayerID','PayerID','PayorID','PayerId'],
};

const norm = (s: any) => String(s || '')
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, '')
  .toLowerCase();

function yearMonth(d = new Date()) {
  return { y: String(d.getUTCFullYear()), m: String(d.getUTCMonth() + 1).padStart(2, '0') };
}

function toUtf8Buffer(filePath: string): Buffer {
  const buf = fs.readFileSync(filePath);
  return buf;
}

function parseFile(filePath: string): { headers: string[]; rows: any[] } {
  if (filePath.toLowerCase().endsWith('.csv')) {
    const content = fs.readFileSync(filePath, 'utf8');
    // simple delimiter auto-detect (comma/semicolon/tab)
    const delim = content.includes('\t') ? '\t' : (content.includes(';') ? ';' : ',');
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (!lines.length) return { headers: [], rows: [] };
    const headers = lines[0].split(new RegExp(delim)).map(s => s.replace(/^\"|\"$/g,'').trim());
    const rows = [] as any[];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(new RegExp(delim));
      const row: any = {};
      let anyVal = false;
      headers.forEach((h, idx) => {
        const v = (parts[idx] ?? '').replace(/^\"|\"$/g,'').trim();
        if (v !== '') anyVal = true;
        row[h] = v;
      });
      if (anyVal) rows.push(row);
    }
    return { headers, rows };
  }
  const wb = XLSX.readFile(filePath, { cellDates: true, raw: false, type: 'file' as any });
  const nk = (s: string) => s.normalize('NFKC').trim().replace(/\s+/g,'').toLowerCase();
  const score = (headers: string[]) => {
    const set = new Set(headers.map(nk));
    let sc = 0;
    for (const arr of Object.values(HEADER_SYNONYMS)) if (arr.some(h => set.has(nk(h)))) sc++;
    return sc;
  };
  let best: { name: string; rows: any[]; headers: string[]; sc: number } | null = null;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, blankrows: false });
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const sc = score(headers);
    if (!best || sc > best.sc) best = { name, rows, headers, sc };
  }
  if (!best) return { headers: [], rows: [] };
  return { headers: best.headers, rows: best.rows };
}

export async function previewSubmitUpload(req: Request, res: Response) {
  try {
    // 1) Validate file input
    const file = (req as any).file as Express.Multer.File | undefined;
    const clinic = String(req.body?.clinic || '').trim();
    const createdBy = req.user?.email || req.user?.username || String(req.body?.created_by || '').trim();
    if (!file) return res.status(400).json({ status: 'error', message: 'file is required' });
    if (!clinic) return res.status(400).json({ status: 'error', message: 'clinic is required' });

    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.xlsx','.csv','.xls'].includes(ext)) return res.status(400).json({ status: 'error', message: 'Only .xlsx, .xls, .csv allowed' });
    if (file.size > 50 * 1024 * 1024) return res.status(400).json({ status: 'error', message: 'File too large (>50MB)' });

    // 2) Compute hash
    const bodyBuf = toUtf8Buffer(file.path);
    const contentSha256 = crypto.createHash('sha256').update(bodyBuf).digest('hex');

    // 3) Idempotency lookup
    const dupCheck = await pool.query(
      `SELECT upload_id, s3_url FROM rcm_file_uploads WHERE file_kind='SUBMIT_EXCEL' AND COALESCE(clinic,'')=$1 AND content_sha256=$2 LIMIT 1`,
      [clinic, contentSha256]
    );

  let uploadId: string;
  let s3Url: string;
    let s3Bucket = process.env.S3_BUCKET || '';
    const { y, m } = yearMonth();
  const s3KeyPrefix = `submit/${clinic}/${y}/${m}/`;

    if (dupCheck.rowCount) {
      // 4) Duplicate: reuse existing
      uploadId = dupCheck.rows[0].upload_id;
      s3Url = dupCheck.rows[0].s3_url;
      const existingBucket = (dupCheck.rows[0] as any).s3_bucket;
      const existingKey = (dupCheck.rows[0] as any).s3_key;
      if (!s3Url || !existingBucket || !existingKey) {
        const key = `${s3KeyPrefix}${uploadId}${ext || '.xlsx'}`;
        const up = await uploadToS3({ bucket: s3Bucket, key, body: bodyBuf, contentType: file.mimetype });
        s3Url = up.s3Url;
        await pool.query(`UPDATE rcm_file_uploads SET s3_bucket=$1, s3_key=$2, s3_url=$3 WHERE upload_id=$4`, [s3Bucket, key, s3Url, uploadId]);
      }
    } else {
      // 5) Generate upload_id, upload to S3 first (to satisfy NOT NULL s3_url), then insert audit row
      uploadId = crypto.randomUUID();
      const key = `${s3KeyPrefix}${uploadId}${ext || '.xlsx'}`;
      const up = await uploadToS3({ bucket: s3Bucket, key, body: bodyBuf, contentType: file.mimetype });
      s3Url = up.s3Url;

      await pool.query(
        `INSERT INTO rcm_file_uploads (
           upload_id, file_kind, clinic, original_filename, mime_type, original_filesize_bytes,
           storage_provider, content_sha256, status, created_by, created_from_ip,
           s3_bucket, s3_key, s3_url
         ) VALUES (
           $1,$2,$3,$4,$5,$6,
           $7,$8,$9,$10,$11,
           $12,$13,$14
         )`,
        [
          uploadId,
          'SUBMIT_EXCEL',
          clinic,
          file.originalname,
          file.mimetype,
          file.size,
          's3',
          contentSha256,
          'PENDING',
          createdBy,
          req.ip,
          s3Bucket,
          key,
          s3Url,
        ]
      );
    }

    // 6) Parse + validate
  const { headers, rows } = parseFile(file.path);
    const headersFoundSet = new Set(headers.map(h => norm(h)));
    const columns_found = headers;
    const missing_required: string[] = [];
    const warnings: string[] = [];
    // Required groups: patient info, service info, and insurance (either plan or payer id)
    const hasAny = (keys: string[]) => keys.some(k => headersFoundSet.has(norm(k)));
    if (!hasAny(HEADER_SYNONYMS.PatientID)) missing_required.push('PatientID');
    if (!hasAny(HEADER_SYNONYMS.PatientLast)) missing_required.push('PatientLast');
    if (!hasAny(HEADER_SYNONYMS.PatientFirst)) missing_required.push('PatientFirst');
    if (!hasAny(HEADER_SYNONYMS.PatientDOB)) missing_required.push('PatientDOB');
    if (!hasAny(HEADER_SYNONYMS.FromDateOfService1)) missing_required.push('FromDateOfService1');
    if (!hasAny(HEADER_SYNONYMS.CPT1)) missing_required.push('CPT1');
    if (!hasAny(HEADER_SYNONYMS.Charges1)) missing_required.push('Charges1');
    if (!(hasAny(HEADER_SYNONYMS.InsurancePlanName) || hasAny(HEADER_SYNONYMS.InsurancePayerID))) {
      missing_required.push('InsurancePlanName|InsurancePayerID');
    }

    const row_count = rows.length;
    const sample_rows = rows.slice(0, 5);

    // value-level validation: at least one row should have required values
    const hasRequiredValues = (() => {
      // allow either InsurancePlanName or InsurancePayerID
      return rows.some(r => {
        const hasPatient = r['PatientID'] && r['PatientLast'] && r['PatientFirst'] && r['PatientDOB'];
        const hasService = r['FromDateOfService1'] && r['CPT1'] && (r['Charges1'] || r['TotalCharges']);
        const hasInsurance = r['InsurancePlanName'] || r['InsurancePayerID'];
        return !!(hasPatient && hasService && hasInsurance);
      });
    })();

    let status = 'COMPLETED';
    let message: string | null = null;
    if (missing_required.length) {
      status = 'FAILED';
      message = `Missing headers: ${missing_required.join(', ')}`;
    }

  await pool.query(
      `UPDATE rcm_file_uploads
         SET row_count=$1, status=$2, message=$3, processing_completed_at=NOW()
       WHERE upload_id=$4`,
      [row_count, status, message, uploadId]
    );

  const can_commit = missing_required.length === 0 && hasRequiredValues;
    const duplicate_of = dupCheck.rowCount ? dupCheck.rows[0].upload_id : null;

    if (!can_commit) {
      return res.status(200).json({
        upload_id: uploadId,
    errors: message ? [message] : (hasRequiredValues ? [] : ['No rows contain required values (Patient, Service, and Insurance).']),
        can_commit: false
      });
    }

    return res.status(200).json({
      upload_id: uploadId,
      s3_url: s3Url,
      original_filename: (file.originalname || ''),
      row_count,
      columns_found,
      missing_required: [],
      warnings,
      sample_rows,
      can_commit,
      duplicate_of
    });
  } catch (err: any) {
    console.error('previewSubmitUpload error:', err);
    return res.status(500).json({ status: 'error', message: err?.message || 'Internal error' });
  } finally {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch {}
  }
}
