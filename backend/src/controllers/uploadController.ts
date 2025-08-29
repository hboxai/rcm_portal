import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import pool, { query } from '../config/db.js';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

// Generate a simple sequential ID
async function generateSequentialId(): Promise<string> {
  const result = await query('SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 as next_id FROM rcm_uploads WHERE id ~ \'^[0-9]+$\'');
  return result.rows[0].next_id.toString();
}

// Utility: normalize header/column names to match flexibly
const norm = (s: any) => String(s || '')
  .normalize('NFKC')
  .trim()
  .replace(/[\s_]+/g, '')
  .replace(/[^A-Za-z0-9_]/g, '')
  .toLowerCase();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureUploadsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS rcm_uploads (
      id VARCHAR(50) PRIMARY KEY,
      filename TEXT NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      status TEXT NOT NULL DEFAULT 'Processed',
      claims_count INTEGER NOT NULL DEFAULT 0,
    path TEXT,
    error_message TEXT
    )
  `);
  // Ensure error_message exists on older installs
  await query(`ALTER TABLE rcm_uploads ADD COLUMN IF NOT EXISTS error_message TEXT`);
}

async function ensureUploadLinksTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS rcm_upload_claim_links (
      upload_id VARCHAR(50) NOT NULL,
      submit_id INTEGER NOT NULL,
      PRIMARY KEY (upload_id, submit_id)
    )
  `);
}

async function getTableColumns(table: string): Promise<string[]> {
  const res = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [table]
  );
  return res.rows.map((r: { column_name: string }) => r.column_name);
}

type ColumnInfo = {
  column_name: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
  data_type: string;
  character_maximum_length: number | null;
};

// Get detailed column info to identify required (NOT NULL, no default) columns
async function getTableColumnsInfo(table: string): Promise<ColumnInfo[]> {
  const res = await query(
  `SELECT column_name, is_nullable, column_default, data_type, character_maximum_length
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1
     ORDER BY ordinal_position`,
    [table]
  );
  return res.rows as ColumnInfo[];
}

function readExcel(filePath: string): { headers: string[]; rows: Record<string, any>[] } {
  const wb = XLSX.readFile(filePath, { cellDates: true, raw: false, type: 'file' as any });
  const sheet = wb.SheetNames[0];
  const ws = wb.Sheets[sheet];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false, blankrows: false });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

function buildRowSubset(row: Record<string, any>, excelHeaderMap: Map<string,string>, targetCols: string[], inject: Record<string, any> = {}) {
  // Map Excel headers to DB column names by normalization
  const values: Record<string, any> = { ...inject };
  for (const dbCol of targetCols) {
    const n = norm(dbCol);
    const excelHeader = excelHeaderMap.get(n);
    if (excelHeader !== undefined) {
      values[dbCol] = row[excelHeader];
    }
  }
  return values;
}

// Enhanced mapping validation function
function validateMapping(headers: string[], targetCols: string[]): {
  mapped: Array<{excel: string, db: string}>,
  missing: string[],
  coverage: number
} {
  const excelNormMap = new Map(headers.map(h => [norm(h), h]));
  const mapped: Array<{excel: string, db: string}> = [];
  const missing: string[] = [];

  for (const dbCol of targetCols) {
    const n = norm(dbCol);
    const excelHeader = excelNormMap.get(n);
    if (excelHeader) {
      mapped.push({ excel: excelHeader, db: dbCol });
    } else {
      missing.push(dbCol);
    }
  }

  const coverage = Math.round((mapped.length / targetCols.length) * 100);
  return { mapped, missing, coverage };
}

function projectToColumns(obj: Record<string, any>, allowedCols: string[]) {
  const allowed = new Set(allowedCols.map(norm));
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (allowed.has(norm(k))) out[k] = v;
  }
  return out;
}

function buildInsertSQL(table: string, rowObj: Record<string, any>) {
  const cols = Object.keys(rowObj);
  if (!cols.length) return null;
  const placeholders = cols.map((_, i) => `$${i + 1}`);
  const sql = `INSERT INTO ${table} (${cols.map(c => '"' + c + '"').join(',')}) VALUES (${placeholders.join(',')})`;
  const vals = cols.map(c => rowObj[c]);
  return { sql, vals };
}

// Sanitize/convert values according to Postgres column data types
function sanitizeByType(value: any, dataType: string): any {
  if (value === undefined || value === null || value === '') return null;
  const t = (dataType || '').toLowerCase();
  // Dates from XLSX may already be Date objects (cellDates: true)
  const asDateString = (v: any) => {
    if (v instanceof Date && !isNaN(v.getTime())) {
      return v.toISOString().slice(0, 10); // YYYY-MM-DD
    }
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  };
  const asTimestampString = (v: any) => {
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString();
    return null;
  };

  switch (t) {
    case 'integer':
    case 'int':
    case 'smallint':
    case 'bigint': {
      if (typeof value === 'number') return Math.trunc(value);
      const s = String(value).replace(/[,\s]/g, '');
      if (s === '') return null;
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    }
    case 'numeric':
    case 'decimal':
    case 'real':
    case 'double precision': {
      if (typeof value === 'number') return value;
      const s = String(value).replace(/[,\s]/g, '');
      if (s === '') return null;
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : null;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      const s = String(value).trim().toLowerCase();
      if (['true','t','yes','y','1'].includes(s)) return true;
      if (['false','f','no','n','0'].includes(s)) return false;
      return null;
    }
    case 'date':
      return asDateString(value);
    case 'timestamp without time zone':
    case 'timestamp with time zone':
      return asTimestampString(value);
    default:
      // text, varchar, json, others -> stringify
      return typeof value === 'string' ? value : String(value);
  }
}

function sanitizeByColumnInfo(value: any, ci: ColumnInfo): any {
  const dt = (ci.data_type || '').toLowerCase();
  let v = sanitizeByType(value, dt);
  if (v === null || v === undefined) return v;
  // Truncate strings to fit character length
  if ((dt.includes('character varying') || dt === 'character' || dt === 'varchar') && ci.character_maximum_length) {
    const s = typeof v === 'string' ? v : String(v);
    if (s.length > ci.character_maximum_length) {
      return s.slice(0, ci.character_maximum_length);
    }
    return s;
  }
  // TEXT has no length limit; return as string
  if (dt === 'text') {
    return typeof v === 'string' ? v : String(v);
  }
  return v;
}

export async function uploadFile(req: Request, res: Response) {
  try {
    console.log('File upload disabled: Database tables unlinked');
    return res.status(503).json({ 
      status: 'error', 
      message: 'File upload disabled: Database tables unlinked' 
    });
  } catch (error: any) {
    return res.status(500).json({ 
      status: 'error', 
      message: 'Database tables unlinked' 
    });
  }
}

export async function listUploads(req: Request, res: Response) {
  try {
    // Ensure table exists (idempotent)
    await ensureUploadsTable();

    const fileId = (req.query.fileId as string | undefined)?.trim();
    let rows;
    if (fileId) {
      rows = (await query(
        `SELECT id, filename, uploaded_at, COALESCE(claims_count,0) AS claims_count, COALESCE(status,'Processed') AS status
         FROM rcm_uploads WHERE id = $1 LIMIT 1`,
        [fileId]
      )).rows;
    } else {
      rows = (await query(
        `SELECT id, filename, uploaded_at, COALESCE(claims_count,0) AS claims_count, COALESCE(status,'Processed') AS status
         FROM rcm_uploads ORDER BY uploaded_at DESC`)).rows;
    }

    const data = rows.map((r: any) => ({
      id: String(r.id),
      filename: r.filename,
      uploadedAt: (r.uploaded_at instanceof Date ? r.uploaded_at.toISOString() : String(r.uploaded_at)),
      claimsCount: Number(r.claims_count || 0),
      status: String(r.status || 'Processed'),
    }));

    return res.json({ status: 'success', data });
  } catch (e: any) {
    console.error('listUploads error:', e);
    return res.status(500).json({ status: 'error', message: e?.message || 'Failed to list uploads' });
  }
}

export async function getUploadById(req: Request, res: Response) {
  try {
    console.log('Upload details disabled: Database tables unlinked');
    return res.status(404).json({ 
      status: 'error', 
      message: 'Upload details disabled: Database tables unlinked' 
    });
  } catch (e: any) {
    return res.status(500).json({ status: 'error', message: 'Database tables unlinked' });
  }
}

export async function getClaimsByUpload(req: Request, res: Response) {
  try {
    console.log('Upload claims listing disabled: Database tables unlinked');
    return res.json({
      status: 'success',
      data: [],
      totalCount: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
      message: 'Upload claims disabled: Database tables unlinked'
    });
  } catch (e: any) {
    return res.status(500).json({ status: 'error', message: 'Database tables unlinked' });
  }
}

export async function deleteUpload(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
  // Remove submit rows linked to this upload (via mapping or oa_fileid fallback)
  await query('DELETE FROM api_bil_claim_submit WHERE bil_claim_submit_id IN (SELECT submit_id FROM rcm_upload_claim_links WHERE upload_id = $1)', [id]);
  await query('DELETE FROM api_bil_claim_submit WHERE oa_fileid = $1', [id]);
  await query('DELETE FROM rcm_upload_claim_links WHERE upload_id = $1', [id]);
    // Remove upload record
    await query('DELETE FROM rcm_uploads WHERE id = $1', [id]);
    return res.json({ status: 'success' });
  } catch (e: any) {
    return res.status(500).json({ status: 'error', message: e.message });
  }
}

export async function getMappingInfo(req: Request, res: Response) {
  try {
    const submitCols = await getTableColumns('api_bil_claim_submit');
    const submitColsInfo = await getTableColumnsInfo('api_bil_claim_submit');

    // Sample Excel headers for demonstration (you can modify this to use actual file)
    const sampleExcelHeaders = [
      'PatientID', 'PatientLast', 'PatientFirst', 'PatientMidInit', 'PatientDOB',
      'InsurancePlanName', 'InsurancePayerID', 'DiagCode1', 'CPTCode', 'DateOfService',
      'TotalCharges', 'RenderingProviderName', 'ICD Indicator', 'PlanMedicare'
    ];

    const mappingValidation = validateMapping(sampleExcelHeaders, submitCols);
    
    // Get required fields info
    const requiredFields = submitColsInfo.filter(ci => ci.is_nullable === 'NO' && !ci.column_default);
    const systemFields = ['bil_claim_submit_id', 'oa_fileid', 'oa_claimid', 'clinic_id'];
    const userRequiredFields = requiredFields.filter(ci => !systemFields.includes(ci.column_name));

    return res.json({
      status: 'success',
      data: {
        totalDbColumns: submitCols.length,
        mappedFields: mappingValidation.mapped.length,
        coverage: mappingValidation.coverage,
        keyMappings: mappingValidation.mapped.slice(0, 20), // First 20 mappings
        missingMappings: mappingValidation.missing.slice(0, 10), // First 10 missing
        requiredFields: userRequiredFields.map(ci => ({
          column: ci.column_name,
          type: ci.data_type,
          maxLength: ci.character_maximum_length
        })),
        systemGeneratedFields: systemFields
      }
    });
  } catch (e: any) {
    return res.status(500).json({ status: 'error', message: e.message });
  }
}

export async function getValidationReport(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
    // Try to load the stored file path to re-parse headers
    const r = await query('SELECT filename, path, error_message FROM rcm_uploads WHERE id = $1', [id]);
    if (!r.rowCount) return res.status(404).json({ status: 'error', message: 'Not found' });
    const { filename, path: p, error_message } = r.rows[0];
    if (!p || !fs.existsSync(p)) return res.json({ status: 'success', data: [ 'Original file is no longer available on server to validate.' ] });

    const { headers } = readExcel(p);
    const normHeaders = headers.map(h => norm(h));
    const submitColsInfo = await getTableColumnsInfo('api_bil_claim_submit');
    const requiredNoDefault = submitColsInfo.filter(ci => ci.is_nullable === 'NO' && !ci.column_default);
    const missingRequired = requiredNoDefault
      .map(ci => ci.column_name)
      .filter(col => col.toLowerCase() !== 'oa_fileid')
      .filter(col => !normHeaders.includes(norm(col)));

    const lines: string[] = [];
    if (error_message) {
      lines.push(`Last error: ${error_message}`);
    }
    if (missingRequired.length) {
      lines.push('Missing required columns (NOT NULL, no default) in api_bil_claim_submit:');
      for (const c of missingRequired) lines.push(` - ${c}`);
    } else {
      lines.push('No required columns appear to be missing.');
    }
    lines.push(`Detected ${headers.length} headers in file "${filename}".`);
    return res.json({ status: 'success', data: lines });
  } catch (e: any) {
    return res.status(500).json({ status: 'error', message: e.message });
  }
}

export async function downloadUploadFile(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
    const r = await query('SELECT filename, path FROM rcm_uploads WHERE id = $1', [id]);
    if (!r.rowCount) return res.status(404).json({ status: 'error', message: 'Not found' });
    const { filename, path: p } = r.rows[0];
    if (!p || !fs.existsSync(p)) return res.status(404).json({ status: 'error', message: 'File missing' });
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(p).pipe(res);
  } catch (e: any) {
    return res.status(500).json({ status: 'error', message: e.message });
  }
}

export async function getUploadPreview(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
    const limit = parseInt(req.query.limit as string) || 50; // Default to first 50 rows for preview
    
    const r = await query('SELECT filename, path FROM rcm_uploads WHERE id = $1', [id]);
    if (!r.rowCount) return res.status(404).json({ status: 'error', message: 'Upload not found' });
    
    const { filename, path: filePath } = r.rows[0];
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ status: 'error', message: 'File not found on disk' });
    }

    let previewData: any[] = [];
    let allDataRows: any[] = []; // To count total meaningful rows
    let headers: string[] = [];

    if (filename.toLowerCase().endsWith('.csv')) {
      // Handle CSV files
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length > 0) {
        headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        // Process all rows to get accurate counts
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue; // Skip empty lines
          
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          
          // Skip rows with no meaningful data
          const hasData = values.some(val => val !== undefined && val !== null && val.trim() !== '');
          if (!hasData) continue;
          
          const row: any = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx] || '';
          });
          
          allDataRows.push(row);
          
          // Only add to preview if within limit
          if (previewData.length < limit) {
            previewData.push(row);
          }
        }
      }
    } else {
      // Handle Excel files (.xlsx, .xls)
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to array of arrays first
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
      
      if (rawData.length > 0) {
        headers = (rawData[0] as string[]) || [];
        
        // Process all rows to get accurate counts
        for (let i = 1; i < rawData.length; i++) {
          const values = rawData[i] as string[];
          
          // Skip completely empty rows
          const hasData = values && values.some(val => val !== undefined && val !== null && String(val).trim() !== '');
          if (!hasData) continue;
          
          const row: any = {};
          headers.forEach((header, idx) => {
            row[header] = values?.[idx] || '';
          });
          
          allDataRows.push(row);
          
          // Only add to preview if within limit
          if (previewData.length < limit) {
            previewData.push(row);
          }
        }
      }
    }

    return res.json({ 
      status: 'success', 
      data: {
        headers,
        rows: previewData,
        totalRows: allDataRows.length, // Total meaningful rows in file
        totalPreviewRows: previewData.length, // Rows shown in this preview
        filename
      }
    });
  } catch (e: any) {
    console.error('Preview error:', e);
    return res.status(500).json({ status: 'error', message: e.message });
  }
}
