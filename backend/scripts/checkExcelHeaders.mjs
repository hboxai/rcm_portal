import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const norm = (s) => (s || '')
  .toString()
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, '')
  .replace(/[^A-Za-z0-9]/g, '')
  .toUpperCase();

// Expected headers from the Submit table (claims table UI)
const expectedHeaders = [
  'Status',
  'ClaimID',
  'Patient',
  'DOB',
  'Insurance',
  'TotalCharges',
];

const variants = {
  'CLAIMID': 'ClaimID',
  'CLAIMID#': 'ClaimID',
  'CLAIM_ID': 'ClaimID',
  'CLAIM ID': 'ClaimID',
  'OACLAIMID': 'ClaimID',
  'PATIENT': 'Patient',
  'PATIENTNAME': 'Patient',
  'MEMBERNAME': 'Patient',
  'DOB': 'DOB',
  'DATEOFBIRTH': 'DOB',
  'D.O.B.': 'DOB',
  'INSURANCE': 'Insurance',
  'PAYER': 'Insurance',
  'PAYOR': 'Insurance',
  'PRIMINS': 'Insurance',
  'STATUS': 'Status',
  'CLAIMSTATUS': 'Status',
  'TOTALCHARGES': 'TotalCharges',
  'TOTAL': 'TotalCharges',
  'BILLEDAMOUNT': 'TotalCharges',
  'TOTALAMT': 'TotalCharges',
};

const toCanonical = (h) => variants[norm(h)] || h.trim();

function main() {
  const fileArg = process.argv.slice(2).join(' ').trim();
  if (!fileArg) {
    console.error('Usage: node backend/scripts/checkExcelHeaders.mjs "<path-to-excel>"');
    process.exit(2);
  }
  const filePath = path.isAbsolute(fileArg) ? fileArg : path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(2);
  }

  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  const headerRow = (rows[0] || []).map(String);

  const normalized = headerRow.map(norm);
  const canonical = headerRow.map(toCanonical);

  const expectedSet = new Set(expectedHeaders.map(norm));
  const foundSet = new Set(normalized);

  const missing = expectedHeaders.filter((h) => !foundSet.has(norm(h)) && !canonical.includes(h));
  const extras = headerRow.filter((h) => !expectedSet.has(norm(h)) && !expectedHeaders.includes(toCanonical(h)));

  console.log('Sheet:', sheetName);
  console.log('Raw headers:', headerRow);
  console.log('Canonical headers:', canonical);
  console.log('Expected headers:', expectedHeaders);
  console.log('---');
  if (missing.length === 0) {
    console.log('RESULT: All expected Submit table headers are present.');
  } else {
    console.log('RESULT: Missing expected headers ->', missing);
  }
  if (extras.length > 0) {
    console.log('Note: The file has extra columns not used by the Submit table ->', extras);
  }
}

main();
