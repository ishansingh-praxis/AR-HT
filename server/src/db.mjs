import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { migrate } from './migrations.mjs';

/**
 * The database is one local SQLite file (Node's built-in driver): no database server to install or run.
 * The schema is versioned in migrations.mjs. Use ':memory:' in tests.
 */
export function openDb(file = ':memory:') {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

/** Consistent online backup of the database to `dest` (safe while the server is running). */
export function backupDb(db, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) fs.rmSync(dest);
  db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
}

/** Run `fn` in a transaction (rolls back on throw). */
export function tx(db, fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

/** Monotonic catalogue version: bumped on every product change so apps can ask for "what changed since". */
export function currentVersion(db) {
  return Number(db.prepare("SELECT value FROM meta WHERE key='catalogue_version'").get()?.value ?? 0);
}
export function bumpVersion(db) {
  const v = currentVersion(db) + 1;
  db.prepare("INSERT INTO meta(key,value) VALUES('catalogue_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(v);
  return v;
}

export function upsertProduct(db, product) {
  const version = bumpVersion(db);
  db.prepare(`INSERT INTO products(id,category,data,role,version) VALUES(?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET category=excluded.category, data=excluded.data, role=excluded.role, version=excluded.version`)
    .run(product.id, product.category, JSON.stringify(product), product.role ?? null, version);
  db.prepare('DELETE FROM product_tombstones WHERE id=?').run(product.id);
  return version;
}

export function deleteProduct(db, id) {
  const r = db.prepare('DELETE FROM products WHERE id=?').run(id);
  if (!r.changes) return null;
  const version = bumpVersion(db);
  db.prepare('INSERT OR REPLACE INTO product_tombstones(id,version) VALUES(?,?)').run(id, version);
  return version;
}

/** First run: load the bundled catalogue. Existing databases are left alone, except products without a version are stamped once. */
export function seedProducts(db, products) {
  const n = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (n === 0) tx(db, () => { for (const p of products) upsertProduct(db, p); });
  else {
    const stale = db.prepare('SELECT id,data FROM products WHERE version=0').all();
    if (stale.length) tx(db, () => { for (const r of stale) upsertProduct(db, JSON.parse(r.data)); });
  }
}

export function seedRooms(db, rooms) {
  const n = db.prepare('SELECT COUNT(*) AS n FROM sample_rooms').get().n;
  if (n > 0) return;
  const ins = db.prepare('INSERT INTO sample_rooms(id,sort,data) VALUES(?,?,?)');
  tx(db, () => rooms.forEach((r, i) => ins.run(r.id, i, JSON.stringify(r))));
}

/** One-off: products stored with a full model URL get a host-independent key (models/<file>) so PUBLIC_URL can change. */
export function migrateModelKeys(db) {
  const rows = db.prepare("SELECT id,data FROM products WHERE data LIKE '%/files/models/%'").all();
  const upd = db.prepare('UPDATE products SET data=? WHERE id=?');
  for (const r of rows) {
    const p = JSON.parse(r.data);
    const m = p.model3D?.url?.match(/\/files\/(models\/[^/?#]+)$/);
    if (!m || p.model3D.key) continue;
    const { url: _url, ...rest } = p.model3D;
    upd.run(JSON.stringify({ ...p, model3D: { ...rest, key: m[1] } }), r.id);
  }
}
