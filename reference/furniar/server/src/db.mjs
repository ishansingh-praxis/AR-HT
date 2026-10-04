import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

/** SQLite via Node's built-in driver. The schema is plain SQL so moving to Postgres later is mechanical. */
export function openDb(file = ':memory:') {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS products(
      id TEXT PRIMARY KEY, category TEXT NOT NULL, role TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS wishlist(
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, product_id TEXT NOT NULL,
      PRIMARY KEY(user_id, product_id));
    CREATE TABLE IF NOT EXISTS designs(
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS events(
      id INTEGER PRIMARY KEY, device_id TEXT NOT NULL, name TEXT NOT NULL, ts INTEGER NOT NULL, props TEXT NOT NULL);
  `);
  return db;
}

export function seedProducts(db, products) {
  const n = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (n > 0) return;
  const ins = db.prepare('INSERT INTO products(id,category,role,data) VALUES(?,?,?,?)');
  for (const p of products) ins.run(p.id, p.category, p.role, JSON.stringify(p));
}

export function tx(db, fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}
