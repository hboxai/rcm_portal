import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.join(__dirname, '../../../.env');
dotenv.config({ path: rootEnvPath });

const BUCKET = process.env.S3_BUCKET || '';
const REGION = process.env.S3_REGION || process.env.AWS_REGION || '';
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
const ENDPOINT = process.env.S3_ENDPOINT || undefined; // optional for S3-compatible
const FORCE_PATH_STYLE = /^true$/i.test(process.env.S3_FORCE_PATH_STYLE || '');

if (!BUCKET || !REGION || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  console.error('Missing required env vars. Need S3_BUCKET, S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
  process.exit(1);
}

const s3 = new S3Client({
  region: REGION,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
  endpoint: ENDPOINT,
  forcePathStyle: FORCE_PATH_STYLE,
});

async function main() {
  const key = `test-upload-${Date.now()}.txt`;
  const body = Buffer.from('Hello RCM!', 'utf8');

  // Upload
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: 'text/plain' }));
  console.log(`✅ Uploaded test object: ${key}`);

  // List (first 5)
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, MaxKeys: 5 }));
  const contents = listed.Contents || [];
  console.log('📂 Objects in bucket:');
  if (!contents.length) {
    console.log(' - (no objects)');
  } else {
    for (const obj of contents) console.log(` - ${obj.Key}`);
  }

  // Delete the uploaded file
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  console.log(`🗑️ Deleted test object: ${key}`);
}

main().catch(err => {
  console.error('S3 connectivity test failed:', err?.message || err);
  process.exit(1);
});
