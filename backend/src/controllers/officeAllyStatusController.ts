import { Request, Response } from 'express';
import pool from '../config/db.js';
import XLSX from 'xlsx';
import { Readable } from 'stream';

// Expected OA status file column mappings (flexible header matching)
const HEADER_ALIASES: Record<string, string[]> = {
  oa_claimid: ['Claim ID', 'ClaimID', 'Claim Number', 'OA Claim ID', 'oa_claimid'],
  payor_status: ['Status', 'Claim Status', 'Payor Status', 'Payer Status', 'payor_status'],
  payor_reference_id: ['Payor Reference', 'Payer Reference', 'Reference ID', 'Payor Ref ID', 'payor_reference_id', 'Payer ID'],
  payer_process_date: ['Process Date', 'Processed Date', 'Date Processed', 'Payer Process Date', 'payer_process_date'],
  rejection_reason: ['Rejection Reason', 'Denial Reason', 'Reason', 'Status Reason', 'rejection_reason', 'office_ally_status_reason'],
};

// Normalize header for matching
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Find the mapped field name for a given header
function findFieldMapping(header: string): string | null {
  const normalized = normalizeHeader(header);
  
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      if (normalizeHeader(alias) === normalized) {
        return field;
      }
    }
  }
  
  return null;
}

// Parse Excel/CSV buffer and extract status updates
function parseStatusFile(buffer: Buffer): Array<Record<string, any>> {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false });
  
  // Use first sheet
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false, blankrows: false });
  
  if (!rawRows || rawRows.length === 0) {
    throw new Error('Status file is empty or has no data rows');
  }
  
  // Map headers to standardized field names
  const firstRow = rawRows[0];
  const headerMap: Record<string, string> = {};
  
  for (const excelHeader of Object.keys(firstRow)) {
    const mappedField = findFieldMapping(excelHeader);
    if (mappedField) {
      headerMap[excelHeader] = mappedField;
    }
  }
  
  // Ensure we have at minimum oa_claimid
  if (!Object.values(headerMap).includes('oa_claimid')) {
    throw new Error('Status file must contain a Claim ID column (e.g., "Claim ID", "OA Claim ID", "oa_claimid")');
  }
  
  // Transform rows
  const mapped = rawRows.map((row, idx) => {
    const obj: Record<string, any> = {};
    
    for (const [excelHeader, value] of Object.entries(row)) {
      const field = headerMap[excelHeader];
      if (field) {
        obj[field] = value && String(value).trim() !== '' ? String(value).trim() : null;
      }
    }
    
    // Skip rows without oa_claimid
    if (!obj.oa_claimid) {
      return null;
    }
    
    return obj;
  }).filter(Boolean) as Array<Record<string, any>>;
  
  return mapped;
}

// Log field changes to upl_change_logs
async function logFieldChange(
  client: any,
  claimId: number,
  fieldName: string,
  oldValue: any,
  newValue: any,
  username: string = 'OFFICE_ALLY'
): Promise<void> {
  const oldStr = oldValue != null ? String(oldValue) : null;
  const newStr = newValue != null ? String(newValue) : null;
  
  // Only log if value actually changed
  if (oldStr === newStr) return;
  
  await client.query(
    `INSERT INTO upl_change_logs (claim_id, username, field_name, old_value, new_value, source, timestamp)
     VALUES ($1, $2, $3, $4, $5, 'OFFICE_ALLY', NOW())`,
    [claimId, username, fieldName, oldStr, newStr]
  );
}

/**
 * Upload and process Office Ally status file
 * @route POST /api/office-ally/status-upload
 */
export async function uploadOfficeAllyStatus(req: Request, res: Response) {
  const startTime = Date.now();
  
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const buffer = req.file.buffer;
    
    // Parse the status file
    let statusUpdates: Array<Record<string, any>>;
    try {
      statusUpdates = parseStatusFile(buffer);
    } catch (parseError: any) {
      return res.status(400).json({ 
        error: 'Failed to parse status file', 
        details: parseError.message 
      });
    }
    
    if (statusUpdates.length === 0) {
      return res.status(400).json({ 
        error: 'No valid status updates found in file' 
      });
    }
    
    // Process updates in a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      let matched = 0;
      let updated = 0;
      let notFound = 0;
      const errors: string[] = [];
      const updatedClaims: number[] = [];
      
      for (const update of statusUpdates) {
        const { oa_claimid, payor_status, payor_reference_id, payer_process_date, rejection_reason } = update;
        
        if (!oa_claimid) {
          errors.push(`Row missing oa_claimid`);
          continue;
        }
        
        // Find the claim by oa_claimid
        const claimRes = await client.query(
          `SELECT bil_claim_submit_id, office_ally_status, payor_reference_id, payer_process_date, office_ally_status_reason
           FROM api_bil_claim_submit
           WHERE oa_claimid = $1
           LIMIT 1`,
          [oa_claimid]
        );
        
        if (claimRes.rowCount === 0) {
          notFound++;
          if (errors.length < 100) {
            errors.push(`Claim ${oa_claimid} not found in database`);
          }
          continue;
        }
        
        matched++;
        
        const claim = claimRes.rows[0];
        const claimId = claim.bil_claim_submit_id;
        
        // Track which fields will be updated
        const fieldsToUpdate: Record<string, any> = {};
        
        // Map payor_status to office_ally_status
        if (payor_status != null) {
          fieldsToUpdate.office_ally_status = payor_status;
        }
        
        if (payor_reference_id != null) {
          fieldsToUpdate.payor_reference_id = payor_reference_id;
        }
        
        if (payer_process_date != null) {
          // Try to parse the date
          let parsedDate: string | null = null;
          try {
            const d = new Date(payer_process_date);
            if (!isNaN(d.getTime())) {
              parsedDate = d.toISOString();
            }
          } catch {
            // If parsing fails, store as-is (database will reject invalid formats)
          }
          fieldsToUpdate.payer_process_date = parsedDate || payer_process_date;
        }
        
        // Map rejection_reason to office_ally_status_reason
        if (rejection_reason != null) {
          fieldsToUpdate.office_ally_status_reason = rejection_reason;
        }
        
        // Only update if there are changes
        if (Object.keys(fieldsToUpdate).length === 0) {
          continue;
        }
        
        // Build UPDATE query
        const updateFields = Object.keys(fieldsToUpdate);
        const updateValues = Object.values(fieldsToUpdate);
        const setSql = updateFields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        
        await client.query(
          `UPDATE api_bil_claim_submit SET ${setSql} WHERE bil_claim_submit_id = $${updateFields.length + 1}`,
          [...updateValues, claimId]
        );
        
        updated++;
        updatedClaims.push(claimId);
        
        // Log field changes
        for (const [field, newValue] of Object.entries(fieldsToUpdate)) {
          // Map back from database field names to logical field names for changelog
          let logFieldName = field;
          if (field === 'office_ally_status') logFieldName = 'payor_status';
          if (field === 'office_ally_status_reason') logFieldName = 'rejection_reason';
          
          const oldValue = claim[field];
          await logFieldChange(client, claimId, logFieldName, oldValue, newValue, 'OFFICE_ALLY');
        }
      }
      
      await client.query('COMMIT');
      
      const duration = Date.now() - startTime;
      
      return res.status(200).json({
        success: true,
        message: `Successfully processed ${statusUpdates.length} status updates`,
        stats: {
          total_rows: statusUpdates.length,
          matched,
          updated,
          not_found: notFound,
          skipped: statusUpdates.length - matched - notFound,
        },
        updated_claims: updatedClaims,
        errors: errors.slice(0, 50), // Limit error list
        duration_ms: duration,
      });
      
    } catch (dbError: any) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
    
  } catch (error: any) {
    console.error('Office Ally status upload error:', error);
    return res.status(500).json({
      error: 'Failed to process Office Ally status file',
      details: error.message,
    });
  }
}
