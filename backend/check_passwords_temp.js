import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  host: 'localhost.aptible.in',
  port: 55913,
  database: 'db',
  user: 'aptible',
  password: '',
  ssl: { require: true, rejectUnauthorized: false }
});

async function checkPasswords() {
  try {
    const result = await pool.query('SELECT email, password_hash, user_type FROM users ORDER BY email');
    
    console.log('\nChecking passwords for users:');
    for (const user of result.rows) {
      console.log(`\n--- ${user.email} (${user.user_type}) ---`);
      
      // Test common passwords
      const testPasswords = ['password123', 'admin123', 'hbox123', 'test123'];
      
      for (const testPassword of testPasswords) {
        try {
          const isValid = await bcrypt.compare(testPassword, user.password_hash);
          if (isValid) {
            console.log(`✓ Correct password: ${testPassword}`);
            break;
          }
        } catch (error) {
          console.log(`✗ Error testing ${testPassword}:`, error.message);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkPasswords();
