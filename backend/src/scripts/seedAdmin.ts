import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';

async function main() {
  try {
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'ChangeMeNow!123';

    const complexity = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;
    if (!complexity.test(password)) {
      console.error('Provided ADMIN_PASSWORD does not meet complexity requirements.');
      process.exit(2);
    }

    const existing = await query("SELECT id, username, email FROM api_hboxuser WHERE type='BA' AND (LOWER(email)=LOWER($1) OR LOWER(username)=LOWER($2))", [email, username]);
    if (existing.rowCount && existing.rowCount > 0) {
      console.log('Admin user already present:', existing.rows[0]);
      return;
    }

    const adminCountRes = await query("SELECT COUNT(*) FROM api_hboxuser WHERE type='BA'");
    const count = parseInt(adminCountRes.rows[0].count, 10);
    if (count > 0) {
      console.log('Another admin exists (count>0). Skipping creation.');
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const now = new Date();
    const insert = await query(
      `INSERT INTO api_hboxuser (username, email, password, type, is_superuser, is_staff, is_active, first_name, last_name, date_joined, phone_number, created, updated)
       VALUES ($1,$2,$3,'BA',true,true,true,$4,$5,$6,$7,$8,$9) RETURNING id, username, email, type`,
      [username, email, hash, '', '', now, '', now, now]
    );
    console.log('Seeded admin user:', insert.rows[0]);
    console.log('IMPORTANT: Change this initial password immediately in production.');
  } catch (e:any) {
    console.error('Failed to seed admin user:', e?.message||e);
    process.exit(1);
  }
}

main();
