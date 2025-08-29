import pool from '../config/db.js';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';

type ObjRef = { bucket: string; key: string };

async function fetchAllObjects(): Promise<ObjRef[]> {
  const res = await pool.query(
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
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    } : undefined,
  });

  let deleted = 0;
  let errors = 0;
  // Group by bucket
  const byBucket = objs.reduce((m, o) => {
    (m[o.bucket] ||= []).push(o.key);
    return m;
  }, {} as Record<string, string[]>);

  for (const [bucket, keys] of Object.entries(byBucket)) {
    // chunk in 1000
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000);
      try {
        const out = await s3.send(new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: chunk.map(Key => ({ Key })) },
        }));
        deleted += out.Deleted?.length || 0;
        errors += out.Errors?.length || 0;
        if ((out.Errors?.length || 0) > 0) {
          console.warn(`S3 delete partial errors for bucket ${bucket}:`, out.Errors?.slice(0, 3));
        }
      } catch (e: any) {
        errors += chunk.length;
        console.error(`S3 delete failed for bucket ${bucket} keys[${i}-${i+chunk.length-1}]:`, e?.message || e);
      }
    }
  }
  return { deleted, errors };
}

async function resetTables() {
  // Order: clear dependent tables first; use CASCADE to satisfy FKs
  await pool.query('BEGIN');
  try {
    await pool.query('TRUNCATE TABLE api_bil_claim_reimburse CASCADE');
    await pool.query('TRUNCATE TABLE api_bil_claim_submit CASCADE');
    await pool.query('TRUNCATE TABLE rcm_file_uploads RESTART IDENTITY CASCADE');
    await pool.query('COMMIT');
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }
}

async function main() {
  console.log('Fetching S3 object references from rcm_file_uploads…');
  const objs = await fetchAllObjects();
  console.log(`Found ${objs.length} objects to delete`);
  const { deleted, errors } = await deleteByBucket(objs);
  console.log(`S3 delete summary: deleted=${deleted}, errors=${errors}`);

  console.log('Resetting tables api_bil_claim_submit and rcm_file_uploads…');
  await resetTables();
  console.log('Reset complete. Verifying counts…');
  const a = await pool.query('SELECT COUNT(*)::int AS n FROM api_bil_claim_submit');
  const b = await pool.query('SELECT COUNT(*)::int AS n FROM rcm_file_uploads');
  const r = await pool.query('SELECT COUNT(*)::int AS n FROM api_bil_claim_reimburse');
  console.log(`api_bil_claim_submit rows: ${a.rows[0].n}`);
  console.log(`api_bil_claim_reimburse rows: ${r.rows[0].n}`);
  console.log(`rcm_file_uploads rows: ${b.rows[0].n}`);
  process.exit(0);
}

main().catch(err => { console.error('Purge/reset failed:', err); process.exit(1); });
