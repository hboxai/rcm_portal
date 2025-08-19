import pool from './src/config/db.js';

async function checkUsers() {
  try {
    console.log('Checking user accounts...');
    const result = await pool.query(`
      SELECT id, username, email, type, 
             CASE WHEN password IS NULL THEN 'NO PASSWORD' 
                  ELSE 'HAS PASSWORD (' || LENGTH(password) || ' chars)' 
             END as password_status
      FROM api_hboxuser 
      WHERE email IN ($1, $2, $3)
      ORDER BY email
    `, ['HBilling_RCM@hbox.ai', 'test@hbox.ai', 'syed.a@hbox.ai']);
    
    if (result.rows.length === 0) {
      console.log('No users found!');
    } else {
      result.rows.forEach(user => {
        console.log(`${user.email} (${user.type}): ${user.password_status}`);
      });
    }
    
    await pool.end();
  } catch (error) {
    console.error('Database error:', error.message);
  }
}

checkUsers();
