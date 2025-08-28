import { query } from '../config/db.js';

async function runMigration() {
  console.log('Running upload ID migration...');
  
  try {
    // Execute the migration steps one by one
    await query('BEGIN');
    
    // Add new columns
    await query('ALTER TABLE rcm_uploads ADD COLUMN IF NOT EXISTS new_id VARCHAR(50)');
    await query('ALTER TABLE rcm_upload_claim_links ADD COLUMN IF NOT EXISTS new_upload_id VARCHAR(50)');
    
    // Update existing records with readable IDs
    await query(`
      UPDATE rcm_uploads 
      SET new_id = 
        TO_CHAR(uploaded_at, 'YYYYMMDD-HH24MI') || '-' || 
        UPPER(SUBSTRING(MD5(id::text), 1, 6)) || '-' || 
        UPPER(REGEXP_REPLACE(SUBSTRING(SPLIT_PART(filename, '.', 1), 1, 10), '[^A-Za-z0-9]', '', 'g'))
      WHERE new_id IS NULL
    `);
    
    // Update the links table
    await query(`
      UPDATE rcm_upload_claim_links 
      SET new_upload_id = (
        SELECT new_id FROM rcm_uploads WHERE rcm_uploads.id = rcm_upload_claim_links.upload_id
      )
    `);
    
    // Drop constraints
    await query('ALTER TABLE rcm_upload_claim_links DROP CONSTRAINT IF EXISTS rcm_upload_claim_links_pkey');
    await query('ALTER TABLE rcm_uploads DROP CONSTRAINT IF EXISTS rcm_uploads_pkey');
    
    // Drop old columns and rename new ones
    await query('ALTER TABLE rcm_uploads DROP COLUMN id');
    await query('ALTER TABLE rcm_uploads RENAME COLUMN new_id TO id');
    await query('ALTER TABLE rcm_uploads ADD PRIMARY KEY (id)');
    
    await query('ALTER TABLE rcm_upload_claim_links DROP COLUMN upload_id');
    await query('ALTER TABLE rcm_upload_claim_links RENAME COLUMN new_upload_id TO upload_id');
    await query('ALTER TABLE rcm_upload_claim_links ADD PRIMARY KEY (upload_id, submit_id)');
    
    await query('COMMIT');
    
    console.log('Migration completed successfully!');
    
    // Test the results
    const result = await query('SELECT id, filename FROM rcm_uploads LIMIT 5');
    console.log('Sample updated records:');
    console.log(result.rows);
    
  } catch (error) {
    await query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  }
}

runMigration()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
