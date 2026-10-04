// Applies any pending schema migrations. Usage: npm run migrate   (the server also does this on start)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, dbTarget } from '../src/db.mjs';
import { MIGRATIONS } from '../src/migrations.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const db = await openDb(dbTarget(path.join(here, '../data/furni.db')));
console.log(`schema is up to date: version ${MIGRATIONS.length} (${db.dialect})`);
await db.close();
