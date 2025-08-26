import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

async function seedAuthAdmin() {
  const email = 'admin@hbox.ai';
  const username = 'admin';
  const password = 'admin123';  // Change this in production
  const role = 'Admin';

  try {
    // Check if admin already exists
    const existing = await pool.query(
      'SELECT id FROM rcm_portal_auth_users WHERE LOWER(email)=$1', 
      [email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      console.log(`Admin user already exists with email: ${email}`);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert admin user
    const result = await pool.query(`
      INSERT INTO rcm_portal_auth_users (email, username, password_hash, role, status) 
      VALUES ($1, $2, $3, $4, 'active') 
      RETURNING id, email, username, role
    `, [email, username, hashedPassword, role]);

    console.log('✅ Admin user created successfully:');
    console.log(`   Email: ${result.rows[0].email}`);
    console.log(`   Username: ${result.rows[0].username}`);
    console.log(`   Role: ${result.rows[0].role}`);
    console.log(`   Password: ${password} (change this!)`);
    
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedAuthAdmin()
    .then(() => {
      console.log('✨ Admin seeding complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Admin seeding failed:', error);
      process.exit(1);
    });
}

export default seedAuthAdmin;
