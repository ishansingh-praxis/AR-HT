// Applies any pending schema migrations. Usage: npm run migrate   (the server also does this on start)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../src/db.mjs';
import { MIGRATIONS } from '../src/migrations.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const db = openDb(process.env.DB_FILE ?? path.join(here, '../data/furni.db'));
console.log(`schema version ${db.prepare('PRAGMA user_version').get().user_version} of ${MIGRATIONS.length}`);
