import bcrypt from 'bcryptjs';
import pool from '../config/db.js'; // Adjust path if your db config is elsewhere

const saltRounds = 10; // Standard for bcrypt

async function seedUsers() {
  console.log('Starting user seeding...');

  // Users are supplied via SEED_USERS JSON array env var to avoid hardcoding.
  // Example (dev only):
  // SEED_USERS='[{"username":"dev_admin","email":"dev_admin@example.com","password":"DevOnly!Change1","type":"BA","firstName":"Dev","lastName":"Admin","phoneNumber":"0000000000"}]'
  const raw = process.env.SEED_USERS;
  if (!raw) {
    console.log('SEED_USERS env var not set. Nothing to seed.');
    return;
  }
  let usersToSeed: any[] = [];
  try { usersToSeed = JSON.parse(raw); } catch (e) { console.error('Invalid SEED_USERS JSON:', (e as any)?.message||e); return; }
  if (!Array.isArray(usersToSeed) || !usersToSeed.length) { console.log('SEED_USERS contains no user objects.'); return; }

  for (const userData of usersToSeed) {
    try {
      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM api_hboxuser WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2)',
        [userData.email, userData.username]
      );

      if (existingUser.rows.length > 0) {
        console.log(`User with email ${userData.email} or username ${userData.username} already exists. Skipping.`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
      console.log(`Hashed password for ${userData.username}: ${hashedPassword}`);

      const currentDate = new Date();

      const insertQuery = `
        INSERT INTO api_hboxuser (username, email, password, type, is_superuser, is_staff, is_active, first_name, last_name, date_joined, phone_number, created, updated)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id;
      `;

      const result = await pool.query(insertQuery, [
        userData.username,
        userData.email,
        hashedPassword,
        userData.type,
        false, // is_superuser
        false, // is_staff
        true,  // is_active
        userData.firstName,
        userData.lastName,
        currentDate, // for date_joined
        userData.phoneNumber,
        currentDate, // for created
        currentDate, // for updated
      ]);

      console.log(`Successfully inserted user: ${userData.username} with ID: ${result.rows[0].id}`);
    } catch (error) {
      console.error(`Error seeding user ${userData.username}:`, error);
    }
  }

  console.log('User seeding finished.');
  // Only end the pool if this script is meant to be a one-off execution
  // If your app is running, it might manage the pool, and ending it here could cause issues.
  // For a standalone script, it's good practice.
  try {
    await pool.end();
    console.log('Database pool closed.');
  } catch (err: any) {
    console.error('Error closing database pool:', err);
  }
}

seedUsers().catch(err => {
  console.error('Critical error during seeding process:', err);
  pool.end().catch((poolErr: any) => console.error('Error closing pool on critical failure:', poolErr)); // Attempt to close pool on error too
  process.exit(1);
});
