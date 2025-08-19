import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

interface SeedUser { email: string; username: string; password: string; role: 'Admin'|'User'; }

const users: SeedUser[] = [
  { email: 'HBilling_RCM@hbox.ai', username: 'hbilling_rcm', password: 'Admin@2025', role: 'Admin' },
  { email: 'Syed.a@hbox.ai', username: 'syed.a', password: 'User@2025', role: 'User' }
];

async function upsertUser(u: SeedUser) {
  const normEmail = u.email.trim().toLowerCase();
  const existing = await pool.query('SELECT id FROM rcm_portal_auth_users WHERE LOWER(email)=$1', [normEmail]);
  const hash = await bcrypt.hash(u.password, 10);
  if (existing.rowCount) {
    await pool.query(
      `UPDATE rcm_portal_auth_users
         SET username=$1, password_hash=$2, role=$3, status='active', updated_at=NOW()
       WHERE id=$4`,
      [u.username, hash, u.role, existing.rows[0].id]
    );
    console.log(`Updated ${u.role} ${u.email}`);
    return existing.rows[0].id;
  } else {
    const ins = await pool.query(
      `INSERT INTO rcm_portal_auth_users (email, username, password_hash, role, status)
       VALUES ($1,$2,$3,$4,'active') RETURNING id`,
      [u.email, u.username, hash, u.role]
    );
    console.log(`Inserted ${u.role} ${u.email} (id=${ins.rows[0].id})`);
    return ins.rows[0].id;
  }
}

async function main() {
  for (const u of users) {
    await upsertUser(u);
  }
  console.log('Seeding complete.');
  process.exit(0);
}

main().catch(e=>{console.error('Seed error', e); process.exit(1);});
