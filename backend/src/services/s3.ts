import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
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
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType });
  await s3.send(cmd);
  return { s3Url: `s3://${bucket}/${key}` };
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
