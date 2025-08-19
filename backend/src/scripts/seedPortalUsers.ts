import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

async function ensureUser({username,email,password,role}:{username:string;email:string;password:string;role:'Admin'|'User'}) {
  const lowerEmail = email.toLowerCase();
  const existing = await pool.query('SELECT id,type FROM api_hboxuser WHERE LOWER(email)=$1', [lowerEmail]);
  if (existing.rowCount) {
    console.log(`User ${email} already exists (id=${existing.rows[0].id})`);
    return existing.rows[0].id;
  }
  const hash = await bcrypt.hash(password, 8); // intentionally low rounds for dev simplicity
  const now = new Date();
  const type = role === 'Admin' ? 'BA' : 'BU';
  const ins = await pool.query(`INSERT INTO api_hboxuser (username,email,password,type,is_superuser,is_staff,is_active,first_name,last_name,date_joined,phone_number,created,updated)
    VALUES ($1,$2,$3,$4,true,true,true,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [username,email,hash,type,'',role,now,'',now,now]);
  const id = ins.rows[0].id;
  await pool.query(`INSERT INTO rcm_portal_users (user_id, portal_role) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET portal_role=EXCLUDED.portal_role`,[id,role]);
  console.log(`Created ${role} portal user ${email} (id=${id})`);
  return id;
}

async function main(){
  // Users provided via PORTAL_SEED_USERS JSON (same structure as in seedPortalAuthUsers)
  const raw = process.env.PORTAL_SEED_USERS;
  if (!raw) {
    console.log('PORTAL_SEED_USERS not set. Skipping portal user seeding.');
    process.exit(0);
  }
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch (e) { console.error('Invalid PORTAL_SEED_USERS JSON:', (e as any)?.message||e); process.exit(1); }
  if (!Array.isArray(parsed) || !parsed.length) { console.log('No users in PORTAL_SEED_USERS.'); process.exit(0); }
  for (const u of parsed) {
    if (!u?.username || !u?.email || !u?.password || !['Admin','User'].includes(u.role)) {
      console.warn('Skipping invalid user entry', u);
      continue;
    }
    await ensureUser({username:u.username, email:u.email, password:u.password, role:u.role});
  }
  console.log('Portal user seeding complete. Ensure any dev passwords are rotated in production.');
  process.exit(0);
}

main().catch(e=>{console.error(e);process.exit(1);});
