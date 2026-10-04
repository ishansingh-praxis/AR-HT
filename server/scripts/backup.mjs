// Consistent copy of the database (safe while the server runs). Usage: npm run backup [-- backups/my-copy.db]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, backupDb } from '../src/db.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const db = openDb(process.env.DB_FILE ?? path.join(here, '../data/furni.db'));
const dest = path.resolve(process.argv[2] ?? path.join(here, `../backups/furni-${new Date().toISOString().slice(0, 10)}.db`));
backupDb(db, dest);
console.log('Backup written to', dest);
