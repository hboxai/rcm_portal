import { Request, Response } from 'express';
import pool from '../config/db.js';
import XLSX from 'xlsx';
import { uploadToS3 } from '../services/s3.js';
import { v4 as uuidv4 } from 'uuid';

// Normalize header names for flexible matching
const norm = (s: string): string =>
  String(s ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/[\s_-]+/g, '')
    .toLowerCase();

// Flexible header mapping for reimburse Excel files
const HEADER_MAP: Record<string, string[]> = {
  patient_id: ['patient_id', 'patientid', 'patient'],
  cpt_id: ['cpt_id', 'cptid', 'lineid', 'claimlineid', 'submitcptid'],
  patient_emr_no: ['patient_emr_no', 'patientemrno', 'emr_no', 'emrno', 'mrn'],
  first_name: ['first_name', 'firstname', 'patient_first', 'patientfirst'],
  last_name: ['last_name', 'lastname', 'patient_last', 'patientlast'],
  date_of_birth: ['date_of_birth', 'dateofbirth', 'dob', 'birthdate'],
  cpt_code: ['cpt_code', 'cptcode', 'cpt', 'procedurecode'],
  service_start: ['service_start', 'servicestart', 'dos', 'dateofservice', 'service_date'],
  service_end: ['service_end', 'serviceend', 'enddate'],
  icd_code: ['icd_code', 'icdcode', 'diagnosis', 'dx'],
  units: ['units', 'quantity', 'qty'],
  provider_name: ['provider_name', 'providername', 'provider', 'rendering_provider'],
  oa_claim_id: ['oa_claim_id', 'oaclaimid', 'officeallyclaimid'],
  oa_visit_id: ['oa_visit_id', 'oavisitid', 'visitid'],
  charge_dt: ['charge_dt', 'chargedt', 'charge_date', 'chargedate'],
  charge_amt: ['charge_amt', 'chargeamt', 'charge_amount', 'charges'],
  allowed_amt: ['allowed_amt', 'allowedamt', 'allowed_amount', 'allowed'],
  allowed_add_amt: ['allowed_add_amt', 'allowedaddamt', 'additional_allowed'],
  allowed_exp_amt: ['allowed_exp_amt', 'allowedexpamt', 'expected_allowed'],
  prim_ins: ['prim_ins', 'primins', 'primary_insurance', 'primaryins'],
  prim_amt: ['prim_amt', 'primamt', 'primary_paid', 'primarypaid', 'prim_paid'],
  prim_post_dt: ['prim_post_dt', 'primpostdt', 'primary_post_date'],
  prim_chk_det: ['prim_chk_det', 'primchkdet', 'primary_check', 'primarycheck'],
  prim_recv_dt: ['prim_recv_dt', 'primrecvdt', 'primary_received_date'],
  prim_chk_amt: ['prim_chk_amt', 'primchkamt', 'primary_check_amount'],
  prim_cmt: ['prim_cmt', 'primcmt', 'primary_comment', 'primary_comments'],
  sec_ins: ['sec_ins', 'secins', 'secondary_insurance', 'secondaryins'],
  sec_amt: ['sec_amt', 'secamt', 'secondary_paid', 'secondarypaid'],
  sec_post_dt: ['sec_post_dt', 'secpostdt', 'secondary_post_date'],
  sec_chk_det: ['sec_chk_det', 'secchkdet', 'secondary_check'],
  sec_recv_dt: ['sec_recv_dt', 'secrecvdt', 'secondary_received_date'],
  sec_chk_amt: ['sec_chk_amt', 'secchkamt', 'secondary_check_amount'],
  sec_cmt: ['sec_cmt', 'seccmt', 'secondary_comment', 'secondary_comments'],
  pat_amt: ['pat_amt', 'patamt', 'patient_paid', 'patientpaid', 'copay'],
  pat_recv_dt: ['pat_recv_dt', 'patrecvdt', 'patient_received_date'],
  total_amt: ['total_amt', 'totalamt', 'total_amount', 'total_paid'],
  write_off_amt: ['write_off_amt', 'writeoffamt', 'writeoff', 'adjustment'],
  charges_adj_amt: ['charges_adj_amt', 'chargesadjamt', 'charge_adjustment'],
  bal_amt: ['bal_amt', 'balamt', 'balance', 'balance_amount'],
  reimb_pct: ['reimb_pct', 'reimbpct', 'reimbursement_percent', 'reimbursement_pct'],
  claim_status: ['claim_status', 'claimstatus', 'payment_status'],
  claim_status_type: ['claim_status_type', 'claimstatustype', 'status_type'],
  status: ['status', 'final_status', 'current_status'],
};

// Map Excel header to database column
function mapHeader(excelHeader: string): string | null {
  const normalized = norm(excelHeader);
  for (const [dbCol, variants] of Object.entries(HEADER_MAP)) {
    if (variants.some(v => norm(v) === normalized)) {
      return dbCol;
    }
  }
  return null;
}

// Parse numeric value
function parseAmount(val: any): number | null {
  if (val == null || val === '') return null;
  const str = String(val).replace(/[$,\s]/g, '');
  const num = parseFloat(str);
  return isFinite(num) ? num : null;
}

// Parse date value
function parseDate(val: any): string | null {
  if (val == null || val === '') return null;
  
  // Handle Excel serial date numbers
  if (typeof val === 'number') {
    const days = Math.floor(val);
    const base = Date.UTC(1899, 11, 30);
    const ms = base + days * 86400000;
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = d.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  
  // Handle Date objects
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = (val.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = val.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  
  // Handle string dates
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  
  // Handle MM/DD/YYYY or M/D/YYYY
  const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, m, d, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  return null;
}

// Log field change to upl_change_logs
async function logChange(
  client: any,
  claimId: string | number,
  fieldName: string,
  oldValue: any,
  newValue: any,
  username: string
): Promise<void> {
  await client.query(
    `INSERT INTO upl_change_logs (claim_id, username, field_name, old_value, new_value, source, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      String(claimId),
      username,
      fieldName,
      oldValue == null ? null : String(oldValue),
      newValue == null ? null : String(newValue),
      'MANUAL'
    ]
  );
}

// Calculate balance and determine status
function calculateBalance(row: any): { bal_amt: number; claim_status: string } {
  const charge = parseFloat(row.charge_amt) || 0;
  const prim = parseFloat(row.prim_amt) || 0;
  const sec = parseFloat(row.sec_amt) || 0;
  const pat = parseFloat(row.pat_amt) || 0;
  const writeOff = parseFloat(row.write_off_amt) || 0;
  
  const bal_amt = charge - (prim + sec + pat) - writeOff;
  
  // Determine status
  let claim_status = 'IN_PROGRESS';
  if (Math.abs(bal_amt) < 0.01) {
    claim_status = 'PAID';
  } else if (row.prim_denial_code || row.sec_denial_code) {
    if (prim > 0 || sec > 0 || pat > 0) {
      claim_status = 'PARTIAL_DENIAL';
    } else {
      claim_status = 'DENIED';
    }
  }
  
  return { bal_amt: Math.max(0, bal_amt), claim_status };
}

export async function uploadReimburseExcel(req: Request, res: Response) {
  const client = await pool.connect();
  let upload_id: string | undefined;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const username = (req as any).user?.username || 'system';
    upload_id = uuidv4();
    const originalFilename = req.file.originalname;
    const fileBuffer = req.file.buffer;
    const bucket = process.env.S3_BUCKET || '';
    
    // Upload to S3 first
    const s3Key = `reimburse/${upload_id}/${originalFilename}`;
    const s3Result = await uploadToS3({
      bucket,
      key: s3Key,
      body: fileBuffer,
      contentType: req.file.mimetype
    });

    // Create upload record
    await pool.query(
      `INSERT INTO rcm_file_uploads (upload_id, file_kind, original_filename, s3_bucket, s3_key, s3_url, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [upload_id, 'REIMBURSE_EXCEL', originalFilename, bucket, s3Key, s3Result.s3Url, 'PENDING', username]
    );
    
    // Parse Excel file
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: null });

    if (rawRows.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }

    // Map headers
    const excelHeaders = Object.keys(rawRows[0]);
    const headerMapping = new Map<string, string>();
    const mappedFields = new Set<string>();
    
    for (const excelHeader of excelHeaders) {
      const dbCol = mapHeader(excelHeader);
      if (dbCol) {
        headerMapping.set(excelHeader, dbCol);
        mappedFields.add(dbCol);
      }
    }

    // Check for required field - cpt_id is the primary key from CSV
    if (!mappedFields.has('cpt_id')) {
      await pool.query(
        `UPDATE rcm_file_uploads SET status='FAILED', message=$1, updated_at=NOW() WHERE upload_id=$2`,
        ['Missing required column: cpt_id (CPT Code ID)', upload_id]
      );
      return res.status(400).json({
        error: 'Missing required column: cpt_id (CPT Code ID)',
        found_columns: Array.from(mappedFields)
      });
    }

    await client.query('BEGIN');

    let matched = 0;
    let updated = 0;
    let notFound = 0;
    const warnings: string[] = [];
    const errors: string[] = [];

    // Process each row
    for (let i = 0; i < rawRows.length; i++) {
      const rawRow = rawRows[i];
      const mappedRow: any = {};
      
      // Map Excel columns to DB columns
      for (const [excelHeader, dbCol] of headerMapping.entries()) {
        const rawValue = rawRow[excelHeader];
        
        // Parse based on field type
        if (['prim_amt', 'sec_amt', 'pat_amt', 'allowed_amt', 'write_off_amt'].includes(dbCol)) {
          mappedRow[dbCol] = parseAmount(rawValue);
        } else if (['prim_recv_dt', 'sec_recv_dt', 'pat_recv_dt', 'dos'].includes(dbCol)) {
          mappedRow[dbCol] = parseDate(rawValue);
        } else {
          mappedRow[dbCol] = rawValue;
        }
      }

      // Find matching reimburse record using cpt_id (primary key from CSV)
      let findQuery = '';
      let findParams: any[] = [];
      
      if (mappedRow.cpt_id) {
        // Match by cpt_id (CPT Code ID - the unique identifier)
        findQuery = `SELECT * FROM api_bil_claim_reimburse WHERE cpt_id = $1`;
        findParams = [String(mappedRow.cpt_id).trim()];
      } else {
        warnings.push(`Row ${i + 2}: Missing cpt_id, skipped`);
        continue;
      }

      const result = await client.query(findQuery, findParams);
      
      if (result.rows.length === 0) {
        notFound++;
        warnings.push(`Row ${i + 2}: No matching claim found`);
        continue;
      }

      if (result.rows.length > 1) {
        warnings.push(`Row ${i + 2}: Multiple matches found, updating first match only`);
      }

      matched++;
      const existingRow = result.rows[0];
      const reimburseId = existingRow.bil_claim_reimburse_id;

      // Build update object (override logic: only update non-null fields)
      const updates: any = {};
      const updateFields: string[] = [];
      const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

      // All updatable fields from CSV
      const paymentFields = [
        'patient_emr_no', 'first_name', 'last_name', 'date_of_birth',
        'cpt_code', 'service_start', 'service_end', 'icd_code', 'units', 'provider_name',
        'oa_claim_id', 'oa_visit_id', 'charge_dt', 'charge_amt',
        'allowed_amt', 'allowed_add_amt', 'allowed_exp_amt',
        'prim_ins', 'prim_amt', 'prim_post_dt', 'prim_chk_det', 'prim_recv_dt', 'prim_chk_amt', 'prim_cmt',
        'sec_ins', 'sec_amt', 'sec_post_dt', 'sec_chk_det', 'sec_recv_dt', 'sec_chk_amt', 'sec_cmt',
        'pat_amt', 'pat_recv_dt',
        'total_amt', 'write_off_amt', 'charges_adj_amt', 'bal_amt',
        'reimb_pct', 'claim_status', 'claim_status_type', 'status'
      ];

      for (const field of paymentFields) {
        if (mappedRow[field] !== undefined && mappedRow[field] !== null && mappedRow[field] !== '') {
          const oldValue = existingRow[field];
          const newValue = mappedRow[field];
          
          // Only update if value changed
          if (oldValue !== newValue) {
            updates[field] = newValue;
            updateFields.push(field);
            changes.push({ field, oldValue, newValue });
          }
        }
      }

      if (updateFields.length > 0) {
        // Apply updates
        const setClauses = updateFields.map((f, idx) => `${f} = $${idx + 2}`).join(', ');
        const updateParams = [reimburseId, ...updateFields.map(f => updates[f])];
        
        await client.query(
          `UPDATE api_bil_claim_reimburse 
           SET ${setClauses}, updated_at = NOW() 
           WHERE bil_claim_reimburse_id = $1`,
          updateParams
        );

        // Recalculate balance and status
        const updatedRow = { ...existingRow, ...updates };
        const { bal_amt, claim_status } = calculateBalance(updatedRow);
        
        await client.query(
          `UPDATE api_bil_claim_reimburse 
           SET bal_amt = $1, claim_status = $2, claim_status_type = 'PAYER', updated_at = NOW()
           WHERE bil_claim_reimburse_id = $3`,
          [bal_amt, claim_status, reimburseId]
        );

        // Log all changes
        for (const change of changes) {
          await logChange(
            client,
            reimburseId,
            change.field,
            change.oldValue,
            change.newValue,
            username
          );
        }

        // Log balance and status changes
        if (existingRow.bal_amt !== bal_amt) {
          await logChange(client, reimburseId, 'bal_amt', existingRow.bal_amt, bal_amt, username);
        }
        if (existingRow.claim_status !== claim_status) {
          await logChange(client, reimburseId, 'claim_status', existingRow.claim_status, claim_status, username);
        }

        updated++;
      }
    }

    await client.query('COMMIT');

    // Update upload record with success
    await pool.query(
      `UPDATE rcm_file_uploads 
       SET status='COMPLETED', 
           row_count=$1,
           message=$2, 
           processing_completed_at=NOW(),
           updated_at=NOW() 
       WHERE upload_id=$3`,
      [rawRows.length, `Processed ${rawRows.length} rows: ${matched} matched, ${updated} updated, ${notFound} not found`, upload_id]
    );

    return res.status(200).json({
      success: true,
      upload_id,
      message: `Processed ${rawRows.length} rows: ${matched} matched, ${updated} updated, ${notFound} not found`,
      stats: {
        total_rows: rawRows.length,
        matched,
        updated,
        not_found: notFound,
        skipped: rawRows.length - matched - notFound
      },
      warnings: warnings.length > 0 ? warnings.slice(0, 20) : undefined,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Reimburse upload error:', error);
    
    // Update upload record with failure
    try {
      await pool.query(
        `UPDATE rcm_file_uploads SET status='FAILED', message=$1, updated_at=NOW() WHERE upload_id=$2`,
        [error.message || 'Processing failed', upload_id]
      );
    } catch {}
    
    return res.status(500).json({
      error: 'Failed to process reimburse Excel',
      message: error.message
    });
  } finally {
    client.release();
  }
}
