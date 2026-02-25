import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const REGION = process.env.S3_REGION || process.env.AWS_REGION || '';
const BUCKET = process.env.S3_BUCKET || '';

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function clearBucket() {
  console.log(`Clearing bucket: ${BUCKET}`);
  let continuationToken: string | undefined;
  let totalDeleted = 0;

  do {
    const listCmd = new ListObjectsV2Command({
      Bucket: BUCKET,
      ContinuationToken: continuationToken,
    });
    const listResult = await s3.send(listCmd);
    
    if (listResult.Contents && listResult.Contents.length > 0) {
      const deleteCmd = new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: {
          Objects: listResult.Contents.map(obj => ({ Key: obj.Key })),
        },
      });
      await s3.send(deleteCmd);
      totalDeleted += listResult.Contents.length;
      console.log(`Deleted ${listResult.Contents.length} objects`);
    }
    
    continuationToken = listResult.NextContinuationToken;
  } while (continuationToken);

  console.log(`Total deleted: ${totalDeleted}`);
}

clearBucket().catch(console.error);
