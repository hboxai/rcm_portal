import pool from '../config/db.js';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import XLSX from 'xlsx';

async function streamToBuffer(stream: any): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err: any) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

const REGION = process.env.S3_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const s3 = new S3Client({ region: REGION, credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } : undefined });

const SHEET_SYNONYMS: Record<string, string[]> = {
  patient_id: ['PatientID','Patient Id','PatientId','Patient #','Patient Number'],
  patientfirst: ['PatientFirst','Patient First','PatientFirstName','FirstName','First Name'],
  patientlast: ['PatientLast','Patient Last','PatientLastName','LastName','Last Name'],
  patientdob: ['PatientDOB','DOB','DateOfBirth','Date of Birth','Birth Date'],
  fromdateofservice1: ['FromDateOfService1','From DOS1','From DOS','Service Start','ServiceDate1','DateOfService','DOS','Service Date'],
  cpt1: ['CPT1','CPT','CPT Code','CPT-1'],
  charges1: ['Charges1','Charge1','Charge Amount','ChargeAmt1','Charge Amount 1','Charge','Amount'],
};

const nk = (s: string) => (s || '').normalize('NFKC').trim().replace(/\s+/g,'').toLowerCase();

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

async function getLatestSubmitUpload() {
  const r = await pool.query(
    `SELECT upload_id, s3_bucket, s3_key, original_filename
     FROM rcm_file_uploads
     WHERE file_kind='SUBMIT_EXCEL'
     ORDER BY created_at DESC
     LIMIT 1`
  );
  if (!r.rowCount) throw new Error('No SUBMIT_EXCEL uploads found');
  return r.rows[0] as { upload_id: string; s3_bucket: string; s3_key: string; original_filename: string };
}

async function downloadExcel(bucket: string, key: string) {
  const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = (out as any).Body;
  return streamToBuffer(body);
}

async function main() {
  const argUpload = process.argv[2];
  let upload_id = argUpload;
  let bucket: string;
  let key: string;
  let original_filename: string;

  if (upload_id) {
    const r = await pool.query(`SELECT upload_id, s3_bucket, s3_key, original_filename FROM rcm_file_uploads WHERE upload_id=$1 LIMIT 1`, [upload_id]);
    if (!r.rowCount) throw new Error(`Upload not found: ${upload_id}`);
    ({ upload_id, s3_bucket: bucket, s3_key: key, original_filename } = r.rows[0]);
  } else {
    ({ upload_id, s3_bucket: bucket, s3_key: key, original_filename } = await getLatestSubmitUpload());
  }

  console.log('Using upload:', { upload_id, original_filename, bucket, key });
  const buf = await downloadExcel(bucket, key);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true, raw: false });
  const { headers, rows } = pickBestSheet(wb);
  const excelHeaders = headers;
  const excelFirst3 = rows.slice(0, 3);

  const db = await pool.query(
    `SELECT * FROM api_bil_claim_submit WHERE upload_id=$1 ORDER BY bil_claim_submit_id ASC LIMIT 3`,
    [upload_id]
  );
  const dbColumns = db.rowCount ? Object.keys(db.rows[0]) : [];
  const dbFirst3 = db.rows;

  const out = {
    upload: { upload_id, original_filename, bucket, key },
    excel: { headers: excelHeaders, first3Rows: excelFirst3 },
    db: { columns: dbColumns, first3Rows: dbFirst3 }
  };
  // Emit untruncated JSON for exact values
  console.log(JSON.stringify(out, null, 2));
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
