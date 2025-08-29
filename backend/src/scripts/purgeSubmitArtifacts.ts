import pool from '../config/db.js';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand, _Object, ListObjectsV2Output } from '@aws-sdk/client-s3';

async function purgeS3Prefix(bucket: string, prefix: string): Promise<{ deleted: number }> {
  if (!bucket) throw new Error('S3_BUCKET is not set');
  const region = process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1';
  const s3 = new S3Client({ region });
  let deleted = 0;
  let ContinuationToken: string | undefined = undefined;
  for (;;) {
  const list: ListObjectsV2Output = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken }));
    const contents = (list.Contents || []) as _Object[];
    if (!contents.length) {
      if (!list.IsTruncated) break;
    } else {
      const toDelete = contents.map(o => ({ Key: o.Key! }));
      await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: toDelete, Quiet: true } }));
      deleted += toDelete.length;
    }
    if (!list.IsTruncated) break;
    ContinuationToken = list.NextContinuationToken;
  }
  return { deleted };
}

async function main() {
  console.log('--- Purging submit artifacts (DB + S3) ---');
  const bucket = process.env.S3_BUCKET || '';
  const prefix = 'submit/';

  // Counts before
  const beforeSubmit = await pool.query(`SELECT COUNT(*)::int AS n FROM api_bil_claim_submit`);
  const beforeUploads = await pool.query(`SELECT COUNT(*)::int AS n FROM rcm_file_uploads WHERE file_kind='SUBMIT_EXCEL'`);
  console.log(`Rows before: api_bil_claim_submit=${beforeSubmit.rows[0]?.n ?? 0}, rcm_file_uploads(SUBMIT_EXCEL)=${beforeUploads.rows[0]?.n ?? 0}`);

  // Truncate tables
  await pool.query('BEGIN');
  try {
    await pool.query('TRUNCATE TABLE api_bil_claim_submit RESTART IDENTITY CASCADE');
    await pool.query("DELETE FROM rcm_file_uploads WHERE file_kind='SUBMIT_EXCEL'");
    await pool.query('COMMIT');
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }

  // Purge S3 objects under prefix
  let s3Deleted = 0;
  try {
    const { deleted } = await purgeS3Prefix(bucket, prefix);
    s3Deleted = deleted;
  } catch (e: any) {
    console.warn('S3 purge warning:', e?.message || e);
  }

  const afterSubmit = await pool.query(`SELECT COUNT(*)::int AS n FROM api_bil_claim_submit`);
  const afterUploads = await pool.query(`SELECT COUNT(*)::int AS n FROM rcm_file_uploads WHERE file_kind='SUBMIT_EXCEL'`);
  console.log(`Rows after: api_bil_claim_submit=${afterSubmit.rows[0]?.n ?? 0}, rcm_file_uploads(SUBMIT_EXCEL)=${afterUploads.rows[0]?.n ?? 0}`);
  console.log(`S3 objects deleted under prefix '${prefix}': ${s3Deleted}`);
  console.log('--- Done ---');
}

main().catch(e => { console.error(e); process.exit(1); });
