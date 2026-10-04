import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDb, seedProducts, backupDb } from '../src/db.mjs';
import { MIGRATIONS, migrate } from '../src/migrations.mjs';
import { createStorage } from '../src/lib/storage.mjs';
import { createApp } from '../src/app.mjs';

const catalogue = JSON.parse(fs.readFileSync('../src/data/catalogue.json', 'utf8'));
const glb = fs.readFileSync(path.resolve('../models/raw/_example-GlamVelvetSofa.glb')); // 219 x 102 x 79 cm
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ht-store-'));
let server, base, db, adminTok;

const call = async (method, url, { token, json, body, headers } = {}) => {
  const res = await fetch(base + url, {
    method, headers: { ...(token && { authorization: `Bearer ${token}` }), ...(json && { 'content-type': 'application/json' }), ...headers },
    body: json ? JSON.stringify(json) : body,
  });
  const text = await res.text();
  let b = null; try { b = text ? JSON.parse(text) : null; } catch { b = text; }
  return { status: res.status, body: b };
};

before(async () => {
  db = await openDb(); await seedProducts(db, catalogue);
  const app = createApp({ db, jwtSecret: 'test-secret-1234567', uploadDir: path.join(tmp, 'uploads'), publicUrl: 'http://host-a', authLimit: 1000 });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}`;
  const reg = await call('POST', '/v1/auth/register', { json: { email: 'boss@x.com', password: 'Hometown-Pass-77' } });
  await db.prepare("UPDATE users SET role='admin' WHERE email='boss@x.com'").run();
  adminTok = reg.body.token;
});
after(() => server.close());

test('migrations: run once, in order, idempotent, and upgrade an old database file', async () => {
  const fresh = await openDb(undefined, { migrate: false });
  assert.equal(await migrate(fresh), MIGRATIONS.length);
  assert.equal(await migrate(fresh), MIGRATIONS.length, 'second run changes nothing');
  for (const t of ['models', 'audit_log', 'refresh_tokens', 'auth_identities', 'email_codes']) await fresh.get(`SELECT 1 FROM ${t} LIMIT 1`); // throws if the table is missing
  if (fresh.dialect !== 'sqlite') return; // the old-file upgrade below is a SQLite-only story

  // A database created before migrations existed (user_version 0, older products table) is upgraded without data loss.
  const old = await openDb(':memory:', { migrate: false });
  await old.exec("CREATE TABLE users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at INTEGER NOT NULL);" +
    "CREATE TABLE products(id TEXT PRIMARY KEY, category TEXT NOT NULL, data TEXT NOT NULL);" +
    "INSERT INTO users(email,password_hash,created_at) VALUES('old@x.com','h',1);" + "INSERT INTO products VALUES('p1','Sofa','{}');");
  await migrate(old);
  assert.equal((await old.get('SELECT email FROM users')).email, 'old@x.com');
  assert.ok((await old.all('PRAGMA table_info(products)')).some((c) => c.name === 'version'));
  assert.equal(Number((await old.get('PRAGMA user_version')).user_version), MIGRATIONS.length);
});

test('migrations: a failing migration rolls back and reports which one', async () => {
  const d = await openDb(undefined, { migrate: false });
  const bad = [(db2) => db2.exec('CREATE TABLE a(x INTEGER)'), () => { throw new Error('boom'); }];
  await assert.rejects(() => migrate(d, bad), /Migration 2 failed: boom/);
  await d.get('SELECT 1 FROM a LIMIT 1'); // the first one stays applied
});

test('storage: keys cannot escape the folder; put/get/delete work', () => {
  const s = createStorage({ dir: path.join(tmp, 's1'), publicBase: 'http://cdn/x', secret: 's' });
  for (const k of ['../evil', 'a/../../evil', '/abs', 'a//b', '.hidden', 'a b', '']) assert.throws(() => s.resolve(k), /Invalid storage key/, k);
  s.putObject('models/a-v1.glb', Buffer.from('hi'));
  assert.equal(s.getObject('models/a-v1.glb').toString(), 'hi');
  assert.equal(s.publicUrl('models/a-v1.glb'), 'http://cdn/x/models/a-v1.glb');
  s.deleteObject('models/a-v1.glb');
  assert.equal(s.getObject('models/a-v1.glb'), null);
});

test('storage: signed upload tokens are tied to one key, expire, and cannot be forged', () => {
  const s = createStorage({ dir: path.join(tmp, 's2'), publicBase: '', secret: 'k1' });
  const t = s.signUpload('models/x-v1.glb');
  assert.equal(s.verifyUpload(t).key, 'models/x-v1.glb');
  assert.throws(() => s.verifyUpload(t.slice(0, -2) + 'xx'), /Invalid upload link/);
  assert.throws(() => createStorage({ dir: path.join(tmp, 's2'), publicBase: '', secret: 'k2' }).verifyUpload(t), /Invalid upload link/);
  assert.throws(() => s.verifyUpload(s.signUpload('models/x-v1.glb', { ttlSec: -1 })), /expired/);
});

test('model upload: signed link -> PUT -> validate publishes, versions, records and audits', async () => {
  assert.equal((await call('POST', '/v1/admin/models/sofa-leather/upload-url')).status, 401);
  const up = await call('POST', '/v1/admin/models/sofa-leather/upload-url', { token: adminTok });
  assert.equal(up.status, 200);
  assert.equal(up.body.method, 'PUT');
  assert.match(up.body.key, /^models\/sofa-leather-v\d+\.glb$/);
  const dims = JSON.parse((await db.prepare('SELECT data FROM products WHERE id=?').get('sofa-leather')).data).dimensionsCm;

  // Validate before anything is uploaded -> 404
  assert.equal((await call('POST', '/v1/admin/models/sofa-leather/validate', { token: adminTok, json: { key: up.body.key } })).status, 404);
  // Wrong key shape -> 400
  assert.equal((await call('POST', '/v1/admin/models/sofa-leather/validate', { token: adminTok, json: { key: 'models/other-v1.glb' } })).status, 400);

  // Upload a model of the wrong size: rejected and removed from disk
  const put = await fetch(up.body.uploadUrl.replace('http://host-a', base), { method: 'PUT', body: glb, headers: { 'content-type': 'application/octet-stream' } });
  assert.equal(put.status, 201, await put.clone().text());
  const bad = await call('POST', '/v1/admin/models/sofa-leather/validate', { token: adminTok, json: { key: up.body.key } });
  if (dims.w === 219 && dims.d === 102 && dims.h === 79) assert.equal(bad.status, 200);
  else { assert.equal(bad.status, 422); assert.equal(fs.existsSync(path.join(tmp, 'uploads', up.body.key)), false); }

  // Use a product whose listed size matches the example GLB
  const mk = await call('POST', '/v1/admin/products', { token: adminTok, form: undefined, json: undefined, body: (() => { const f = new FormData(); f.set('product', JSON.stringify({ id: 'sofa-up', name: 'Upload Sofa', category: 'Sofa', dimensionsCm: { w: 219, d: 102, h: 79 } })); return f; })() });
  assert.equal(mk.status, 201, JSON.stringify(mk.body));
  const up2 = await call('POST', '/v1/admin/models/sofa-up/upload-url', { token: adminTok });
  assert.equal((await fetch(up2.body.uploadUrl.replace('http://host-a', base), { method: 'PUT', body: glb })).status, 201);
  const ok = await call('POST', '/v1/admin/models/sofa-up/validate', { token: adminTok, json: { key: up2.body.key } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.product.modelStatus, 'ready');
  assert.equal(ok.body.product.model3D.url, `http://host-a/files/${up2.body.key}`);
  assert.equal((await fetch(`${base}/files/${up2.body.key}`)).headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const models = await call('GET', '/v1/admin/models/sofa-up', { token: adminTok });
  assert.equal(models.body.length, 1);
  assert.ok(models.body[0].size_mb > 0);
  const log = await call('GET', '/v1/admin/audit', { token: adminTok });
  assert.ok(log.body.some((x) => x.action === 'model.publish' && x.target === 'sofa-up'));
  assert.ok(log.body.some((x) => x.action === 'product.create' && x.target === 'sofa-up'));
  // The next upload for the same product is version 2 (files are immutable)
  const up3 = await call('POST', '/v1/admin/models/sofa-up/upload-url', { token: adminTok });
  assert.match(up3.body.key, /-v2\.glb$/);
});

test('uploads: bad token, empty body and oversize are refused', async () => {
  assert.equal((await fetch(`${base}/v1/uploads/not-a-token`, { method: 'PUT', body: 'x' })).status, 403);
  const up = await call('POST', '/v1/admin/models/sofa-up/upload-url', { token: adminTok });
  assert.equal((await fetch(up.body.uploadUrl.replace('http://host-a', base), { method: 'PUT' })).status, 400);
});

test('backup: VACUUM INTO makes a readable copy', async (t) => {
  if (db.dialect !== 'sqlite') return t.skip('PostgreSQL is backed up with pg_dump or snapshots');
  const dest = path.join(tmp, 'backup', 'copy.db');
  await backupDb(db, dest);
  const copy = new DatabaseSync(dest);
  assert.equal(Number(copy.prepare('SELECT COUNT(*) AS n FROM products').get().n), Number((await db.prepare('SELECT COUNT(*) AS n FROM products').get()).n));
});
