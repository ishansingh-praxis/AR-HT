/**
 * Versioned schema migrations for the local SQLite file. `PRAGMA user_version` stores how many have run, so each
 * runs exactly once, in order, inside a transaction. Never edit an old migration: add a new one at the end.
 * Older database files (created before migrations existed) have user_version 0 and are brought up to date safely,
 * because migration 1 only creates what is missing.
 */

/** Adds columns that older database files do not have yet. */
function ensureColumns(db, table, cols) {
  const have = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
  for (const [name, type] of Object.entries(cols)) if (!have.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
}

export const MIGRATIONS = [
  // 1: base schema (what the server had before migrations)
  (db) => {
    db.exec(`
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
    `);
    ensureColumns(db, 'products', { role: 'TEXT', version: 'INTEGER NOT NULL DEFAULT 0' });
    ensureColumns(db, 'designs', { updated_at: 'INTEGER NOT NULL DEFAULT 0', deleted_at: 'INTEGER', thumbnail_key: 'TEXT' });
    db.exec(`
      UPDATE designs SET updated_at = created_at WHERE updated_at = 0;
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_products_role ON products(role);
      CREATE INDEX IF NOT EXISTS idx_products_version ON products(version);
      CREATE INDEX IF NOT EXISTS idx_designs_user ON designs(user_id, updated_at);
    `);
  },

  // 2: uploaded 3D models (one row per uploaded version) and an append-only audit log of admin/editor writes
  (db) => {
    db.exec(`
      CREATE TABLE models(
        id INTEGER PRIMARY KEY, product_id TEXT NOT NULL, version INTEGER NOT NULL, glb_key TEXT NOT NULL, size_mb REAL NOT NULL,
        w_cm REAL, d_cm REAL, h_cm REAL, status TEXT NOT NULL DEFAULT 'ready', report TEXT, reviewed_by INTEGER, created_at INTEGER NOT NULL,
        UNIQUE(product_id, version));
      CREATE TABLE audit_log(
        id INTEGER PRIMARY KEY, actor_id INTEGER, action TEXT NOT NULL, target TEXT, at INTEGER NOT NULL, data TEXT);
      CREATE INDEX idx_audit_at ON audit_log(at);
      CREATE INDEX idx_events_name_ts ON events(name, ts);
    `);
  },

  // 3: production auth: refresh-token families, social identities, one-time email codes, lockout, disabled accounts
  (db) => {
    ensureColumns(db, 'users', { email_verified_at: 'INTEGER', failed_logins: 'INTEGER NOT NULL DEFAULT 0', locked_until: 'INTEGER', disabled_at: 'INTEGER' });
    db.exec(`
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
    `);
  },

  // 4: share links for designs
  (db) => {
    ensureColumns(db, 'designs', { share_slug: 'TEXT' });
    db.exec('CREATE UNIQUE INDEX idx_designs_share ON designs(share_slug) WHERE share_slug IS NOT NULL');
  },

  // 5: client-generated design ids, so a design created offline and retried never appears twice
  (db) => {
    ensureColumns(db, 'designs', { client_id: 'TEXT' });
    db.exec('CREATE UNIQUE INDEX idx_designs_client ON designs(user_id, client_id) WHERE client_id IS NOT NULL');
  },
];

/** Runs every migration that has not run yet. Returns the schema version. */
export function migrate(db, migrations = MIGRATIONS) {
  const current = Number(db.prepare('PRAGMA user_version').get().user_version);
  for (let i = current; i < migrations.length; i++) {
    db.exec('BEGIN');
    try {
      migrations[i](db);
      db.exec(`PRAGMA user_version = ${i + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${i + 1} failed: ${e.message}`);
    }
  }
  return migrations.length;
}
