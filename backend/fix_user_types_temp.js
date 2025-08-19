import pool from './src/config/db.js';

async function fixUserTypes() {
  try {
    console.log('Updating user types to correct values...');
    
    // Update test@hbox.ai to BU (User)
    await pool.query(`UPDATE api_hboxuser SET type = 'BU' WHERE email = 'test@hbox.ai'`);
    
    // Update syed.a@hbox.ai to BU (User) 
    await pool.query(`UPDATE api_hboxuser SET type = 'BU' WHERE email = 'syed.a@hbox.ai'`);
    
    console.log('User types updated successfully!');
    
    // Verify the changes
    const result = await pool.query(`
      SELECT email, type FROM api_hboxuser 
      WHERE email IN ('HBilling_RCM@hbox.ai', 'test@hbox.ai', 'syed.a@hbox.ai')
      ORDER BY email
    `);
    
    console.log('Updated user types:');
    result.rows.forEach(user => {
      console.log(`${user.email}: ${user.type}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error updating user types:', error.message);
  }
}

fixUserTypes();
