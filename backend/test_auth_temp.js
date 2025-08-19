import bcrypt from 'bcryptjs';
import pool from './src/config/db.js';

async function testPasswordAuthentication() {
  try {
    // Test the actual authentication logic
    const email = 'test@hbox.ai';
    const password = 'User@2025';
    
    console.log(`Testing authentication for ${email}...`);
    
    // Get user from database
    const userQuery = await pool.query(
      'SELECT id, email, password, username, type FROM api_hboxuser WHERE LOWER(email) = $1',
      [email.toLowerCase()]
    );
    
    if (userQuery.rows.length === 0) {
      console.log('User not found!');
      return;
    }
    
    const user = userQuery.rows[0];
    console.log('User found:', {
      id: user.id,
      email: user.email,
      username: user.username,
      type: user.type,
      hasPassword: !!user.password,
      passwordLength: user.password ? user.password.length : 0
    });
    
    // Test password comparison
    if (!user.password) {
      console.log('No password set for user!');
      return;
    }
    
    const passwordIsValid = await bcrypt.compare(password, user.password);
    console.log('Password comparison result:', passwordIsValid);
    
    if (passwordIsValid) {
      console.log('✅ Authentication would succeed');
      
      // Test role determination
      let role = 'User';
      if (user.type === 'BA') {
        role = 'Admin';
      }
      console.log('Assigned role:', role);
    } else {
      console.log('❌ Authentication would fail - password mismatch');
      
      // Let's also test creating a new hash to compare
      console.log('Testing fresh hash...');
      const freshHash = await bcrypt.hash(password, 10);
      const freshHashTest = await bcrypt.compare(password, freshHash);
      console.log('Fresh hash test result:', freshHashTest);
    }
    
    await pool.end();
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testPasswordAuthentication();
