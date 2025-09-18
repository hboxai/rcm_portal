import pool, { query } from '../config/db.js';
import {
  S3Client,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  ListObjectsV2Output,
  _Object,
} from '@aws-sdk/client-s3';

type ObjRef = { bucket: string; key: string };

async function tableExists(name: string): Promise<boolean> {
  const r = await query(`SELECT to_regclass($1) AS reg`, [name]);
  return !!r.rows[0]?.reg;
}

async function listExistingTables(names: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const n of names) {
    if (await tableExists(n)) out.push(n);
  }
  return out;
}

async function fetchAllObjects(): Promise<ObjRef[]> {
  const res = await query(
    `SELECT s3_bucket AS bucket, s3_key AS key
     FROM rcm_file_uploads
     WHERE s3_bucket IS NOT NULL AND s3_key IS NOT NULL`
  );
  return res.rows.map((r: any) => ({ bucket: String(r.bucket), key: String(r.key) }));
}

async function deleteByBucket(objs: ObjRef[]) {
  if (objs.length === 0) return { deleted: 0, errors: 0 };
  const REGION = process.env.S3_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const s3 = new S3Client({
    region: REGION,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! }
      : undefined,
  });

  let deleted = 0;
  let errors = 0;
  const byBucket = objs.reduce((m, o) => { (m[o.bucket] ||= []).push(o.key); return m; }, {} as Record<string, string[]>);
  for (const [bucket, keys] of Object.entries(byBucket)) {
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000);
      try {
        const out = await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: chunk.map(Key => ({ Key })) } }));
        deleted += out.Deleted?.length || 0;
        errors += out.Errors?.length || 0;
        if ((out.Errors?.length || 0) > 0) {
          console.warn(`S3 delete partial errors for bucket ${bucket}:`, out.Errors?.slice(0, 3));
        }
      } catch (e: any) {
        errors += chunk.length;
        console.error(`S3 delete failed for bucket ${bucket} keys[${i}-${i + chunk.length - 1}]:`, e?.message || e);
      }
    }
  }
  return { deleted, errors };
}

async function purgeS3Prefix(bucket: string, prefix: string): Promise<number> {
  if (!bucket) return 0;
  const region = process.env.S3_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const s3 = new S3Client({ region });
  let deleted = 0;
  let ContinuationToken: string | undefined = undefined;
  for (;;) {
    const list: ListObjectsV2Output = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken }));
    const contents = (list.Contents || []) as _Object[];
    if (contents.length > 0) {
      const toDelete = contents.map(o => ({ Key: o.Key! }));
      await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: toDelete, Quiet: true } }));
      deleted += toDelete.length;
    }
    if (!list.IsTruncated) break;
    ContinuationToken = list.NextContinuationToken;
  }
  return deleted;
}

async function resetTables() {
  const targets = await listExistingTables([
    'api_bil_claim_reimburse',
    'api_bil_claim_submit',
    'rcm_upload_claim_links',
    'rcm_uploads',
    'rcm_file_uploads',
  ]);

  if (targets.length === 0) {
    console.log('No known target tables exist; skipping TRUNCATE');
    return;
  }

  await query('BEGIN');
  try {
    const sql = `TRUNCATE TABLE ${targets.map(t => t).join(', ')} RESTART IDENTITY CASCADE`;
    await query(sql);
    await query('COMMIT');
  } catch (e) {
    await query('ROLLBACK');
    throw e;
  }
}

async function verifyCounts() {
  async function countIf(table: string): Promise<number | null> {
    if (!(await tableExists(table))) return null;
    const r = await query(`SELECT COUNT(*)::int AS n FROM ${table}`);
    return r.rows[0]?.n ?? 0;
  }
  const tables = [
    'api_bil_claim_submit',
    'api_bil_claim_reimburse',
    'rcm_file_uploads',
    'rcm_uploads',
    'rcm_upload_claim_links',
  ];
  for (const t of tables) {
    const n = await countIf(t);
    if (n !== null) console.log(`${t} rows: ${n}`);
  }
}

async function main() {
  console.log('--- Full Reset: submit, reimburse, uploads, upload links, and S3 ---');

  // 1) Delete S3 objects referenced in DB
  try {
    console.log('Fetching S3 object references from rcm_file_uploads…');
    const objs = (await tableExists('rcm_file_uploads')) ? await fetchAllObjects() : [];
    console.log(`Found ${objs.length} objects to delete (by DB reference)`);
    const { deleted, errors } = await deleteByBucket(objs);
    console.log(`S3 delete (by DB) summary: deleted=${deleted}, errors=${errors}`);
  } catch (e: any) {
    console.warn('Skipping S3 delete-by-DB due to error:', e?.message || e);
  }

  // 2) Purge S3 known prefixes (submit/)
  const bucket = process.env.S3_BUCKET || '';
  if (bucket) {
    try {
      const deletedSubmit = await purgeS3Prefix(bucket, 'submit/');
      console.log(`S3 purge by prefix 'submit/': deleted=${deletedSubmit}`);
    } catch (e: any) {
      console.warn('S3 purge by prefix failed:', e?.message || e);
    }
  } else {
    console.warn('S3_BUCKET not set; skipping prefix-based purges');
  }

  // 3) Reset all relevant tables
  console.log('Truncating tables (with CASCADE)…');
  await resetTables();

  // 4) Verify
  console.log('Verifying row counts…');
  await verifyCounts();
  console.log('--- Reset complete ---');
  process.exit(0);
}

main().catch(err => { console.error('Reset failed:', err); process.exit(1); });
