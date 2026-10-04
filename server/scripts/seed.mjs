// Loads the bundled catalogue and sample rooms into the database (only fills what is empty). Usage: npm run seed
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, seedProducts, seedRooms, dbTarget } from '../src/db.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const db = await openDb(dbTarget(path.join(here, '../data/furni.db')));
const data = path.join(here, '../../src/data');
await seedProducts(db, JSON.parse(fs.readFileSync(path.join(data, 'catalogue.json'), 'utf8')));
await seedRooms(db, JSON.parse(fs.readFileSync(path.join(data, 'rooms.json'), 'utf8')));
console.log('products:', (await db.get('SELECT COUNT(*) AS n FROM products')).n, ' rooms:', (await db.get('SELECT COUNT(*) AS n FROM sample_rooms')).n);
await db.close();
