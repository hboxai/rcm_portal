/*
  Clears api_bil_claim_submit and inserts 2 fully-populated mock rows.
  Usage (from backend/):
    node scripts/seed-submit-table.cjs
*/
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TABLE = 'api_bil_claim_submit';

const client = new Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { require: true, rejectUnauthorized: false },
});

function ensureTextFit(s, maxLen, row) {
  if (maxLen == null) return s;
  if (maxLen <= 0) return '';
  if (typeof s !== 'string') s = String(s ?? '');
  if (maxLen === 1) return row === 1 ? 'Y' : 'N';
  if (s.length > maxLen) return s.slice(0, maxLen);
  return s;
}

function sampleFor(col, type, i, maxLen) {
  const row = i + 1; // 1-based
  const date1 = '2025-08-01';
  const date2 = '2025-08-03';
  const dos = row === 1 ? date1 : date2;
  const first = row === 1 ? 'John' : 'Jane';
  const last = row === 1 ? 'Doe' : 'Smith';
  const facility = row === 1 ? 'Downtown Health Clinic' : 'Lakeside Medical Center';
  const payer = row === 1 ? 'Medicare' : 'Aetna';
  const status = row === 1 ? 'Pending' : 'Paid';
  const chk = row === 1 ? 'CHK-1001-ABC' : 'CHK-1002-XYZ';
  const claim = row === 1 ? 'OA-CLM-1001' : 'OA-CLM-1002';
  const fileId = row === 1 ? 'FILE-001' : 'FILE-002';
  const phone = row === 1 ? '(555) 010-1001' : '(555) 010-1002';
  const city = row === 1 ? 'Austin' : 'Seattle';
  const state = row === 1 ? 'TX' : 'WA';
  const zip = row === 1 ? '73301' : '98101';
  const cpt = row === 1 ? '99213' : '97014';

  // Typed defaults
  const byType = () => {
    const t = (type || '').toLowerCase();
    if (t.includes('boolean')) return row === 1;
    if (t.includes('int') || t.includes('numeric') || t.includes('double') || t.includes('real')) return row === 1 ? 100 : 200;
    if (t.includes('timestamp')) return `${dos}T10:00:00Z`;
    if (t === 'date') return dos;
    if (t.includes('json')) return {};
    if (t.includes('char') || t.includes('text')) return ensureTextFit(`Sample ${col} row ${row}`, maxLen, row);
    return `Sample ${col} row ${row}`; // fallback
  };

  // Name-based overrides for relatable data (type-aware where needed)
  const c = col.toLowerCase();
  if (c === 'bil_claim_submit_id') return row; // PK
  if (c === 'patientfirst') return ensureTextFit(first, maxLen, row);
  if (c === 'patientlast') return ensureTextFit(last, maxLen, row);
  if (c === 'patientmidinit') return ensureTextFit(row === 1 ? 'A' : 'B', maxLen, row);
  if (c === 'dateofcurrent' || c === 'dateofsimilarillness' || c === 'unabletoworkfromdate' || c === 'unabletoworktodate') return dos;
  if (c === 'patientdob' || c === 'insureddob' || c === 'otherinsureddob' || c === 'subscriber_dob') return row === 1 ? '1985-03-14' : '1990-11-02';
  if (c.endsWith('city')) return ensureTextFit(city, maxLen, row);
  if (c.endsWith('state')) return ensureTextFit(state, maxLen, row);
  if (c.endsWith('zip')) return ensureTextFit(zip, maxLen, row);
  if (c.endsWith('phone')) return ensureTextFit(phone, maxLen, row);
  if (c === 'facilityname') return ensureTextFit(facility, maxLen, row);
  if (c === 'renderingprovidername') return ensureTextFit(row === 1 ? 'Dr. Alice Carter, MD' : 'Dr. Brian Lee, DO', maxLen, row);
  if (c === 'oaclaimid' || c === 'oa_claimid') return ensureTextFit(claim, maxLen, row);
  if (c === 'oa_fileid') return ensureTextFit(fileId, maxLen, row);
  if (c === 'oaupload') return ensureTextFit('manual', maxLen, row);
  if (c === 'payor_status') return ensureTextFit(status, maxLen, row);
  if (c === 'payor_reference_id') return ensureTextFit(row === 1 ? 'PR-789001' : 'PR-789002', maxLen, row);
  if (c === 'patientacctnumber') return ensureTextFit(row === 1 ? 'ACCT-1001' : 'ACCT-1002', maxLen, row);
  if (c === 'patient_emr_no') return ensureTextFit(row === 1 ? 'EMR-001' : 'EMR-002', maxLen, row);
  // patient_id is commonly integer in schemas; prefer numeric
  if (c === 'patient_id') {
    const t = (type || '').toLowerCase();
    return t.includes('int') ? row : (row === 1 ? 'P-001' : 'P-002');
  }
  if (c.startsWith('fromdateofservice')) return dos;
  if (c.startsWith('todateofservice')) return dos;
  // place of service is often numeric (11 = Office) but may be char(2)
  if (c.startsWith('placeofservice')) {
    const t = (type || '').toLowerCase();
    return t.includes('char') ? ensureTextFit('11', maxLen, row) : 11;
  }
  // EMG flags may be boolean or Y/N
  if (c.startsWith('emg')) {
    const t = (type || '').toLowerCase();
    if (t.includes('boolean')) return false;
    return ensureTextFit('N', maxLen, row);
  }
  if (c.startsWith('cpt')) return cpt;
  if (c.startsWith('modifier')) return ensureTextFit('', maxLen, row);
  if (c.startsWith('diagcode')) return ensureTextFit(row === 1 ? 'M54.5' : 'R52', maxLen, row);
  if (c.startsWith('diagcodepointer')) return ensureTextFit('1', maxLen, row);
  if (c.startsWith('charges')) return row === 1 ? 250.0 : 320.0;
  if (c.startsWith('units')) return row === 1 ? 1 : 2;
  if (c === 'epsdt1' || c === 'epsdt2' || c === 'epsdt3' || c === 'epsdt4' || c === 'epsdt5' || c === 'epsdt6') return ensureTextFit('', maxLen, row);
  if (c.includes('prim_chk_det')) return ensureTextFit(chk, maxLen, row);
  if (c.includes('prim_ins')) return ensureTextFit(payer, maxLen, row);
  if (c.includes('sec_ins')) return ensureTextFit(row === 1 ? 'Blue Cross' : 'None', maxLen, row);
  if (c.includes('prim_amt')) return row === 1 ? 120.0 : 180.0;
  if (c.includes('sec_amt')) return row === 1 ? 30.0 : 0.0;
  if (c.includes('totalcharges') || c === 'totalcharges') return row === 1 ? 250.0 : 320.0;
  if (c === 'amountpaid') return row === 1 ? 0 : 300.0;
  if (c === 'balancedue') return row === 1 ? 250.0 : 20.0;
  if (c === 'physiciansignature') return ensureTextFit('SIGNED', maxLen, row);
  if (c === 'physiciansignaturedate') return dos;
  if (c === 'insuredfirst') return ensureTextFit(row === 1 ? 'John' : 'Jane', maxLen, row);
  if (c === 'insuredlast') return ensureTextFit(row === 1 ? 'Doe' : 'Smith', maxLen, row);
  if (c === 'insuranceplanname') return ensureTextFit(payer, maxLen, row);
  if (c === 'insurancepayerid') return ensureTextFit(row === 1 ? '012345' : '987654', maxLen, row);
  if (c === 'taxid' || c === 'ein' || c === 'ssn') return ensureTextFit(row === 1 ? '111111111' : '222222222', maxLen, row);
  if (c === 'clia_number' || c === 'hcfaclianumber') return ensureTextFit('CLIA-123456', maxLen, row);
  if (c === 'claim_frequency_code') return ensureTextFit('1', maxLen, row);
  if (c === 'original_claim_reference_number') return ensureTextFit(row === 1 ? 'ORIG-001' : 'ORIG-002', maxLen, row);
  if (c === 'patient_signature_on_file' || c === 'provider_signature_on_file') return ensureTextFit('Y', maxLen, row);
  if (c.endsWith('npi')) return ensureTextFit(row === 1 ? '1111111111' : '2222222222', maxLen, row);
  // Generic *id handling: honor integer/uuid types
  if (c.endsWith('id')) {
    const t = (type || '').toLowerCase();
    if (t.includes('int')) return 1000 + row; // numeric IDs
    if (t.includes('uuid')) return row === 1 ? '11111111-1111-1111-1111-111111111111' : '22222222-2222-2222-2222-222222222222';
    return ensureTextFit(row === 1 ? 'ID-1001' : 'ID-1002', maxLen, row); // text-like IDs
  }
  return byType();
}

async function main() {
  await client.connect();
  const meta = await client.query(
    `SELECT column_name, data_type, column_default, character_maximum_length
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1
     ORDER BY ordinal_position`,
    [TABLE]
  );
  const cols = meta.rows.map(r => ({
    name: r.column_name,
    type: r.data_type,
    maxLen: typeof r.character_maximum_length === 'number' ? r.character_maximum_length : (r.character_maximum_length ? parseInt(r.character_maximum_length, 10) : null),
    isIdentity: typeof r.column_default === 'string' && r.column_default.includes('nextval'),
  }));

  // Clear table
  await client.query(`DELETE FROM ${TABLE}`);

  // Build two rows
  for (let i = 0; i < 2; i++) {
    // Skip identity/serial columns so DB can generate them
  const insertCols = cols.filter(c => !c.isIdentity);
    const names = insertCols.map(c => c.name);
  const values = insertCols.map(c => sampleFor(c.name, c.type, i, c.maxLen));
    const placeholders = values.map((_, idx) => `$${idx + 1}`).join(',');
    const sql = `INSERT INTO ${TABLE}(${names.join(',')}) VALUES (${placeholders})`;
    await client.query(sql, values);
  }

  console.log(`Seeded 2 rows into ${TABLE}.`);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
