import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

// Normalize a header for robust comparison: trim, remove non-alphanumerics, uppercase
const norm = (s: string) => (s || '')
  .toString()
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, '')
  .replace(/[^A-Za-z0-9]/g, '')
  .toUpperCase();

// Expected headers from the Submit table (Claims table)
const expectedHeaders = [
  'Status',
  'ClaimID',
  'Patient',
  'DOB',
  'Insurance',
  'TotalCharges',
];

// Acceptable variants mapping -> canonical
const variants: Record<string, string> = {
  // Claim ID
  'CLAIMID': 'ClaimID',
  'CLAIMID#': 'ClaimID',
  'CLAIM_ID': 'ClaimID',
  'CLAIM ID': 'ClaimID',
  'OACLAIMID': 'ClaimID',
  // Patient
  'PATIENT': 'Patient',
  'PATIENTNAME': 'Patient',
  'MEMBERNAME': 'Patient',
  // DOB
  'DOB': 'DOB',
  'DATEOFBIRTH': 'DOB',
  'D.O.B.': 'DOB',
  // Insurance/Payer
  'INSURANCE': 'Insurance',
  'PAYER': 'Insurance',
  'PAYOR': 'Insurance',
  'PRIMINS': 'Insurance',
  // Status
  'STATUS': 'Status',
  'CLAIMSTATUS': 'Status',
  // Total Charges / Billed
  'TOTALCHARGES': 'TotalCharges',
  'TOTAL': 'TotalCharges',
  'BILLEDAMOUNT': 'TotalCharges',
  'TOTALAMT': 'TotalCharges',
};

function toCanonical(h: string): string {
  const n = norm(h);
  return variants[n] || h.trim();
}

function main() {
  const fileArg = process.argv.slice(2).join(' ').trim();
  if (!fileArg) {
    console.error('Usage: tsx backend/scripts/checkExcelHeaders.ts "<path-to-excel>"');
    process.exit(2);
  }

  const filePath = path.isAbsolute(fileArg)
    ? fileArg
    : path.resolve(process.cwd(), fileArg);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(2);
  }

  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  const headerRow: string[] = (rows[0] || []).map(String);

  const normalized = headerRow.map(norm);
  const canonical = headerRow.map(toCanonical);

  const expectedSet = new Set(expectedHeaders.map(norm));
  const foundSet = new Set(normalized);

  const missing = expectedHeaders.filter(h => !foundSet.has(norm(h)) && !canonical.includes(h));
  const extras = headerRow.filter(h => !expectedSet.has(norm(h)) && !expectedHeaders.includes(toCanonical(h)));

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
