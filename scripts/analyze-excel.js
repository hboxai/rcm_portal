/*
  Quick analyzer for the Excel file in project root.
  - Detects workbook sheets
  - For each sheet: prints first 5 rows and column headers
  - Reports basic stats (row/col counts)
*/

const fs = require('fs');
const path = require('path');

// Prefer exact filename but fallback to first xls/xlsx in root
const ROOT = path.join(__dirname, '..');
const CANDIDATES = [
  'Venocure Upload _6_11_2025_File1.xls'
];

function findWorkbook() {
  for (const name of CANDIDATES) {
    const p = path.join(ROOT, name);
    if (fs.existsSync(p)) return p;
  }
  const entries = fs.readdirSync(ROOT);
  const xfiles = entries.filter(f => /\.xls[xm]?$/i.test(f));
  if (xfiles.length) return path.join(ROOT, xfiles[0]);
  throw new Error('No .xls/.xlsx file found in project root');
}

async function main() {
  const filePath = findWorkbook();
  console.log('Workbook:', path.basename(filePath));

  // Use xlsx library which supports .xls via sheetjs
  let xlsx;
  try {
    xlsx = require('xlsx');
  } catch {
    console.error('Missing dependency: xlsx. Run: npm i xlsx');
    process.exit(1);
  }

  const wb = xlsx.readFile(filePath, { cellDates: true, cellNF: false, cellText: false });
  const sheetNames = wb.SheetNames;
  console.log('Sheets:', sheetNames.join(', '));

  for (const name of sheetNames) {
    const ws = wb.Sheets[name];
    const aoa = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

    const rowCount = aoa.length;
    const colCount = Math.max(0, ...aoa.map(r => r.length));
    const header = aoa[0] || [];
    const sample = aoa.slice(1, 6);

    console.log('\n=== Sheet:', name, '===');
    console.log('Rows:', rowCount, 'Cols:', colCount);
    console.log('Header:', header);
    console.log('Sample rows (up to 5):');
    for (const r of sample) console.log(r);

    // Also provide key/value sample using first row as header when plausible
    if (header.length && sample.length) {
      const objects = sample.map(r => Object.fromEntries(header.map((h, i) => [String(h || `col_${i+1}`), r[i] ?? null])));
      console.log('Sample as objects:');
      console.dir(objects, { depth: null });
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
