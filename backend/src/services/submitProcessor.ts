import pool from '../config/db.js';
import { downloadFromS3 } from './s3.js';
import { generateCptHash, detectChangedFields, getAllClaimFields } from '../utils/claimHash.js';
import { logClaimCreated, logFieldChanges } from './auditLog.js';
import { mirrorReimburseForUpload } from './reimburse.js';
import * as XLSX from 'xlsx';

interface ProcessingResult {
  success: boolean;
  processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

interface ClaimRow {
  [key: string]: any;
}

/**
 * Validate mandatory fields for a claim row
 */
function validateMandatoryFields(row: ClaimRow, rowIndex: number): string | null {
  const mandatoryFields = [
    'PatientLast',
    'PatientFirst',
    'PatientDOB',
    'FromDateOfService1',
    'ToDateOfService1',
    'CPT1',
    'CPT Code ID1',
  ];

  for (const field of mandatoryFields) {
    const value = row[field];
    if (value == null || String(value).trim() === '') {
      return `Row ${rowIndex}: Missing mandatory field "${field}"`;
    }
  }

  return null; // All mandatory fields present
}

/**
 * Normalize Excel column names to database column names
 * Excel: "PatientLast" -> DB: "patientlast"
 */
function normalizeFieldName(excelName: string): string {
  return excelName.toLowerCase().replace(/\s+/g, '');
}

/**
 * Convert Excel row to database-compatible object
 */
function excelRowToDbRow(excelRow: ClaimRow): ClaimRow {
  const dbRow: ClaimRow = {};
  
  for (const [key, value] of Object.entries(excelRow)) {
    const dbKey = normalizeFieldName(key);
    dbRow[dbKey] = value;
  }
  
  return dbRow;
}

/**
 * Process a submit claims Excel upload
 */
export async function processSubmitUpload(
  uploadId: string,
  s3Bucket: string,
  s3Key: string,
  username: string = 'SYSTEM'
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    success: false,
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const client = await pool.connect();

  try {
    // Download Excel file from S3
    const buffer = await downloadFromS3({ bucket: s3Bucket, key: s3Key });
    
    // Parse Excel
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    if (rawRows.length === 0) {
      result.errors.push('Excel file is empty');
      return result;
    }

    // Begin transaction
    await client.query('BEGIN');

    const totalRows = rawRows.length;

    // Process each row
    for (let i = 0; i < rawRows.length; i++) {
      const excelRow = rawRows[i] as ClaimRow;
      const rowIndex = i + 2; // Excel row number (1-based + header)

      try {
        // Validate mandatory fields
        const validationError = validateMandatoryFields(excelRow, rowIndex);
        if (validationError) {
          result.errors.push(validationError);
          continue;
        }

        // Convert to DB format
        const dbRow = excelRowToDbRow(excelRow);
        const cptCodeId1 = dbRow['cptcodeid1'];

        if (!cptCodeId1) {
          result.errors.push(`Row ${rowIndex}: CPT Code ID1 is required but missing`);
          continue;
        }

        // Check if claim exists (by cpt_code_id1)
        const existingQuery = `
          SELECT claim_id, cpt_hash1, cpt_hash2, cpt_hash3, cpt_hash4, cpt_hash5, cpt_hash6,
                 cycle, cpt_cycle1, cpt_cycle2, cpt_cycle3, cpt_cycle4, cpt_cycle5, cpt_cycle6
          FROM api_bil_claim_submit
          WHERE cpt_code_id1 = $1
          LIMIT 1
        `;
        const existingResult = await client.query(existingQuery, [cptCodeId1]);

        if (existingResult.rowCount === 0) {
          // NEW CLAIM - Insert
          await insertNewClaim(client, dbRow, uploadId, username, result);
          result.inserted++;
        } else {
          // EXISTING CLAIM - Check for changes
          const existingClaim = existingResult.rows[0];
          await updateExistingClaim(client, existingClaim, dbRow, uploadId, username, result);
        }

        result.processed++;

        // Update progress every 10 rows or on last row
        if ((i + 1) % 10 === 0 || i === totalRows - 1) {
          const progressPercent = Math.round(((i + 1) / totalRows) * 90); // Reserve 90% for processing, 10% for mirroring
          await pool.query(
            `UPDATE rcm_file_uploads SET processing_progress = $1 WHERE upload_id = $2`,
            [progressPercent, uploadId]
          );
        }
      } catch (rowError: any) {
        result.errors.push(`Row ${rowIndex}: ${rowError.message}`);
      }
    }

    // Commit transaction
    await client.query('COMMIT');
    
    // Update progress to 95% before mirroring
    await pool.query(
      `UPDATE rcm_file_uploads SET processing_progress = 95 WHERE upload_id = $1`,
      [uploadId]
    );
    
    // Mirror submit claims to reimburse table
    await mirrorReimburseForUpload(uploadId);
    
    // Update progress to 100% after mirroring
    await pool.query(
      `UPDATE rcm_file_uploads SET processing_progress = 100 WHERE upload_id = $1`,
      [uploadId]
    );
    
    // Update upload record with processing stats
    await pool.query(
      `UPDATE rcm_file_uploads
       SET status = $1,
           message = $2,
           claims_total_count = $3,
           claims_added_count = $4,
           claims_modified_count = $5,
           processing_completed_at = NOW()
       WHERE upload_id = $6`,
      [
        result.errors.length > 0 ? 'PARTIAL_SUCCESS' : 'SUCCESS',
        result.errors.length > 0 ? `Processed with ${result.errors.length} errors` : 'Successfully processed',
        result.processed,
        result.inserted,
        result.updated,
        uploadId,
      ]
    );

    result.success = result.errors.length === 0;
    return result;

  } catch (error: any) {
    await client.query('ROLLBACK');
    result.errors.push(`Processing failed: ${error.message}`);
    
    // Update upload record with error
    await pool.query(
      `UPDATE rcm_file_uploads
       SET status = 'ERROR',
           message = $1,
           processing_completed_at = NOW()
       WHERE upload_id = $2`,
      [error.message, uploadId]
    );
    
    return result;
  } finally {
    client.release();
  }
}

/**
 * Insert a new claim
 */
async function insertNewClaim(
  client: any,
  dbRow: ClaimRow,
  uploadId: string,
  username: string,
  result: ProcessingResult
): Promise<void> {
  // Generate hashes for all 6 CPT lines
  const hashes = {
    cpt_hash1: dbRow['cptcodeid1'] ? generateCptHash(1, dbRow) : null,
    cpt_hash2: dbRow['cptcodeid2'] ? generateCptHash(2, dbRow) : null,
    cpt_hash3: dbRow['cptcodeid3'] ? generateCptHash(3, dbRow) : null,
    cpt_hash4: dbRow['cptcodeid4'] ? generateCptHash(4, dbRow) : null,
    cpt_hash5: dbRow['cptcodeid5'] ? generateCptHash(5, dbRow) : null,
    cpt_hash6: dbRow['cptcodeid6'] ? generateCptHash(6, dbRow) : null,
  };

  // Build dynamic INSERT statement
  const fields = Object.keys(dbRow);
  const systemFields = ['upload_id', 'cycle', 'cpt_hash1', 'cpt_hash2', 'cpt_hash3', 'cpt_hash4', 'cpt_hash5', 'cpt_hash6', 'created_at'];
  const allFields = [...fields, ...systemFields];
  
  const values: any[] = [
    ...fields.map(f => dbRow[f]),
    uploadId,
    1, // Initial cycle
    hashes.cpt_hash1,
    hashes.cpt_hash2,
    hashes.cpt_hash3,
    hashes.cpt_hash4,
    hashes.cpt_hash5,
    hashes.cpt_hash6,
    new Date(),
  ];

  const placeholders = allFields.map((_, idx) => `$${idx + 1}`).join(', ');
  const fieldNames = allFields.join(', ');

  const insertSql = `
    INSERT INTO api_bil_claim_submit (${fieldNames})
    VALUES (${placeholders})
    RETURNING claim_id
  `;

  const insertResult = await client.query(insertSql, values);
  const claimId = insertResult.rows[0].claim_id;

  // Log single "claim_created" entry
  await logClaimCreated(claimId, uploadId, username);
}

/**
 * Update an existing claim if changes detected
 */
async function updateExistingClaim(
  client: any,
  existingClaim: any,
  newData: ClaimRow,
  uploadId: string,
  username: string,
  result: ProcessingResult
): Promise<void> {
  const claimId = existingClaim.claim_id;
  
  // Check each CPT line for changes using hash comparison
  const cptChanges: { lineNum: number; hasChanged: boolean }[] = [];
  
  for (let lineNum = 1; lineNum <= 6; lineNum++) {
    const cptCodeId = newData[`cptcodeid${lineNum}`];
    if (!cptCodeId) {
      cptChanges.push({ lineNum, hasChanged: false });
      continue;
    }

    const newHash = generateCptHash(lineNum as 1 | 2 | 3 | 4 | 5 | 6, newData);
    const oldHash = existingClaim[`cpt_hash${lineNum}`];

    cptChanges.push({
      lineNum,
      hasChanged: newHash !== oldHash,
    });
  }

  // If NO changes detected, skip
  const hasAnyChanges = cptChanges.some(c => c.hasChanged);
  if (!hasAnyChanges) {
    result.skipped++;
    return;
  }

  // Detect specific field changes for audit logging
  const allFields = getAllClaimFields();
  
  // Get existing claim data
  const existingDataQuery = await client.query(
    `SELECT * FROM api_bil_claim_submit WHERE claim_id = $1 LIMIT 1`,
    [claimId]
  );
  const existingData = existingDataQuery.rows[0];

  const changedFields = detectChangedFields(existingData, newData, allFields);

  if (changedFields.length === 0) {
    result.skipped++;
    return;
  }

  // Increment cycles
  const newCycle = existingClaim.cycle + 1;
  const newCptCycles = {
    cpt_cycle1: cptChanges[0].hasChanged ? (existingClaim.cpt_cycle1 || 1) + 1 : existingClaim.cpt_cycle1,
    cpt_cycle2: cptChanges[1].hasChanged ? (existingClaim.cpt_cycle2 || 1) + 1 : existingClaim.cpt_cycle2,
    cpt_cycle3: cptChanges[2].hasChanged ? (existingClaim.cpt_cycle3 || 1) + 1 : existingClaim.cpt_cycle3,
    cpt_cycle4: cptChanges[3].hasChanged ? (existingClaim.cpt_cycle4 || 1) + 1 : existingClaim.cpt_cycle4,
    cpt_cycle5: cptChanges[4].hasChanged ? (existingClaim.cpt_cycle5 || 1) + 1 : existingClaim.cpt_cycle5,
    cpt_cycle6: cptChanges[5].hasChanged ? (existingClaim.cpt_cycle6 || 1) + 1 : existingClaim.cpt_cycle6,
  };

  // Regenerate hashes
  const newHashes = {
    cpt_hash1: cptChanges[0].hasChanged ? generateCptHash(1, newData) : existingClaim.cpt_hash1,
    cpt_hash2: cptChanges[1].hasChanged ? generateCptHash(2, newData) : existingClaim.cpt_hash2,
    cpt_hash3: cptChanges[2].hasChanged ? generateCptHash(3, newData) : existingClaim.cpt_hash3,
    cpt_hash4: cptChanges[3].hasChanged ? generateCptHash(4, newData) : existingClaim.cpt_hash4,
    cpt_hash5: cptChanges[4].hasChanged ? generateCptHash(5, newData) : existingClaim.cpt_hash5,
    cpt_hash6: cptChanges[5].hasChanged ? generateCptHash(6, newData) : existingClaim.cpt_hash6,
  };

  // Build UPDATE statement
  const updateFields = Object.keys(newData);
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const field of updateFields) {
    setClauses.push(`${field} = $${paramIndex}`);
    values.push(newData[field]);
    paramIndex++;
  }

  // Add system fields
  setClauses.push(`cycle = $${paramIndex++}`);
  values.push(newCycle);

  setClauses.push(`upload_id = $${paramIndex++}`);
  values.push(uploadId);

  for (let i = 1; i <= 6; i++) {
    setClauses.push(`cpt_cycle${i} = $${paramIndex++}`);
    values.push(newCptCycles[`cpt_cycle${i}` as keyof typeof newCptCycles]);

    setClauses.push(`cpt_hash${i} = $${paramIndex++}`);
    values.push(newHashes[`cpt_hash${i}` as keyof typeof newHashes]);

    setClauses.push(`cpt_updated_at${i} = $${paramIndex++}`);
    values.push(cptChanges[i - 1].hasChanged ? new Date() : existingData[`cpt_updated_at${i}`]);
  }

  values.push(claimId);

  const updateSql = `
    UPDATE api_bil_claim_submit
    SET ${setClauses.join(', ')}
    WHERE claim_id = $${paramIndex}
  `;

  await client.query(updateSql, values);

  // Log field changes
  const changes = changedFields.map(field => ({
    field,
    oldValue: existingData[field],
    newValue: newData[field],
  }));

  await logFieldChanges(claimId, uploadId, changes, username);

  result.updated++;
}
