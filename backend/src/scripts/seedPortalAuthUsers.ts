import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

interface SeedUser { email: string; username: string; password: string; role: 'Admin'|'User'; }

// NOTE: Do NOT hardcode real passwords here. Provide via environment variables.
// For local/dev seeding you can set PORTAL_SEED_USERS as a JSON string, e.g.
// PORTAL_SEED_USERS='[{"email":"admin@example.com","username":"portal_admin","password":"DevOnly!ChangeMe1","role":"Admin"}]'
// Each user object requires: email, username, password, role ('Admin'|'User')
// In production environments, skip this script or supply secure random passwords which are rotated immediately.
const rawSeedUsers = process.env.PORTAL_SEED_USERS;
let users: SeedUser[] = [];
if (rawSeedUsers) {
  try {
    const parsed = JSON.parse(rawSeedUsers);
    if (Array.isArray(parsed)) {
      users = parsed.filter(u => u && u.email && u.username && u.password && (u.role === 'Admin' || u.role === 'User'));
    }
  } catch (e) {
    console.error('Failed to parse PORTAL_SEED_USERS JSON:', (e as any)?.message || e);
  }
}
if (!users.length) {
  console.log('No users supplied via PORTAL_SEED_USERS. Nothing to seed.');
  process.exit(0);
}

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
