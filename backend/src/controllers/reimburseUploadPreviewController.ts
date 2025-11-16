import { Request, Response } from 'express';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';

// Normalize header names for flexible matching
const norm = (s: string): string =>
  String(s ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/[\s_-]+/g, '')
    .toLowerCase();

// Header synonyms for reimburse files
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

// Find actual header from file that matches canonical name
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

// Get value from row using actual header name
function getValue(row: any, headers: string[], canonical: string): any {
  const actualHeader = findHeader(headers, canonical);
  return actualHeader ? row[actualHeader] : null;
}

export async function previewReimburseUpload(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const username = (req as any).user?.username || 'system';
    const uploadId = uuidv4();
    const originalFilename = req.file.originalname;
    const tempFilePath = path.join(process.cwd(), 'uploads', 'temp', `${uploadId}_${originalFilename}`);

    // Ensure temp directory exists
    const tempDir = path.dirname(tempFilePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Save file temporarily
    fs.writeFileSync(tempFilePath, req.file.buffer);

    // Parse file
    const workbook = XLSX.readFile(tempFilePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: null });

    if (rawRows.length === 0) {
      fs.unlinkSync(tempFilePath);
      return res.status(400).json({ error: 'File is empty' });
    }

    // Get actual headers from file
    const fileHeaders = Object.keys(rawRows[0]);
    
    console.log('========================================');
    console.log('[REIMBURSE PREVIEW] File headers:', fileHeaders);
    console.log('[REIMBURSE PREVIEW] Total headers found:', fileHeaders.length);
    
    // Show each header and its normalized form
    fileHeaders.forEach(h => {
      console.log(`  Header: "${h}" -> Normalized: "${norm(h)}"`);
    });
    
    // Show what we're looking for
    console.log('[REIMBURSE PREVIEW] Looking for cpt_id synonyms:', HEADER_SYNONYMS['cpt_id']);
    console.log('[REIMBURSE PREVIEW] Normalized synonyms:', HEADER_SYNONYMS['cpt_id'].map(s => norm(s)));

    // Validate required field: cpt_id (submit_cpt_id) - check multiple possible names
    let cptIdHeader = findHeader(fileHeaders, 'cpt_id');
    console.log('[REIMBURSE PREVIEW] findHeader result:', cptIdHeader);
    
    // Manual fallback: check for common variations
    if (!cptIdHeader) {
      console.log('[REIMBURSE PREVIEW] findHeader failed, trying manual fallback...');
      const possibleHeaders = ['cpt_code_id', 'cpt_id', 'submit_cpt_id', 'submitcptid', 'cptcodeid', 'cptid'];
      for (const possible of possibleHeaders) {
        const found = fileHeaders.find(h => norm(h) === norm(possible));
        console.log(`  Checking "${possible}" (${norm(possible)}): ${found ? 'FOUND as "' + found + '"' : 'NOT FOUND'}`);
        if (found) {
          cptIdHeader = found;
          console.log(`[REIMBURSE PREVIEW] ✓ Found cpt_id via fallback: ${found}`);
          break;
        }
      }
    }
    
    console.log('[REIMBURSE PREVIEW] Final cpt_id header:', cptIdHeader);
    console.log('========================================');
    
    if (!cptIdHeader) {
      fs.unlinkSync(tempFilePath);
      return res.status(400).json({
        error: 'Missing required header: cpt_id (submit_cpt_id/CPT Code ID)',
        headers_found: fileHeaders,
        normalized_headers: fileHeaders.map(h => norm(h)),
        expected: 'cpt_code_id, cpt_id, submit_cpt_id, cptcodeid, submitcptid, or similar'
      });
    }

    // Count valid rows
    let validRows = 0;
    let invalidRows = 0;
    const validationErrors: string[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const cptId = getValue(row, fileHeaders, 'cpt_id');

      if (!cptId || String(cptId).trim() === '') {
        invalidRows++;
        if (validationErrors.length < 10) {
          validationErrors.push(`Row ${i + 2}: Missing cpt_id`);
        }
      } else {
        validRows++;
      }
    }

    // Create upload record with PENDING status
    await pool.query(
      `INSERT INTO rcm_file_uploads 
       (upload_id, file_kind, original_filename, temp_file_path, status, created_by, row_count, message, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [
        uploadId,
        'REIMBURSE_EXCEL',
        originalFilename,
        tempFilePath,
        'PENDING',
        username,
        rawRows.length,
        `Preview: ${validRows} valid rows, ${invalidRows} invalid rows`
      ]
    );

    console.log(`[REIMBURSE PREVIEW] Upload ${uploadId}: ${validRows} valid, ${invalidRows} invalid`);

    // Return preview data (matching frontend ReimbursePreviewResponse type)
    return res.json({
      upload_id: uploadId,
      original_filename: originalFilename,
      row_count: rawRows.length,
      valid_count: validRows,
      invalid_count: invalidRows,
      columns_mapped: Object.fromEntries(
        Object.keys(HEADER_SYNONYMS).map(canonical => [canonical, findHeader(fileHeaders, canonical)])
      ),
      sample_valid: rawRows.slice(0, 5), // First 5 rows for preview
      sample_invalid: [],
      warnings: validationErrors.length > 0 ? validationErrors : [],
      can_commit: validRows > 0 && invalidRows === 0,
      errors: invalidRows > 0 ? [`${invalidRows} rows failed validation`] : undefined,
    });

  } catch (error: any) {
    console.error('[REIMBURSE PREVIEW] Error:', error);
    return res.status(500).json({
      error: 'Preview failed',
      details: error.message
    });
  }
}
