import bcrypt from 'bcryptjs';
import pool from './src/config/db.js';

async function updateUserPasswords() {
  try {
    const saltRounds = 10;
    
    // Hash the correct passwords
    const userPassword = await bcrypt.hash('User@2025', saltRounds);
    const adminPassword = await bcrypt.hash('Admin@2025', saltRounds);
    
    console.log('Updating user passwords...');
    
    // Update test@hbox.ai
    await pool.query(
      'UPDATE api_hboxuser SET password = $1 WHERE email = $2',
      [userPassword, 'test@hbox.ai']
    );
    
    // Update syed.a@hbox.ai
    await pool.query(
      'UPDATE api_hboxuser SET password = $1 WHERE email = $2',
      [userPassword, 'syed.a@hbox.ai']
    );
    
    // Make sure admin password is correct too
    await pool.query(
      'UPDATE api_hboxuser SET password = $1 WHERE email = $2',
      [adminPassword, 'HBilling_RCM@hbox.ai']
    );
    
    console.log('Passwords updated successfully!');
    
    // Verify by testing authentication
    console.log('Testing authentication for test@hbox.ai...');
    const userQuery = await pool.query(
      'SELECT password FROM api_hboxuser WHERE email = $1',
      ['test@hbox.ai']
    );
    
    if (userQuery.rows.length > 0) {
      const isValid = await bcrypt.compare('User@2025', userQuery.rows[0].password);
      console.log('Password test result:', isValid ? '✅ Valid' : '❌ Invalid');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error updating passwords:', error.message);
  }
}

updateUserPasswords();
