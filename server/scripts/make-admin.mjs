// Usage: node scripts/make-admin.mjs <email> [admin|editor|user]   (DB_FILE env var overrides the default database path)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../src/db.mjs';

const email = process.argv[2]?.toLowerCase();
const role = process.argv[3] ?? 'admin';
if (!email || !['admin', 'editor', 'user'].includes(role)) { console.error('Usage: node scripts/make-admin.mjs <email> [admin|editor|user]'); process.exit(1); }
const here = path.dirname(fileURLToPath(import.meta.url));
const db = openDb(process.env.DB_FILE ?? path.join(here, '../data/furni.db'));
const r = db.prepare('UPDATE users SET role=? WHERE email=?').run(role, email);
if (!r.changes) { console.error(`No user with email ${email}. Register in the app first.`); process.exit(1); }
db.prepare('INSERT INTO audit_log(actor_id,action,target,at,data) VALUES(NULL,?,?,?,?)').run('user.role.cli', email, Date.now(), JSON.stringify({ role }));
console.log(`${email} is now ${role}.`);
