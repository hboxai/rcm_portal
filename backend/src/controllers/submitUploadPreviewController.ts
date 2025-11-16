import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';
import XLSX from 'xlsx';
import pool from '../config/db.js';

// Header synonym groups for robust detection
const HEADER_SYNONYMS: Record<string, string[]> = {
  PatientID: ['PatientID','Patient Id','PatientId','Patient_ID','Patient ID','Patient #','Patient Number','patient_id'],
  PatientLast: ['PatientLast','Patient Last','PatientLastName','Patient_Last','LastName','Last Name','last_name'],
  PatientFirst: ['PatientFirst','Patient First','PatientFirstName','Patient_First','FirstName','First Name','first_name'],
  PatientDOB: ['PatientDOB','Patient DOB','Patient_DOB','DOB','DateOfBirth','Date of Birth','Birth Date','date_of_birth'],
  FromDateOfService1: ['FromDateOfService1','From DOS1','From DOS','Service Start','ServiceDate1','DateOfService','DOS','Service Date','from_date_of_service_1','service_date'],
  CPT1: ['CPT1','CPT','CPT Code','CPT-1','cpt1','cpt_1','cpt_code'],
  Charges1: ['Charges1','Charge1','Charge Amount','ChargeAmt1','Charge Amount 1','Charge','Amount','charges1','charge_1','charge_amount'],
  InsurancePlanName: ['InsurancePlanName','InsuranceName','PrimaryInsurance','Insurance Plan Name','insurance_plan_name','insurance_name'],
  InsurancePayerID: ['InsurancePayerID','PayerID','PayorID','PayerId','Insurance Payer ID','insurance_payer_id','payer_id'],
};

const norm = (s: any) => String(s || '')
  .normalize('NFKC')
  .trim()
  .replace(/[\s_-]+/g, '')  // Remove spaces, underscores, and hyphens
  .toLowerCase();

function yearMonth(d = new Date()) {
  return { y: String(d.getUTCFullYear()), m: String(d.getUTCMonth() + 1).padStart(2, '0') };
}

function toUtf8Buffer(filePath: string): Buffer {
  const buf = fs.readFileSync(filePath);
  return buf;
}

function parseFile(filePath: string): { headers: string[]; rows: any[] } {
  // Use XLSX library for both Excel and CSV files - it handles CSV automatically
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
    
    // Validate file integrity
    if (!fs.existsSync(file.path)) return res.status(400).json({ status: 'error', message: 'File upload incomplete or corrupted. Please try uploading again.' });
    const actualSize = fs.statSync(file.path).size;
    if (actualSize === 0 || actualSize !== file.size) return res.status(400).json({ status: 'error', message: 'File upload incomplete or corrupted. Please try uploading again.' });

    // 2) Compute hash
    const bodyBuf = toUtf8Buffer(file.path);
    const contentSha256 = crypto.createHash('sha256').update(bodyBuf).digest('hex');

    // 3) Idempotency lookup (allow re-upload if FAILED or CANCELLED)
    const dupCheck = await pool.query(
      `SELECT upload_id, s3_url, status FROM rcm_file_uploads WHERE file_kind='SUBMIT_EXCEL' AND COALESCE(clinic,'')=$1 AND content_sha256=$2 LIMIT 1`,
      [clinic, contentSha256]
    );

  let uploadId: string;
  let tempFilePath: string;

    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const existingStatus = dupCheck.rowCount ? dupCheck.rows[0].status : null;
    const canReupload = !existingStatus || existingStatus === 'FAILED' || existingStatus === 'CANCELLED';

    if (dupCheck.rowCount && !canReupload) {
      // 4) Duplicate with valid status: reuse existing
      uploadId = dupCheck.rows[0].upload_id;
      tempFilePath = path.join(tempDir, `${uploadId}${ext}`);
      // Copy file to temp location
      fs.copyFileSync(file.path, tempFilePath);
    } else {
      // 5) Generate upload_id, store file temporarily (NO S3 upload yet)
      uploadId = crypto.randomUUID();
      tempFilePath = path.join(tempDir, `${uploadId}${ext}`);
      // Copy file to temp location
      fs.copyFileSync(file.path, tempFilePath);

      await pool.query(
        `INSERT INTO rcm_file_uploads (
           upload_id, file_kind, clinic, original_filename, mime_type, original_filesize_bytes,
           storage_provider, content_sha256, status, created_by, created_from_ip,
           temp_file_path
         ) VALUES (
           $1,$2,$3,$4,$5,$6,
           $7,$8,$9,$10,$11,
           $12
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
          tempFilePath
        ]
      );
    }

    // 6) Parse + validate
  const { headers, rows } = parseFile(file.path);
    const warnings: string[] = [];
    
    // Check for multiple sheets (Case 13)
    if (ext === '.xlsx' || ext === '.xls') {
      try {
        const wb = XLSX.readFile(file.path);
        if (wb.SheetNames.length > 1) {
          warnings.push(`Excel file contains ${wb.SheetNames.length} sheets: [${wb.SheetNames.join(', ')}]. Only the first sheet will be processed. Please ensure your data is in the first sheet.`);
        }
      } catch (e) {
        // Ignore if can't read workbook for sheet check
      }
    }
    
    const headersFoundSet = new Set(headers.map(h => norm(h)));
    const columns_found = headers;
    const missing_required: string[] = [];
    
    // Case 18: Check for unknown columns
    const knownColumns = new Set(Object.values(HEADER_SYNONYMS).flat().map(norm));
    const unknownColumns = headers.filter(h => !knownColumns.has(norm(h)));
    if (unknownColumns.length > 0 && unknownColumns.length < 20) {
      warnings.push(`File contains ${unknownColumns.length} unknown columns that will be ignored: [${unknownColumns.slice(0, 10).join(', ')}${unknownColumns.length > 10 ? '...' : ''}]. This may indicate a mapping issue.`);
    } else if (unknownColumns.length >= 20) {
      warnings.push(`File contains ${unknownColumns.length} unknown columns. Please verify you are using the correct template.`);
    }
    
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

    // Case 20: Validate ALL rows (not just first 100) for comprehensive validation
    const validationErrors: Array<{row: number, field: string, message: string}> = [];
    const rowsToCheck = rows.length; // Changed from Math.min(rows.length, 100)
    let validRowCount = 0;
    
    console.log(`[PREVIEW] Validating all ${rowsToCheck} rows...`);

    // Build reverse map: canonical name -> actual header name from file
    const findHeader = (synonyms: string[]): string | null => {
      for (const h of headers) {
        if (synonyms.some(s => norm(s) === norm(h))) return h;
      }
      return null;
    };
    
    const actualHeaders = {
      PatientID: findHeader(HEADER_SYNONYMS.PatientID),
      PatientLast: findHeader(HEADER_SYNONYMS.PatientLast),
      PatientFirst: findHeader(HEADER_SYNONYMS.PatientFirst),
      PatientDOB: findHeader(HEADER_SYNONYMS.PatientDOB),
      FromDateOfService1: findHeader(HEADER_SYNONYMS.FromDateOfService1),
      CPT1: findHeader(HEADER_SYNONYMS.CPT1),
      Charges1: findHeader(HEADER_SYNONYMS.Charges1),
      InsurancePlanName: findHeader(HEADER_SYNONYMS.InsurancePlanName),
      InsurancePayerID: findHeader(HEADER_SYNONYMS.InsurancePayerID),
    };

    for (let i = 0; i < rowsToCheck; i++) {
      const r = rows[i];
      const rowNum = i + 2; // Excel row number (header is row 1)
      let rowValid = true;

      // Check required fields using actual header names from the file
      const getValue = (canonical: keyof typeof actualHeaders) => {
        const actualHeader = actualHeaders[canonical];
        return actualHeader ? r[actualHeader] : null;
      };
      
      if (!getValue('PatientID')) { validationErrors.push({row: rowNum, field: 'PatientID', message: 'Missing'}); rowValid = false; }
      if (!getValue('PatientLast')) { validationErrors.push({row: rowNum, field: 'PatientLast', message: 'Missing'}); rowValid = false; }
      if (!getValue('PatientFirst')) { validationErrors.push({row: rowNum, field: 'PatientFirst', message: 'Missing'}); rowValid = false; }
      if (!getValue('PatientDOB')) { validationErrors.push({row: rowNum, field: 'PatientDOB', message: 'Missing'}); rowValid = false; }
      if (!getValue('FromDateOfService1')) { validationErrors.push({row: rowNum, field: 'FromDateOfService1', message: 'Missing'}); rowValid = false; }
      if (!getValue('CPT1')) { validationErrors.push({row: rowNum, field: 'CPT1', message: 'Missing'}); rowValid = false; }
      if (!getValue('Charges1') && !r['TotalCharges']) { validationErrors.push({row: rowNum, field: 'Charges1', message: 'Missing'}); rowValid = false; }
      if (!getValue('InsurancePlanName') && !getValue('InsurancePayerID')) { validationErrors.push({row: rowNum, field: 'Insurance', message: 'Missing both Plan Name and Payer ID'}); rowValid = false; }

      if (rowValid) validRowCount++;
      
      // Progress logging for large files
      if (rowsToCheck > 1000 && i > 0 && i % 500 === 0) {
        console.log(`[PREVIEW] Validated ${i}/${rowsToCheck} rows (${Math.floor(i/rowsToCheck*100)}%)...`);
      }
    }
    
    console.log(`[PREVIEW] Validation complete: ${validRowCount}/${rowsToCheck} valid rows, ${validationErrors.length} errors`);

    let status = 'PENDING';
    let message: string | null = null;
    if (missing_required.length) {
      status = 'FAILED';
      // Case 19: Clear error for missing required columns
      const missingList = missing_required.join(', ');
      message = `File is missing required columns: [${missingList}]. Please use the updated template. Download the template from the Upload page.`;
    } else if (validationErrors.length > 0 && validRowCount === 0) {
      status = 'FAILED';
      message = `No valid rows found. All checked rows have validation errors.`;
    }

  await pool.query(
      `UPDATE rcm_file_uploads
         SET row_count=$1, status=$2, message=$3
       WHERE upload_id=$4`,
      [row_count, status, message, uploadId]
    );

  const can_commit = missing_required.length === 0 && validRowCount > 0;
    const duplicate_of = (dupCheck.rowCount && !canReupload) ? dupCheck.rows[0].upload_id : null;
    
    // Add note if re-uploading after failure
    if (dupCheck.rowCount && canReupload && existingStatus) {
      warnings.push(`Re-uploading file that previously had status: ${existingStatus}. Previous upload will be overwritten.`);
    }

    // Return detailed validation summary
    return res.status(200).json({
      upload_id: uploadId,
      original_filename: (file.originalname || ''),
      row_count,
      columns_found,
      missing_required,
      warnings,
      sample_rows,
      validation_summary: {
        total_rows: row_count,
        rows_checked: rowsToCheck,
        valid_rows: validRowCount,
        rows_with_errors: validationErrors.length > 0 ? rowsToCheck - validRowCount : 0,
        error_count: validationErrors.length,
        errors: validationErrors.slice(0, 50) // Limit to first 50 errors in preview
      },
      can_commit,
      duplicate_of,
      note: can_commit ? 'File stored temporarily. Click Commit to process and upload to S3.' : 'Please fix validation errors before committing.'
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
