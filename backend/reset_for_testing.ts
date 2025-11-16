/**
 * Reset all tables and S3 bucket for fresh testing
 * WARNING: This will delete ALL data from:
 * - api_bil_claim_submit
 * - api_bil_claim_reimburse
 * - upl_change_logs
 * - rcm_file_uploads
 * - S3 bucket objects
 */

import pool from './src/config/db.js';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'hbox-rcm-bucket';

async function resetDatabase() {
  console.log('\n=== RESETTING DATABASE TABLES ===\n');
  
  try {
    // Delete in order to respect foreign key constraints
    
    console.log('1. Deleting audit logs (upl_change_logs)...');
    const logs = await pool.query('DELETE FROM upl_change_logs');
    console.log(`   ✓ Deleted ${logs.rowCount} audit log entries`);
    
    console.log('\n2. Deleting reimburse claims (api_bil_claim_reimburse)...');
    const reimburse = await pool.query('DELETE FROM api_bil_claim_reimburse');
    console.log(`   ✓ Deleted ${reimburse.rowCount} reimburse claims`);
    
    console.log('\n3. Deleting submit claims (api_bil_claim_submit)...');
    const submit = await pool.query('DELETE FROM api_bil_claim_submit');
    console.log(`   ✓ Deleted ${submit.rowCount} submit claims`);
    
    console.log('\n4. Deleting file upload records (rcm_file_uploads)...');
    const uploads = await pool.query('DELETE FROM rcm_file_uploads');
    console.log(`   ✓ Deleted ${uploads.rowCount} upload records`);
    
    // Reset sequences to start from 1
    console.log('\n5. Resetting sequences...');
    await pool.query('ALTER SEQUENCE api_bil_claim_submit_bil_claim_submit_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE api_bil_claim_reimburse_bil_claim_reimburse_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE upl_change_logs_id_seq RESTART WITH 1');
    console.log('   ✓ Sequences reset to 1');
    
    console.log('\n✅ Database tables reset successfully!');
    
  } catch (error: any) {
    console.error('❌ Database reset error:', error.message);
    throw error;
  }
}

async function resetS3Bucket() {
  console.log('\n=== RESETTING S3 BUCKET ===\n');
  
  try {
    // List all objects in bucket
    console.log(`Listing objects in bucket: ${BUCKET_NAME}...`);
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
    });
    
    const listResponse = await s3Client.send(listCommand);
    
    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      console.log('   ✓ Bucket is already empty');
      return;
    }
    
    console.log(`   Found ${listResponse.Contents.length} objects`);
    
    // Delete all objects
    const objectsToDelete = listResponse.Contents.map(obj => ({ Key: obj.Key! }));
    
    console.log(`Deleting ${objectsToDelete.length} objects...`);
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: BUCKET_NAME,
      Delete: {
        Objects: objectsToDelete,
      },
    });
    
    const deleteResponse = await s3Client.send(deleteCommand);
    console.log(`   ✓ Deleted ${deleteResponse.Deleted?.length || 0} objects`);
    
    if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
      console.log(`   ⚠️  ${deleteResponse.Errors.length} errors during deletion:`);
      deleteResponse.Errors.forEach(err => {
        console.log(`      - ${err.Key}: ${err.Message}`);
      });
    }
    
    console.log('\n✅ S3 bucket reset successfully!');
    
  } catch (error: any) {
    console.error('❌ S3 reset error:', error.message);
    throw error;
  }
}

async function verifyReset() {
  console.log('\n=== VERIFICATION ===\n');
  
  try {
    const counts = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM api_bil_claim_submit'),
      pool.query('SELECT COUNT(*) as count FROM api_bil_claim_reimburse'),
      pool.query('SELECT COUNT(*) as count FROM upl_change_logs'),
      pool.query('SELECT COUNT(*) as count FROM rcm_file_uploads'),
    ]);
    
    console.log('Table counts:');
    console.log(`  api_bil_claim_submit: ${counts[0].rows[0].count}`);
    console.log(`  api_bil_claim_reimburse: ${counts[1].rows[0].count}`);
    console.log(`  upl_change_logs: ${counts[2].rows[0].count}`);
    console.log(`  rcm_file_uploads: ${counts[3].rows[0].count}`);
    
    const allZero = counts.every(c => parseInt(c.rows[0].count) === 0);
    
    if (allZero) {
      console.log('\n✅ All tables are empty - Ready for testing!');
    } else {
      console.log('\n⚠️  Some tables still have data');
    }
    
  } catch (error: any) {
    console.error('❌ Verification error:', error.message);
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  WARNING: This will DELETE ALL DATA!                  ║');
  console.log('║  - All submit claims                                  ║');
  console.log('║  - All reimburse claims                               ║');
  console.log('║  - All audit logs                                     ║');
  console.log('║  - All upload records                                 ║');
  console.log('║  - All S3 files                                       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  // Auto-proceed (remove this if you want manual confirmation)
  console.log('Proceeding with reset in 2 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    await resetDatabase();
    await resetS3Bucket();
    await verifyReset();
    
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  ✅ RESET COMPLETE - System ready for testing!        ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    console.log('Next steps:');
    console.log('1. Upload an Excel file via the UI');
    console.log('2. Check the submit claims table');
    console.log('3. Verify reimburse rows were created');
    console.log('4. Check audit log entries');
    console.log('5. View history page\n');
    
  } catch (error) {
    console.error('\n❌ Reset failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
