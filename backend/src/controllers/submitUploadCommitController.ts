import { Request, Response } from 'express';
import pool from '../config/db.js';
import { downloadFromS3, deleteFromS3 } from '../services/s3.js';
import XLSX from 'xlsx';
import crypto from 'crypto';
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

async function findExistingSubmit(client: any, rowObj: Record<string, any>): Promise<number | null> {
  // CPT-ID only matching: find an existing claim whose set of present cpt_id1..6
  // exactly matches the set in the incoming row, ignoring order. No patient/insurer keys.
  const presentCptIds: string[] = [];
  for (let li = 1; li <= 6; li++) {
    const v = rowObj[`cpt_id${li}`];
    if (v != null && String(v).trim() !== '') presentCptIds.push(String(v));
  }
  if (presentCptIds.length) {
    const targetSig = presentCptIds.slice().sort().join('|');
    const arrParam = presentCptIds;
    const sql = `
      SELECT bil_claim_submit_id, cpt_id1,cpt_id2,cpt_id3,cpt_id4,cpt_id5,cpt_id6
        FROM api_bil_claim_submit
       WHERE (cpt_id1 = ANY($1::text[]) OR cpt_id2 = ANY($1::text[]) OR cpt_id3 = ANY($1::text[])
           OR cpt_id4 = ANY($1::text[]) OR cpt_id5 = ANY($1::text[]) OR cpt_id6 = ANY($1::text[]))
       ORDER BY bil_claim_submit_id DESC
       LIMIT 100`;
    const cand = await client.query(sql, [arrParam]);
    for (const r of cand.rows) {
      const s: string[] = [];
      for (let li = 1; li <= 6; li++) {
        const v = r[`cpt_id${li}`];
        if (v != null && String(v).trim() !== '') s.push(String(v));
      }
      if (s.length && s.slice().sort().join('|') === targetSig) {
        return r.bil_claim_submit_id as number;
      }
    }
  }
  return null;
}

export async function commitSubmitUpload(req: Request, res: Response) {
  const t0 = Date.now();
  const { upload_id } = req.body || {};
  if (!upload_id) return res.status(400).json({ error: 'upload_id required' });

  try {
    const up = await pool.query(
      `SELECT upload_id, file_kind, status, s3_bucket, s3_key, s3_url, clinic
       FROM rcm_file_uploads WHERE upload_id=$1 LIMIT 1`,
      [upload_id]
    );
    if (!up.rowCount) return res.status(422).json({ error: 'Upload not found' });
    const row = up.rows[0];
    if (row.file_kind !== 'SUBMIT_EXCEL') return res.status(422).json({ error: 'Wrong upload kind' });
    if (row.status !== 'COMPLETED') return res.status(422).json({ error: 'Upload status not COMPLETED' });

    // Fetch file content
    const bucket: string = row.s3_bucket;
    const keyObj: string = row.s3_key;
    if (!bucket || !keyObj) return res.status(422).json({ error: 'Upload has no S3 location' });
    const buf = await downloadFromS3({ bucket, key: keyObj });

    // Parse workbook
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: false, raw: false });
    const { rows } = pickBestSheet(wb);

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
    try {
      await client.query('BEGIN');
      const colTypes = await getTableColumnTypes(client, 'api_bil_claim_submit');
      const schemaColumns = new Set(Object.keys(colTypes));
      let processed = 0;
      const total = rows.length || 1;
  // Update progress roughly every 2% to reduce DB chatter
  const progressStep = Math.max(1, Math.floor(total / 50));

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i];
        const mapped = mapRow(raw, schemaColumns, warnings);

        // Row-level preconditions: basic patient/insurance + at least one complete service line exists
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
          // progress and continue
        } else {
          // System fields (no per-CPT splitting for submit)
          const rowObj: Record<string, any> = { ...mapped };
          rowObj.upload_id = upload_id;
          rowObj.source_system = 'OFFICE_ALLY';

          // Ensure CPT ID 1..6 exist when a service line is present; generate if missing
          for (let li = 1; li <= 6; li++) {
            const hasLine = rowObj[`cpt${li}`] && rowObj[`fromdateofservice${li}`] && rowObj[`charges${li}`];
            const cur = rowObj[`cpt_id${li}`];
            if (hasLine && (cur == null || String(cur).trim() === '')) {
              rowObj[`cpt_id${li}`] = genLineId(rowObj, li);
            }
          }

          // Business key (row-level)
          const business = {
            payor_reference_id: rowObj.payor_reference_id ?? null,
            oa_claimid: rowObj.oa_claimid ?? null,
            clinic_id: rowObj.clinic_id ?? null,
            insurerid: rowObj.insurerid,
            fromdateofservice1: rowObj.fromdateofservice1,
            cpt1: rowObj.cpt1,
            totalcharges: rowObj.totalcharges,
          };

          let existingId = await findExistingSubmit(client, rowObj);
          // Fallback idempotency per upload via content hash of business subset
          let contentHash: string | null = null;
          if (!existingId) {
            const subset = {
              upload_id,
              insurerid: rowObj.insurerid,
              fromdateofservice1: rowObj.fromdateofservice1,
              cpt1: rowObj.cpt1,
              totalcharges: rowObj.totalcharges,
            };
            contentHash = crypto.createHash('sha256').update(JSON.stringify(subset)).digest('hex');
            const er = await client.query(
              'SELECT bil_claim_submit_id FROM api_bil_claim_submit WHERE upload_id=$1 AND content_sha256=$2 LIMIT 1',
              [upload_id, contentHash]
            );
            if (er.rowCount) existingId = er.rows[0].bil_claim_submit_id;
          }

          // type sanitization against DB column types
          const { clean, notes } = sanitizeByType(rowObj, colTypes);
          if (notes.length) {
            const remain = Math.max(0, 100 - warnings.length);
            if (remain > 0) warnings.push(...notes.slice(0, remain).map((n: string) => `Row ${i + 2}: ${n}`));
          }

          // Ensure idempotency metadata
          if (!('upload_id' in clean)) clean.upload_id = upload_id;
          if (!('source_system' in clean)) clean.source_system = 'OFFICE_ALLY';
          if (contentHash && !('content_sha256' in clean)) clean.content_sha256 = contentHash;

          const cols = Object.keys(clean);
          const vals = Object.values(clean);

          // Prepare per-line hashes and audit payloads
          const lineHashes: Array<{ i: number; hash: string; canon: Record<string, any> } > = [];
          for (let li = 1; li <= 6; li++) {
            const hasLine = clean[`cpt${li}`] || clean[`fromdateofservice${li}`] || clean[`charges${li}`];
            if (hasLine) {
              const canon = canonicalLine(clean, li);
              const hash = hashLine(canon);
              lineHashes.push({ i: li, hash, canon });
            }
          }

          if (!existingId) {
            // INSERT new submit row
            const colSql = cols.map(c => '"' + c + '"').join(',');
            const ph = vals.map((_, idx) => `$${idx + 1}`).join(',');
            const sql = `INSERT INTO api_bil_claim_submit (${colSql}) VALUES (${ph}) RETURNING bil_claim_submit_id`;
            const r = await client.query(sql, vals);
            const newId: number = r.rows[0].bil_claim_submit_id;
            inserts.push(newId);

            // Initialize per-line cycle/hash and updated_at; claim-level cycle = 1
            if (lineHashes.length) {
              const setParts: string[] = [];
              const setVals: any[] = [];
              let idx = 1;
              for (const lh of lineHashes) {
                setParts.push(`cpt_cycle${lh.i}=1`, `cpt_hash${lh.i}=$${idx++}`, `cpt_updated_at${lh.i}=NOW()`);
                setVals.push(lh.hash);
              }
              setParts.push(`cycle=1`);
              await client.query(`UPDATE api_bil_claim_submit SET ${setParts.join(', ')} WHERE bil_claim_submit_id=$${idx}`, [...setVals, newId]);
            }

            // Audit initial state (cycle 1) for present lines
            for (const lh of lineHashes) {
              const sid = clean[`cpt_id${lh.i}`];
              if (!sid) continue;
              await client.query(
                `INSERT INTO rcm_submit_line_audit (submit_cpt_id, bil_claim_submit_id, line_index, cycle, upload_id, hash_old, hash_new, old_line, new_line, diff)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                [sid, newId, lh.i, 1, upload_id, null, lh.hash, null, JSON.stringify(lh.canon), JSON.stringify(lh.canon)]
              );
            }
          } else {
            // UPDATE existing row data first
            const setSql = cols.map((c, idx) => '"' + c + '"' + `=$${idx + 1}`).join(',');
            await client.query(`UPDATE api_bil_claim_submit SET ${setSql} WHERE bil_claim_submit_id=$${cols.length + 1}`, [...vals, existingId]);

            // Fetch current hashes and line values for diff
            const old = await client.query(
              `SELECT bil_claim_submit_id,
                      ${[1,2,3,4,5,6].map(i=>`cpt_hash${i}, fromdateofservice${i}, todateofservice${i}, cpt${i}, modifiera${i}, modifierb${i}, modifierc${i}, modifierd${i}, diagcodepointer${i}, placeofservice${i}, units${i}, charges${i}`).join(', ')}
                 FROM api_bil_claim_submit WHERE bil_claim_submit_id=$1`,
              [existingId]
            );
            const prev = old.rows[0] || {};

            // Determine changed lines and build UPDATE for cycles/hashes
            const changed: Array<{ i:number; oldCanon: Record<string,any>|null; newCanon: Record<string,any>; oldHash: string|null; newHash: string; sid: any }>=[];
            for (const lh of lineHashes) {
              const oldHash = prev[`cpt_hash${lh.i}`] ?? null;
              if (oldHash !== lh.hash) {
                const oldCanon = canonicalLine(prev, lh.i);
                const sid = clean[`cpt_id${lh.i}`];
                changed.push({ i: lh.i, oldCanon, newCanon: lh.canon, oldHash, newHash: lh.hash, sid });
              }
            }

            if (changed.length) {
              // Count this row as updated only if at least one service line actually changed
              updates.push(existingId);
              const setParts: string[] = [];
              const setVals: any[] = [];
              let p = 1;
              for (const ch of changed) {
                setParts.push(`cpt_cycle${ch.i}=COALESCE(cpt_cycle${ch.i},1)+1`);
                setParts.push(`cpt_hash${ch.i}=$${p++}`);
                setVals.push(ch.newHash);
                setParts.push(`cpt_updated_at${ch.i}=NOW()`);
              }
              // First update per-line cycles/hashes in one statement
              await client.query(`UPDATE api_bil_claim_submit SET ${setParts.join(', ')} WHERE bil_claim_submit_id=$${p}`, [...setVals, existingId]);

              // Then recompute claim-level cycle from the new per-line values
              await client.query(
                `UPDATE api_bil_claim_submit 
                   SET cycle=GREATEST(COALESCE(cpt_cycle1,1),COALESCE(cpt_cycle2,1),COALESCE(cpt_cycle3,1),COALESCE(cpt_cycle4,1),COALESCE(cpt_cycle5,1),COALESCE(cpt_cycle6,1))
                 WHERE bil_claim_submit_id=$1`,
                [existingId]
              );

              // Write audits
              const cycRow = await client.query(`SELECT cpt_cycle1,cpt_cycle2,cpt_cycle3,cpt_cycle4,cpt_cycle5,cpt_cycle6 FROM api_bil_claim_submit WHERE bil_claim_submit_id=$1`, [existingId]);
              const cyc = cycRow.rows[0] || {};
              for (const ch of changed) {
                const d = diffLine(ch.oldCanon, ch.newCanon);
                // Per-line cycle after bump
                const lineCycle = Number(cyc[`cpt_cycle${ch.i}`]) || 1;
                await client.query(
                  `INSERT INTO rcm_submit_line_audit (submit_cpt_id, bil_claim_submit_id, line_index, cycle, upload_id, changed_at, hash_old, hash_new, old_line, new_line, diff)
                   VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7,$8,$9,$10)`,
                  [ch.sid, existingId, ch.i, lineCycle, upload_id, ch.oldHash, ch.newHash, JSON.stringify(ch.oldCanon), JSON.stringify(ch.newCanon), JSON.stringify(d)]
                );
              }
            }
          }
        }

        // Progress and cancellation checks so UI can poll
        processed++;
        if (processed % progressStep === 0 || processed === total) {
          const pct = Math.floor((processed / total) * 100);
          await pool.query(
            `UPDATE rcm_file_uploads SET message=$1, updated_at=NOW() WHERE upload_id=$2`,
            [`Processing ${processed}/${total} (${pct}%)`, upload_id]
          );
          // Cancellation: if user requested cancel (status flipped to FAILED), abort
          const st = await pool.query(`SELECT status FROM rcm_file_uploads WHERE upload_id=$1`, [upload_id]);
          const cur = st.rows?.[0]?.status;
          if (cur === 'FAILED') {
            throw new Error('Cancelled by user');
          }
        }
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Mirror into reimburse table for this upload (per-CPT lines, idempotent)
    const mirror = await mirrorReimburseForUpload(upload_id);
    const duration = Date.now() - t0;
    const inserted_count = inserts.length;
    const updated_count = updates.length;
    const skipped_count = skipped;

    const msg = `Committed ${inserted_count + updated_count} rows (inserted ${inserted_count}, updated ${updated_count}, skipped ${skipped_count}); Reimburse: created=${mirror.created}, updated=${mirror.updated}, deleted=${mirror.deleted}`;
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
