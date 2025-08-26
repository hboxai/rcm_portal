import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

async function seedTestUser() {
  try {
    console.log('🌱 Seeding test user...');
    
    const email = 'admin@test.com';
    const username = 'admin';
    const password = 'password123';
    const role = 'Admin';
    
    // Check if user already exists
    const existing = await pool.query(
      'SELECT id FROM rcm_portal_auth_users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    
    if (existing.rows.length > 0) {
      console.log('✅ Test user already exists');
      return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert test user
    const result = await pool.query(`
      INSERT INTO rcm_portal_auth_users (username, email, password_hash, role, status)
      VALUES ($1, $2, $3, $4, 'active')
      RETURNING id, username, email, role
    `, [username, email, hashedPassword, role]);
    
    console.log('✅ Test user created:', result.rows[0]);
    console.log('📧 Login credentials:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    
  } catch (error) {
    console.error('❌ Error seeding test user:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTestUser()
    .then(() => {
      console.log('✨ Seeding complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}

export default seedTestUser;
