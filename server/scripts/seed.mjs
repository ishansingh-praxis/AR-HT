// Loads the bundled catalogue and sample rooms into the database (only fills what is empty). Usage: npm run seed
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, seedProducts, seedRooms } from '../src/db.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const db = openDb(process.env.DB_FILE ?? path.join(here, '../data/furni.db'));
const data = path.join(here, '../../src/data');
seedProducts(db, JSON.parse(fs.readFileSync(path.join(data, 'catalogue.json'), 'utf8')));
seedRooms(db, JSON.parse(fs.readFileSync(path.join(data, 'rooms.json'), 'utf8')));
console.log('products:', db.prepare('SELECT COUNT(*) AS n FROM products').get().n, ' rooms:', db.prepare('SELECT COUNT(*) AS n FROM sample_rooms').get().n);
