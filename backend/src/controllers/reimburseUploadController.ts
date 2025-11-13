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
  cpt_id: ['cpt_id', 'patient_id', 'submitcptid', 'cptid', 'lineid', 'claimlineid'],
  submit_cpt_id: ['submit_cpt_id', 'submitcptid'],
  billing_id: ['billing_id', 'billingid', 'claim_id', 'claimid', 'bil_claim_submit_id'],
  patient_id: ['patient_emr_no', 'patientid', 'patient'],
  cpt_code: ['cpt_code', 'cptcode', 'cpt', 'procedurecode'],
  dos: ['dos', 'dateofservice', 'servicedate', 'date_of_service', 'service_date', 'charge_dt'],
  
  // Payment fields
  prim_amt: ['prim_amt', 'primarypaid', 'primary_paid', 'primary_amount', 'prim_paid', 'insurance_paid'],
  prim_chk_det: ['prim_chk_det', 'primarycheck', 'primary_check', 'check_number', 'checknumber', 'prim_check'],
  prim_recv_dt: ['prim_recv_dt', 'primarycheckdate', 'primary_check_date', 'check_date', 'checkdate', 'prim_date'],
  prim_denial_code: ['prim_denial_code', 'primarydenial', 'primary_denial', 'denial_code', 'denialcode'],
  
  sec_amt: ['sec_amt', 'secondarypaid', 'secondary_paid', 'secondary_amount', 'sec_paid'],
  sec_chk_det: ['sec_chk_det', 'secondarycheck', 'secondary_check', 'sec_check'],
  sec_recv_dt: ['sec_recv_dt', 'secondarycheckdate', 'secondary_check_date', 'sec_date'],
  sec_denial_code: ['sec_denial_code', 'secondarydenial', 'secondary_denial', 'sec_denial'],
  
  pat_amt: ['pat_amt', 'patientpaid', 'patient_paid', 'patient_amount', 'copay'],
  pat_recv_dt: ['pat_recv_dt', 'patientpaymentdate', 'patient_payment_date', 'pat_date'],
  
  // Adjustment fields
  allowed_amt: ['allowed_amt', 'allowedamount', 'allowed_amount', 'allowed'],
  write_off_amt: ['write_off_amt', 'writeoff', 'write_off', 'adjustment', 'contractual'],
  
  // Status
  claim_status: ['claim_status', 'status', 'paymentstatus', 'payment_status'],
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
      [upload_id, 'REIMBURSE_EXCEL', originalFilename, bucket, s3Key, s3Result.s3Url, 'PROCESSING', username]
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

    // Check for required matching field - prioritize cpt_id
    if (!mappedFields.has('cpt_id') && !mappedFields.has('submit_cpt_id') && 
        !(mappedFields.has('billing_id') || 
          (mappedFields.has('patient_id') && mappedFields.has('cpt_code') && mappedFields.has('dos')))) {
      await pool.query(
        `UPDATE rcm_file_uploads SET status='FAILED', message=$1, updated_at=NOW() WHERE upload_id=$2`,
        ['Missing required matching columns. Need either: cpt_id, submit_cpt_id, billing_id, OR (patient_id + cpt_code + dos)', upload_id]
      );
      return res.status(400).json({
        error: 'Missing required matching columns. Need either: cpt_id, submit_cpt_id, billing_id, OR (patient_id + cpt_code + dos)',
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

      // Find matching reimburse record - prioritize cpt_id matching
      let findQuery = '';
      let findParams: any[] = [];
      
      if (mappedRow.cpt_id) {
        // Match by cpt_id (the primary identifier from CSV)
        findQuery = `SELECT * FROM api_bil_claim_reimburse WHERE cpt_id = $1`;
        findParams = [String(mappedRow.cpt_id)];
      } else if (mappedRow.submit_cpt_id) {
        findQuery = `SELECT * FROM api_bil_claim_reimburse WHERE submit_cpt_id = $1`;
        findParams = [mappedRow.submit_cpt_id];
      } else if (mappedRow.billing_id) {
        findQuery = `SELECT * FROM api_bil_claim_reimburse WHERE bil_claim_submit_id = $1`;
        findParams = [mappedRow.billing_id];
      } else if (mappedRow.patient_id && mappedRow.cpt_code && mappedRow.dos) {
        findQuery = `SELECT * FROM api_bil_claim_reimburse 
                     WHERE patient_id = $1 AND cpt_id = $2 AND charge_dt = $3`;
        findParams = [mappedRow.patient_id, mappedRow.cpt_code, mappedRow.dos];
      } else {
        warnings.push(`Row ${i + 2}: Missing matching criteria, skipped`);
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

      // Payment fields
      const paymentFields = [
        'prim_amt', 'prim_chk_det', 'prim_recv_dt', 'prim_denial_code',
        'sec_amt', 'sec_chk_det', 'sec_recv_dt', 'sec_denial_code',
        'pat_amt', 'pat_recv_dt',
        'allowed_amt', 'write_off_amt', 'claim_status'
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
