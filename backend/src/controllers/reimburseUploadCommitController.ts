import { Request, Response } from 'express';
import XLSX from 'xlsx';
import fs from 'fs';
import pool from '../config/db.js';
import { uploadToS3 } from '../services/s3.js';

// Normalize header names
const norm = (s: string): string =>
  String(s ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/[\s_-]+/g, '')
    .toLowerCase();

// Header synonyms (same as preview)
const HEADER_SYNONYMS: Record<string, string[]> = {
  patient_id: ['patient_id', 'patientid', 'patient'],
  cpt_id: ['cpt_code_id', 'cptcodeid', 'cpt_id', 'cptid', 'submit_cpt_id', 'submitcptid', 'lineid', 'claimlineid'],
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

function findHeader(headers: string[], canonical: string): string | null {
  const synonyms = HEADER_SYNONYMS[canonical] || [canonical];
  for (const header of headers) {
    const normalized = norm(header);
    if (synonyms.some(syn => norm(syn) === normalized)) {
      return header;
    }
  }
  return null;
}

function getValue(row: any, headers: string[], canonical: string): any {
  const actualHeader = findHeader(headers, canonical);
  return actualHeader ? row[actualHeader] : null;
}

// Parse date
function parseDate(val: any): string | null {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;
  
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  
  // MM/DD/YYYY or M/D/YYYY
  const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, m, d, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  // Excel serial number
  if (/^\d+$/.test(str)) {
    const days = parseInt(str);
    const base = Date.UTC(1899, 11, 30);
    const ms = base + days * 86400000;
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = d.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  
  return null;
}

// Parse numeric
function parseNumeric(val: any): number | null {
  if (val == null || val === '') return null;
  const str = String(val).replace(/[^0-9.\-]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

export async function commitReimburseUpload(req: Request, res: Response) {
  const { upload_id } = req.body;

  if (!upload_id) {
    return res.status(400).json({ error: 'Missing upload_id' });
  }

  const client = await pool.connect();

  try {
    const startTime = Date.now();
    
    // Get upload record
    const uploadRecord = await pool.query(
      'SELECT * FROM rcm_file_uploads WHERE upload_id=$1',
      [upload_id]
    );

    if (uploadRecord.rows.length === 0) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    const upload = uploadRecord.rows[0];

    if (upload.status !== 'PENDING') {
      return res.status(400).json({
        error: `Upload already processed with status: ${upload.status}`
      });
    }

    const tempFilePath = upload.temp_file_path;

    if (!fs.existsSync(tempFilePath)) {
      return res.status(400).json({ error: 'Temporary file not found' });
    }

    // Update message (status remains PENDING during processing)
    await pool.query(
      `UPDATE rcm_file_uploads SET message='Uploading to S3...', updated_at=NOW() WHERE upload_id=$1`,
      [upload_id]
    );

    // Upload to S3
    const fileBuffer = fs.readFileSync(tempFilePath);
    const bucket = process.env.S3_BUCKET || '';
    const s3Key = `reimburse/${upload_id}/${upload.original_filename}`;

    const s3Result = await uploadToS3({
      bucket,
      key: s3Key,
      body: fileBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    // Update S3 info
    await pool.query(
      `UPDATE rcm_file_uploads SET s3_bucket=$1, s3_key=$2, s3_url=$3, message='Processing rows...', processing_started_at=NOW(), updated_at=NOW() WHERE upload_id=$4`,
      [bucket, s3Key, s3Result.s3Url, upload_id]
    );

    // Parse file
    const workbook = XLSX.readFile(tempFilePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: null });

    const fileHeaders = Object.keys(rawRows[0]);
    const username = upload.created_by || 'system';

    await client.query('BEGIN');

    let matched = 0;
    let updated = 0;
    let inserted = 0;
    let notFound = 0;
    let skipped = 0;
    const errors: string[] = [];

    console.log(`[REIMBURSE COMMIT] Processing ${rawRows.length} rows with batch optimization`);

    // STEP 1: Parse all rows and extract cpt_ids
    const parsedRows: Array<{ data: Record<string, any>; rowIndex: number }> = [];
    const cptIds: string[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];

      // Map all columns
      const data: Record<string, any> = {};
      
      for (const canonical of Object.keys(HEADER_SYNONYMS)) {
        const value = getValue(row, fileHeaders, canonical);
        
        // Handle dates
        if (['date_of_birth', 'service_start', 'service_end', 'charge_dt', 
             'prim_post_dt', 'prim_recv_dt', 'sec_post_dt', 'sec_recv_dt', 'pat_recv_dt'].includes(canonical)) {
          data[canonical] = parseDate(value);
        }
        // Handle numeric
        else if (['charge_amt', 'allowed_amt', 'allowed_add_amt', 'allowed_exp_amt',
                  'prim_amt', 'prim_chk_amt', 'sec_amt', 'sec_chk_amt', 'pat_amt',
                  'total_amt', 'write_off_amt', 'charges_adj_amt', 'bal_amt', 'reimb_pct', 'units'].includes(canonical)) {
          data[canonical] = parseNumeric(value);
        }
        // Handle integers
        else if (canonical === 'patient_id') {
          data[canonical] = value ? parseInt(String(value)) : null;
        }
        // Strings
        else {
          data[canonical] = value ? String(value).trim() : null;
        }
      }

      // Validation: require cpt_id
      if (!data.cpt_id || String(data.cpt_id).trim() === '') {
        skipped++;
        if (errors.length < 20) {
          errors.push(`Row ${i + 2}: Missing cpt_id`);
        }
        continue;
      }

      parsedRows.push({ data, rowIndex: i });
      cptIds.push(String(data.cpt_id).trim());
    }

    console.log(`[REIMBURSE COMMIT] Parsed ${parsedRows.length} valid rows, ${skipped} skipped`);

    // STEP 2: Batch fetch all existing records by submit_cpt_id
    const existingRecordsMap = new Map<string, any>();
    
    if (cptIds.length > 0) {
      console.log(`[REIMBURSE COMMIT] Fetching existing records for ${cptIds.length} cpt_ids`);
      const existingResult = await client.query(
        `SELECT * FROM api_bil_claim_reimburse WHERE submit_cpt_id = ANY($1)`,
        [cptIds]
      );
      
      for (const row of existingResult.rows) {
        existingRecordsMap.set(row.submit_cpt_id, row);
      }
      
      console.log(`[REIMBURSE COMMIT] Found ${existingRecordsMap.size} existing records by submit_cpt_id`);
    }

    // STEP 3: Separate rows into UPDATE and INSERT batches
    const rowsToUpdate: Array<{ reimburseId: number; data: Record<string, any>; existing: any }> = [];
    const rowsToInsert: Array<Record<string, any>> = [];

    for (const { data, rowIndex } of parsedRows) {
      const cptId = String(data.cpt_id).trim();
      const existing = existingRecordsMap.get(cptId);

      if (existing) {
        // Will UPDATE
        matched++;
        rowsToUpdate.push({ reimburseId: existing.bil_claim_reimburse_id, data, existing });
      } else {
        // Will INSERT
        notFound++;
        rowsToInsert.push(data);
      }
    }

    console.log(`[REIMBURSE COMMIT] Will update ${rowsToUpdate.length} records, insert ${rowsToInsert.length} new records`);

    // STEP 4: Batch UPDATE existing records with chunked change logs
    const allChangeLogs: Array<[number, string, any, any]> = [];
    
    for (const { reimburseId, data, existing } of rowsToUpdate) {
      // Build UPDATE for non-null fields
      const updates: any = {};
      const updateCols: string[] = [];

      for (const [col, val] of Object.entries(data)) {
        if (col === 'cpt_id') continue; // Don't update primary key
        if (val !== null && val !== undefined && val !== '') {
          if (existing[col] !== val) {
            updates[col] = val;
            updateCols.push(col);
          }
        }
      }

      if (updateCols.length > 0) {
        const setClauses = updateCols.map((c, idx) => `"${c}" = $${idx + 2}`).join(', ');
        const updateParams = [reimburseId, ...updateCols.map(c => updates[c])];

        await client.query(
          `UPDATE api_bil_claim_reimburse SET ${setClauses}, updated_at = NOW() WHERE bil_claim_reimburse_id = $1`,
          updateParams
        );

        updated++;

        // Collect changes for batch logging
        for (const col of updateCols) {
          allChangeLogs.push([reimburseId, col, existing[col], updates[col]]);
        }
      }
      
      // Progress logging every 100 rows
      if ((updated + 1) % 100 === 0) {
        console.log(`[REIMBURSE COMMIT] Updated ${updated} / ${rowsToUpdate.length} records...`);
      }
    }

    console.log(`[REIMBURSE COMMIT] Updated ${updated} records`);

    // STEP 4b: Batch insert all change logs in chunks of 1000
    if (allChangeLogs.length > 0) {
      console.log(`[REIMBURSE COMMIT] Logging ${allChangeLogs.length} field changes...`);
      
      const CHUNK_SIZE = 1000;
      let loggedCount = 0;
      
      for (let chunkStart = 0; chunkStart < allChangeLogs.length; chunkStart += CHUNK_SIZE) {
        const chunk = allChangeLogs.slice(chunkStart, chunkStart + CHUNK_SIZE);
        
        const changeLogValues: string[] = [];
        const changeLogParams: any[] = [];
        let paramIdx = 1;
        
        for (const [reimburseId, col, oldVal, newVal] of chunk) {
          changeLogValues.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5})`);
          changeLogParams.push(reimburseId, upload_id, username, col, oldVal, newVal);
          paramIdx += 6;
        }
        
        await client.query(
          `INSERT INTO upl_change_logs (claim_id, upload_id, username, field_name, old_value, new_value)
           VALUES ${changeLogValues.join(', ')}`,
          changeLogParams
        );
        
        loggedCount += chunk.length;
        
        if (loggedCount % 5000 === 0 || loggedCount === allChangeLogs.length) {
          console.log(`[REIMBURSE COMMIT] Logged ${loggedCount} / ${allChangeLogs.length} changes...`);
        }
      }
      
      console.log(`[REIMBURSE COMMIT] Completed logging ${allChangeLogs.length} changes`);
    }

    // STEP 5: Batch INSERT new records
    if (rowsToInsert.length > 0) {
      // Get all unique columns across all rows
      const allCols = new Set<string>();
      for (const data of rowsToInsert) {
        for (const col of Object.keys(data)) {
          if (data[col] !== null && data[col] !== undefined && data[col] !== '') {
            allCols.add(col);
          }
        }
      }
      
      const insertCols = Array.from(allCols);
      
      if (insertCols.length > 0) {
        const colSql = insertCols.map(c => `"${c}"`).join(', ');
        
        // Build VALUES for all rows
        const valuesClauses: string[] = [];
        const allParams: any[] = [];
        let paramIndex = 1;
        
        for (const data of rowsToInsert) {
          const rowValues = insertCols.map(col => {
            const val = data[col];
            if (val !== null && val !== undefined && val !== '') {
              allParams.push(val);
              return `$${paramIndex++}`;
            } else {
              allParams.push(null);
              return `$${paramIndex++}`;
            }
          });
          valuesClauses.push(`(${rowValues.join(', ')})`);
        }
        
        await client.query(
          `INSERT INTO api_bil_claim_reimburse (${colSql}) VALUES ${valuesClauses.join(', ')}`,
          allParams
        );
        
        inserted = rowsToInsert.length;
        console.log(`[REIMBURSE COMMIT] Inserted ${inserted} new records`);
      }
    }

    await client.query('COMMIT');

    // Delete temp file
    try {
      fs.unlinkSync(tempFilePath);
    } catch {}

    // Update final status
    await pool.query(
      `UPDATE rcm_file_uploads 
       SET status='COMPLETED', 
           message=$1, 
           processing_completed_at=NOW(),
           updated_at=NOW() 
       WHERE upload_id=$2`,
      [`Complete: ${matched} matched (${updated} updated), ${inserted} new, ${skipped} skipped`, upload_id]
    );

    console.log(`[REIMBURSE COMMIT] Complete: matched=${matched}, updated=${updated}, inserted=${inserted}, skipped=${skipped}`);

    return res.json({
      upload_id,
      inserted_count: inserted,
      updated_count: updated,
      skipped_count: skipped,
      warnings: errors.length > 0 ? errors : [],
      duration_ms: Date.now() - startTime
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[REIMBURSE COMMIT] Error:', error);

    // Update upload status to FAILED
    try {
      await pool.query(
        `UPDATE rcm_file_uploads SET status='FAILED', message=$1, updated_at=NOW() WHERE upload_id=$2`,
        [error.message, upload_id]
      );
    } catch {}

    return res.status(500).json({
      error: 'Commit failed',
      details: error.message
    });
  } finally {
    client.release();
  }
}
