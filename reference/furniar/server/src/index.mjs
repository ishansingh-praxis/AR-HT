import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, seedProducts } from './db.mjs';
import { createApp } from './app.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 4000;
let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set in production');
  jwtSecret = 'dev-only-secret';
  console.warn('JWT_SECRET not set: using an insecure development secret.');
}
const db = openDb(process.env.DB_FILE ?? path.join(here, '../data/furni.db'));
seedProducts(db, JSON.parse(fs.readFileSync(path.join(here, '../../src/data/catalogue.json'), 'utf8')));

createApp({
  db,
  jwtSecret,
  uploadDir: path.join(here, '../uploads'),
  publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${port}`,
  adminEmails: (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
}).listen(port, () => console.log(`FurniAR API on :${port}`));
