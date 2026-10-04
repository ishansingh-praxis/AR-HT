import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { migrate } from './migrations.mjs';

/**
 * One small async database interface over two engines, so the same routes run on both:
 *   - SQLite (a local file, Node's built-in driver): the default, for development and small installs.
 *   - PostgreSQL: for production at scale (DATABASE_URL=postgres://...). Tests also run the whole API on PGlite,
 *     a real PostgreSQL engine in WebAssembly, so the Postgres dialect is checked without a server.
 * Queries are written once with `?` placeholders. `await db.get/all/run(sql, ...params)`; `await db.tx(async (t) => ...)`.
 */

const HAS_ID = /^\s*INSERT\s+INTO\s+(users|designs|events|models|audit_log|refresh_tokens|email_codes)\b/i;
const toPg = (sql) => { let n = 0; return sql.replace(/\?/g, () => `$${++n}`); };

/** SQLite driver. Transactions are serialised: while one is open, other queries wait (one connection, interleaved awaits). */
function sqliteDriver(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  let open = Promise.resolve();
  const exec = (sql, params = []) => {
    const st = raw.prepare(sql);
    if (/^\s*(SELECT|PRAGMA|WITH)/i.test(sql) || /\bRETURNING\b/i.test(sql)) return { rows: st.all(...params), changes: 0 };
    const r = st.run(...params);
    return { rows: [], changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
  };
  const scoped = { dialect: 'sqlite', query: async (sql, params) => exec(sql, params), script: async (sql) => { raw.exec(sql); } };
  return {
    dialect: 'sqlite', raw,
    query: async (sql, params) => { await open; return exec(sql, params); },
    script: async (sql) => { await open; raw.exec(sql); },
    transaction: async (fn) => {
      const prev = open;
      let release;
      open = new Promise((r) => { release = r; });
      await prev;
      raw.exec('BEGIN');
      try { const out = await fn(scoped); raw.exec('COMMIT'); return out; } catch (e) { raw.exec('ROLLBACK'); throw e; } finally { release(); }
    },
    close: async () => { await open; raw.close(); },
  };
}

/** node-postgres driver (production). BIGINT columns come back as numbers (all our values are far below 2^53). */
async function pgDriver(url, { max = 10, ssl } = {}) {
  const { default: pg } = await import('pg');
  pg.types.setTypeParser(20, (v) => Number(v));
  const pool = new pg.Pool({ connectionString: url, max, ssl: ssl ? { rejectUnauthorized: false } : undefined });
  pool.on('error', (e) => console.error('postgres pool error:', e.message)); // an idle connection dropped: the pool replaces it
  const wrap = (c) => ({
    dialect: 'pg',
    query: async (sql, params = []) => { const r = await c.query(toPg(sql), params); return { rows: r.rows, changes: r.rowCount ?? 0 }; },
    script: async (sql) => { await c.query(sql); },
  });
  return {
    ...wrap(pool),
    transaction: async (fn) => {
      const c = await pool.connect();
      try { await c.query('BEGIN'); const out = await fn(wrap(c)); await c.query('COMMIT'); return out; }
      catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
    },
    close: () => pool.end(),
  };
}

/** PGlite driver (tests): the real PostgreSQL engine, in memory. */
async function pgliteDriver() {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite();
  await pg.waitReady;
  const wrap = (c) => ({
    dialect: 'pg',
    query: async (sql, params = []) => { const r = await c.query(toPg(sql), params); return { rows: r.rows, changes: r.affectedRows ?? 0 }; },
    script: async (sql) => { await c.exec(sql); },
  });
  return { ...wrap(pg), transaction: (fn) => pg.transaction((t) => fn(wrap(t))), close: () => pg.close() };
}

/** The async database handle used by every route. */
export class Db {
  constructor(driver) { this.driver = driver; this.dialect = driver.dialect; }
  /** Dialect-specific SQL fragments. */
  get sql() {
    return this.dialect === 'pg'
      ? { order: 'ctid', day: (ms) => `to_char(to_timestamp(${ms}/1000.0) AT TIME ZONE 'UTC', 'YYYY-MM-DD')`, json: (col, key) => `(${col}::json->>'${key}')` }
      : { order: 'rowid', day: (ms) => `strftime('%Y-%m-%d', ${ms}/1000, 'unixepoch')`, json: (col, key) => `json_extract(${col},'$.${key}')` };
  }
  async all(sql, ...p) { return (await this.driver.query(sql, p)).rows; }
  async get(sql, ...p) { return (await this.driver.query(sql, p)).rows[0]; }
  /** Returns { changes, lastInsertRowid } (lastInsertRowid is the new `id` for tables that have one). */
  async run(sql, ...p) {
    if (this.dialect === 'pg' && HAS_ID.test(sql) && !/\bRETURNING\b/i.test(sql)) {
      const r = await this.driver.query(`${sql} RETURNING id`, p);
      return { changes: r.changes, lastInsertRowid: Number(r.rows[0]?.id) };
    }
    const r = await this.driver.query(sql, p);
    return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
  }
  /** Compatibility with `db.prepare(sql).get(...)`. */
  prepare(sql) { return { get: (...p) => this.get(sql, ...p), all: (...p) => this.all(sql, ...p), run: (...p) => this.run(sql, ...p) }; }
  async exec(sql) { await this.driver.script(sql); }
  /** Runs `fn(t)` in a transaction (rolls back on throw); use `t` for every query inside. */
  tx(fn) { return this.driver.transaction((c) => fn(new Db(c))); }
  close() { return this.driver.close?.(); }
}

/**
 * Opens the database and brings the schema up to date.
 * `target`: ':memory:' or a file path (SQLite), a postgres:// URL (PostgreSQL), or 'pglite' (tests: PostgreSQL in memory).
 * With no argument: DATABASE_URL if set, otherwise an in-memory SQLite database.
 */
export async function openDb(target = process.env.TEST_DATABASE_URL || (process.env.TEST_DB === 'pglite' ? 'pglite' : ':memory:'), opts = {}) {
  if (target === undefined || target === null) target = ':memory:';
  let driver;
  if (target === 'pglite') driver = await pgliteDriver();
  else if (/^postgres(ql)?:\/\//.test(target)) driver = await pgDriver(target, opts);
  else driver = sqliteDriver(target);
  const db = new Db(driver);
  // Only the test database named by TEST_DATABASE_URL is ever wiped, and only so every test starts empty.
  if (target === process.env.TEST_DATABASE_URL && target) await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  if (opts.migrate === false) return db;
  await migrate(db);
  await migrateModelKeys(db);
  return db;
}

/** Where the database lives: DATABASE_URL (PostgreSQL) wins, then DB_FILE, then `fallback` (a SQLite file). */
export const dbTarget = (fallback, env = process.env) => env.DATABASE_URL || env.DB_FILE || fallback;

/** Consistent online backup (SQLite only: a PostgreSQL install uses its own backups, e.g. managed snapshots or pg_dump). */
export async function backupDb(db, dest) {
  if (db.dialect !== 'sqlite') throw new Error('Back up PostgreSQL with pg_dump or your provider\'s snapshots');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) fs.rmSync(dest);
  await db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
}

/** Back-compat helper: `tx(db, async (t) => ...)`. */
export const tx = (db, fn) => db.tx(fn);

/** Monotonic catalogue version: bumped on every product change so apps can ask for "what changed since". */
export async function currentVersion(db) {
  return Number((await db.get("SELECT value FROM meta WHERE key='catalogue_version'"))?.value ?? 0);
}
export async function bumpVersion(db) {
  const v = (await currentVersion(db)) + 1;
  await db.run("INSERT INTO meta(key,value) VALUES('catalogue_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", v);
  return v;
}

export async function upsertProduct(db, product) {
  const version = await bumpVersion(db);
  await db.run(`INSERT INTO products(id,category,data,role,version) VALUES(?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET category=excluded.category, data=excluded.data, role=excluded.role, version=excluded.version`,
  product.id, product.category, JSON.stringify(product), product.role ?? null, version);
  await db.run('DELETE FROM product_tombstones WHERE id=?', product.id);
  return version;
}

export async function deleteProduct(db, id) {
  const r = await db.run('DELETE FROM products WHERE id=?', id);
  if (!r.changes) return null;
  const version = await bumpVersion(db);
  await db.run('INSERT INTO product_tombstones(id,version) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version', id, version);
  return version;
}

/** First run: load the bundled catalogue. Existing databases are left alone, except products without a version are stamped once. */
export async function seedProducts(db, products) {
  const n = Number((await db.get('SELECT COUNT(*) AS n FROM products')).n);
  if (n === 0) await db.tx(async (t) => { for (const p of products) await upsertProduct(t, p); });
  else {
    const stale = await db.all('SELECT id,data FROM products WHERE version=0');
    if (stale.length) await db.tx(async (t) => { for (const r of stale) await upsertProduct(t, JSON.parse(r.data)); });
  }
}

export async function seedRooms(db, rooms) {
  const n = Number((await db.get('SELECT COUNT(*) AS n FROM sample_rooms')).n);
  if (n > 0) return;
  await db.tx(async (t) => { let i = 0; for (const r of rooms) await t.run('INSERT INTO sample_rooms(id,sort,data) VALUES(?,?,?)', r.id, i++, JSON.stringify(r)); });
}

/** One-off: products stored with a full model URL get a host-independent key (models/<file>) so PUBLIC_URL can change. */
export async function migrateModelKeys(db) {
  const rows = await db.all("SELECT id,data FROM products WHERE data LIKE '%/files/models/%'");
  for (const r of rows) {
    const p = JSON.parse(r.data);
    const m = p.model3D?.url?.match(/\/files\/(models\/[^/?#]+)$/);
    if (!m || p.model3D.key) continue;
    const { url: _url, ...rest } = p.model3D;
    await db.run('UPDATE products SET data=? WHERE id=?', JSON.stringify({ ...p, model3D: { ...rest, key: m[1] } }), r.id);
  }
}
