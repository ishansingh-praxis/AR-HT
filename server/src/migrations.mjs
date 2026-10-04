/**
 * Versioned schema migrations. SQLite stores how many have run in `PRAGMA user_version`; PostgreSQL in a `schema_version`
 * table. Each runs exactly once, in order, inside a transaction. Never edit an old migration: add a new one at the end.
 * Older SQLite files (created before migrations existed) have user_version 0 and are brought up to date safely,
 * because migration 1 only creates what is missing.
 * The DDL is written once with three type names that differ between engines: ${PK}, ${INT} and ${REAL}.
 */

const TYPES = {
  sqlite: { PK: 'INTEGER PRIMARY KEY', INT: 'INTEGER', REAL: 'REAL' },
  pg: { PK: 'BIGSERIAL PRIMARY KEY', INT: 'BIGINT', REAL: 'DOUBLE PRECISION' },
};
/** Fills in the engine's type names: "INTEGER PRIMARY KEY" -> BIGSERIAL, INTEGER -> BIGINT, REAL -> DOUBLE PRECISION on PostgreSQL. */
const ddl = (db, sql) => {
  const t = TYPES[db.dialect];
  return sql.replace(/\bINTEGER PRIMARY KEY\b/g, t.PK).replace(/\bINTEGER\b/g, t.INT).replace(/\bREAL\b/g, t.REAL);
};

/** Adds columns that older database files do not have yet. */
async function ensureColumns(db, table, cols) {
  for (const [name, type] of Object.entries(cols)) {
    if (db.dialect === 'pg') { await db.exec(ddl(db, `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${name} ${type}`)); continue; }
    const have = new Set((await db.all(`PRAGMA table_info(${table})`)).map((c) => c.name));
    if (!have.has(name)) await db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  }
}

export const MIGRATIONS = [
  // 1: base schema (what the server had before migrations)
  async (db) => {
    await db.exec(ddl(db, `
      CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT,
        password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS products(
        id TEXT PRIMARY KEY, category TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS designs(
        id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS wishlist(
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, product_id TEXT NOT NULL, added_at INTEGER NOT NULL,
        PRIMARY KEY(user_id, product_id));
      CREATE TABLE IF NOT EXISTS events(
        id INTEGER PRIMARY KEY, device_id TEXT NOT NULL, name TEXT NOT NULL, ts INTEGER NOT NULL, props TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sample_rooms(id TEXT PRIMARY KEY, sort INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS product_tombstones(id TEXT PRIMARY KEY, version INTEGER NOT NULL);
    `));
    await ensureColumns(db, 'products', { role: 'TEXT', version: 'INTEGER NOT NULL DEFAULT 0' });
    await ensureColumns(db, 'designs', { updated_at: 'INTEGER NOT NULL DEFAULT 0', deleted_at: 'INTEGER', thumbnail_key: 'TEXT' });
    await db.exec(ddl(db, `
      UPDATE designs SET updated_at = created_at WHERE updated_at = 0;
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_products_role ON products(role);
      CREATE INDEX IF NOT EXISTS idx_products_version ON products(version);
      CREATE INDEX IF NOT EXISTS idx_designs_user ON designs(user_id, updated_at);
    `));
  },

  // 2: uploaded 3D models (one row per uploaded version) and an append-only audit log of admin/editor writes
  async (db) => {
    await db.exec(ddl(db, `
      CREATE TABLE models(
        id INTEGER PRIMARY KEY, product_id TEXT NOT NULL, version INTEGER NOT NULL, glb_key TEXT NOT NULL, size_mb REAL NOT NULL,
        w_cm REAL, d_cm REAL, h_cm REAL, status TEXT NOT NULL DEFAULT 'ready', report TEXT, reviewed_by INTEGER, created_at INTEGER NOT NULL,
        UNIQUE(product_id, version));
      CREATE TABLE audit_log(
        id INTEGER PRIMARY KEY, actor_id INTEGER, action TEXT NOT NULL, target TEXT, at INTEGER NOT NULL, data TEXT);
      CREATE INDEX idx_audit_at ON audit_log(at);
      CREATE INDEX idx_events_name_ts ON events(name, ts);
    `));
  },

  // 3: production auth: refresh-token families, social identities, one-time email codes, lockout, disabled accounts
  async (db) => {
    await ensureColumns(db, 'users', { email_verified_at: 'INTEGER', failed_logins: 'INTEGER NOT NULL DEFAULT 0', locked_until: 'INTEGER', disabled_at: 'INTEGER' });
    await db.exec(ddl(db, `
      CREATE TABLE refresh_tokens(
        id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, family TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, revoked_at INTEGER, user_agent TEXT, created_at INTEGER NOT NULL);
      CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);
      CREATE INDEX idx_refresh_family ON refresh_tokens(family);
      CREATE TABLE auth_identities(
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider TEXT NOT NULL, subject TEXT NOT NULL,
        PRIMARY KEY(provider, subject));
      CREATE TABLE email_codes(
        id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose TEXT NOT NULL,
        code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, used_at INTEGER);
      CREATE INDEX idx_codes_user ON email_codes(user_id, purpose);
    `));
  },

  // 4: share links for designs
  async (db) => {
    await ensureColumns(db, 'designs', { share_slug: 'TEXT' });
    await db.exec('CREATE UNIQUE INDEX idx_designs_share ON designs(share_slug) WHERE share_slug IS NOT NULL');
  },

  // 5: client-generated design ids, so a design created offline and retried never appears twice
  async (db) => {
    await ensureColumns(db, 'designs', { client_id: 'TEXT' });
    await db.exec('CREATE UNIQUE INDEX idx_designs_client ON designs(user_id, client_id) WHERE client_id IS NOT NULL');
  },
];

/** Runs every migration that has not run yet. Returns the schema version. */
export async function migrate(db, migrations = MIGRATIONS) {
  const pg = db.dialect === 'pg';
  if (pg) await db.exec('CREATE TABLE IF NOT EXISTS schema_version(id INTEGER PRIMARY KEY, version INTEGER NOT NULL)');
  const read = async () => pg ? Number((await db.get('SELECT version FROM schema_version WHERE id=1'))?.version ?? 0) : Number((await db.get('PRAGMA user_version')).user_version);
  const current = await read();
  for (let i = current; i < migrations.length; i++) {
    try {
      await db.tx(async (t) => {
        if (pg) await t.get('SELECT pg_advisory_xact_lock(7001)'); // two servers starting together: one migrates, the other waits
        if (pg && (await t.get('SELECT version FROM schema_version WHERE id=1'))?.version >= i + 1) return; // the other one already did it
        await migrations[i](t);
        if (pg) await t.run('INSERT INTO schema_version(id,version) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version', i + 1);
        else await t.exec(`PRAGMA user_version = ${i + 1}`);
      });
    } catch (e) {
      throw new Error(`Migration ${i + 1} failed: ${e.message}`);
    }
  }
  return migrations.length;
}
