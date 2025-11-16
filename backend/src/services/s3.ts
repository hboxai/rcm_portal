import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const REGION = process.env.S3_REGION || process.env.AWS_REGION || '';
const s3 = new S3Client({
  region: REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

export async function uploadToS3(params: {
  bucket: string;
  key: string;
  body: Buffer;
  contentType?: string;
}): Promise<{ s3Url: string }>{
  const { bucket, key, body, contentType } = params;
  
  // Case 15: Retry logic with exponential backoff (max 3 attempts)
  const maxRetries = 3;
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType });
      await s3.send(cmd);
      return { s3Url: `s3://${bucket}/${key}` };
    } catch (error: any) {
      lastError = error;
      console.error(`[S3] Upload attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        console.log(`[S3] Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  // All retries failed
  console.error(`[S3] All ${maxRetries} upload attempts failed:`, lastError);
  throw new Error(`S3 upload failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err: any) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export async function downloadFromS3(params: { bucket: string; key: string }): Promise<Buffer> {
  const { bucket, key } = params;
  const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = (out as any).Body;
  return streamToBuffer(body);
}

export async function getPresignedGetUrl(params: { bucket: string; key: string; expiresInSeconds?: number }): Promise<string> {
  const { bucket, key, expiresInSeconds = 900 } = params; // default 15 minutes
  const mod: any = await import('@aws-sdk/s3-request-presigner');
  const command: any = new GetObjectCommand({ Bucket: bucket, Key: key });
  const url = await mod.getSignedUrl(s3 as any, command, { expiresIn: expiresInSeconds });
  return url as string;
}

export async function headObject(params: { bucket: string; key: string }): Promise<{ exists: true } | { exists: false; reason?: string }>{
  const { bucket, key } = params;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { exists: true };
  } catch (e: any) {
    const code = (e?.$metadata?.httpStatusCode as number) || 0;
    if (code === 404) return { exists: false, reason: 'NotFound' };
    // Some S3 impls throw codes via name/code
    const name = String(e?.name || e?.Code || '').toLowerCase();
    if (name.includes('notfound') || name.includes('nosuchkey')) return { exists: false, reason: 'NotFound' };
    return { exists: false, reason: e?.message || 'Unknown' };
  }
}

export async function deleteFromS3(params: { bucket?: string | null; key?: string | null }): Promise<boolean> {
  const bucket = params.bucket || '';
  const key = params.key || '';
  if (!bucket || !key) return false;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (e) {
    // swallow; container cleanliness is best-effort
    return false;
  }
}
