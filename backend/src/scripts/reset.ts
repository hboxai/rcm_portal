// Quick reset script for RCM tables and S3
import { Pool } from 'pg';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

const s3 = new S3Client({
  region: process.env.S3_REGION || process.env.AWS_REGION || '',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function reset() {
  // Reset DB
  console.log('Truncating RCM tables...');
  await pool.query('TRUNCATE api_bil_claim_submit, api_bil_claim_reimburse, rcm_file_uploads, rcm_submit_line_audit RESTART IDENTITY CASCADE');
  console.log('Tables reset');
  
  // Clear S3
  const bucket = process.env.S3_BUCKET || '';
  console.log(`Clearing S3 bucket: ${bucket}`);
  let total = 0;
  let continuationToken: string | undefined;
  do {
    const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }));
    if (list.Contents && list.Contents.length > 0) {
      await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: list.Contents.map(o => ({ Key: o.Key })) } }));
      total += list.Contents.length;
    }
    continuationToken = list.NextContinuationToken;
  } while (continuationToken);
  console.log(`S3 cleared: ${total} objects deleted`);
  
  pool.end();
}

reset().catch(e => { console.error(e); pool.end(); process.exit(1); });
