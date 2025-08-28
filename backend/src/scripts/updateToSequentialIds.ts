import { query } from '../config/db.js';

async function updateToSequentialIds() {
  console.log('Updating existing upload IDs to sequential format...');
  
  try {
    await query('BEGIN');
    
    // Get all existing uploads ordered by upload time
    const uploads = await query('SELECT id, filename, uploaded_at FROM rcm_uploads ORDER BY uploaded_at');
    
    let counter = 1;
    for (const upload of uploads.rows) {
      const newId = counter.toString();
      
      // Update the upload record
      await query('UPDATE rcm_uploads SET id = $1 WHERE id = $2', [newId, upload.id]);
      
      // Update any related links
      await query('UPDATE rcm_upload_claim_links SET upload_id = $1 WHERE upload_id = $2', [newId, upload.id]);
      
      console.log(`Updated ${upload.filename} from ${upload.id} to ${newId}`);
      counter++;
    }
    
    await query('COMMIT');
    console.log('Successfully updated all IDs to sequential format!');
    
    // Show the results
    const result = await query('SELECT id, filename FROM rcm_uploads ORDER BY CAST(id AS INTEGER)');
    console.log('Updated records:');
    console.log(result.rows);
    
  } catch (error) {
    await query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  }
}

updateToSequentialIds()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
