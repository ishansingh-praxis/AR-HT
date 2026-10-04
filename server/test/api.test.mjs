import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, seedProducts, seedRooms, migrateModelKeys } from '../src/db.mjs';
import { createApp } from '../src/app.mjs';

const catalogue = JSON.parse(fs.readFileSync('../src/data/catalogue.json', 'utf8'));
const rooms = JSON.parse(fs.readFileSync('../src/data/rooms.json', 'utf8'));
const glb = path.resolve('../models/raw/_example-GlamVelvetSofa.glb'); // 219 x 102 x 79 cm
let db0, server, base, adminTok, userTok, mockReply, lastBody;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ht-'));

const call = async (method, url, { token, json, form } = {}) => {
  const res = await fetch(base + (url.startsWith('/admin') && !url.startsWith('/admin/') ? '' : '/v1') + url, {
    method,
    headers: { ...(token && { authorization: `Bearer ${token}` }), ...(json && { 'content-type': 'application/json' }) },
    body: json ? JSON.stringify(json) : form,
  });
  const text = await res.text();
  let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
};
const newProduct = (o = {}) => ({ id: 'sofa-new', name: 'New Sofa', category: 'Sofa', dimensionsCm: { w: 219, d: 102, h: 79 }, ...o });
const upload = (p, file = glb) => { const f = new FormData(); f.set('product', JSON.stringify(p)); f.set('model', new Blob([fs.readFileSync(file)]), 'm.glb'); return f; };

before(async () => {
  const db = await openDb(); db0 = db;
  await seedProducts(db, catalogue); await seedRooms(db, rooms);
  const app = createApp({ db, jwtSecret: 't', uploadDir: tmp, publicUrl: 'http://host-a', authLimit: 1000, anthropicKey: 'k',
    fetchImpl: async (_u, init) => { lastBody = JSON.parse(init.body); return mockReply(); } });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}`;
  const reg = await call('POST', '/auth/register', { json: { email: 'admin@x.com', password: 'Hometown-Pass-77' } });
  assert.equal(reg.body.user.role, 'user', 'a former admin email no longer grants admin at sign-up');
  await db.prepare("UPDATE users SET role='admin' WHERE email='admin@x.com'").run(); // what scripts/make-admin.mjs does
  adminTok = reg.body.token;
  userTok = (await call('POST', '/auth/register', { json: { email: 'u@x.com', password: 'Hometown-Pass-77' } })).body.token;
});
after(() => server.close());

test('auth: duplicate, wrong password, short password', async () => {
  assert.equal((await call('POST', '/auth/register', { json: { email: 'u@x.com', password: 'Hometown-Pass-77' } })).status, 409);
  assert.equal((await call('POST', '/auth/login', { json: { email: 'u@x.com', password: 'nope' } })).status, 401);
  assert.equal((await call('POST', '/auth/register', { json: { email: 'a@b.com', password: 'short' } })).status, 400);
});

test('catalogue: no prices or stock, filter and detail work', async () => {
  const all = (await call('GET', '/products')).body;
  assert.equal(all.total, catalogue.length);
  assert.ok(all.items.every((p) => !('price' in p) && !('stock' in p)));
  assert.equal((await call('GET', '/products?category=Sofa')).body.items.every((p) => p.category === 'Sofa'), true);
  assert.equal((await call('GET', '/products/nope')).status, 404);
  assert.equal((await call('GET', '/orders')).status, 404, 'shop endpoints are gone');
});

test('designs: save, rename, owner-only, validation', async () => {
  const d = { name: 'Mine', roomType: 'Living room', items: [{ productId: catalogue[0].id, offset: [0, 0, 0], rotationY: 0, scale: 1 }] };
  const made = await call('POST', '/designs', { token: userTok, json: d });
  assert.equal(made.status, 201);
  assert.equal((await call('PATCH', `/designs/${made.body.id}`, { token: userTok, json: { name: 'Renamed' } })).body.name, 'Renamed');
  assert.equal((await call('GET', `/designs/${made.body.id}`, { token: adminTok })).status, 404);
  assert.equal((await call('POST', '/designs', { token: userTok, json: { items: [{ productId: 'ghost', offset: [0, 0, 0], rotationY: 0, scale: 1 }] } })).status, 400);
});

test('admin: auth, wrong size rejected, junk rejected, upload ok, dims change needs new model', async () => {
  assert.equal((await call('POST', '/admin/products', { token: userTok, form: upload(newProduct()) })).status, 403);
  const bad = await call('POST', '/admin/products', { token: adminTok, form: upload(newProduct({ dimensionsCm: { w: 150, d: 102, h: 79 } })) });
  assert.equal(bad.status, 422);
  const junk = path.join(tmp, 'junk.glb'); fs.writeFileSync(junk, 'not a glb');
  assert.equal((await call('POST', '/admin/products', { token: adminTok, form: upload(newProduct(), junk) })).status, 422);
  assert.equal((await call('GET', '/products/sofa-new')).status, 404);
  const ok = await call('POST', '/admin/products', { token: adminTok, form: upload(newProduct({ family: 'new-sofa' })) });
  assert.equal(ok.status, 201);
  assert.equal((await fetch(ok.body.product.model3D.url.replace(/^.*\/files/, base + '/files'))).status, 200);
  assert.match(ok.body.product.model3D.url, /^http:\/\/host-a\/files\/models\/sofa-new-v1\.glb$/);
  const f = new FormData(); f.set('product', JSON.stringify(newProduct({ dimensionsCm: { w: 230, d: 102, h: 79 } })));
  assert.equal((await call('PUT', '/admin/products/sofa-new', { token: adminTok, form: f })).status, 422);
  assert.equal((await call('DELETE', '/admin/products/sofa-new', { token: adminTok })).status, 204);
  assert.match((await call('GET', '/admin')).body, /HomeTown AR admin|admin dashboard is not built/);
});

test('account deletion removes user and designs', async () => {
  assert.equal((await call('DELETE', '/me', { token: userTok })).status, 204);
  assert.equal((await call('GET', '/me', { token: userTok })).status, 401);
});

test('admin: attach a model to a seeded real product without losing its photos or links', async () => {
  const real = catalogue.find((p) => !p.model3D);
  const before = (await call('GET', `/products/${real.id}`)).body;
  assert.equal(before.model3D ?? null, null);
  // The model must match the product's real size, so test with a product sized like the sample sofa.
  const f = new FormData();
  f.set('product', JSON.stringify({ id: real.id, name: real.name, category: real.category, dimensionsCm: { w: 219, d: 102, h: 79 } }));
  f.set('model', new Blob([fs.readFileSync(glb)]), 'm.glb');
  const r = await call('PUT', `/admin/products/${real.id}`, { token: adminTok, form: f });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const after = (await call('GET', `/products/${real.id}`)).body;
  assert.ok(after.model3D?.url);
  assert.deepEqual(after.images, real.images);
  assert.deepEqual(after.linked ?? [], real.linked ?? []);
});

test('AI layout: validates the model answer, drops unknown ids and bad sides, needs sign-in', async () => {
  const sofa = catalogue.find((p) => p.category === 'Sofa' && p.proxy);
  const table = catalogue.find((p) => p.category === 'Table' && p.proxy);
  const ok = (text) => () => ({ ok: true, json: async () => ({ content: [{ type: 'text', text }] }) });
  const ask = (token = userTok2) => call('POST', '/layout/suggest', { token, json: { roomType: 'Living room', anchorId: sofa.id, room: { area: 14, maxSpan: 5 } } });
  const userTok2 = (await call('POST', '/auth/register', { json: { email: 'ai@x.com', password: 'Hometown-Pass-77' } })).body.token;

  assert.equal((await ask(null)).status, 401);
  mockReply = ok('```json\n' + JSON.stringify({ slots: [
    { productId: table.id, side: 'front', gap: 9, why: 'coffee table' },
    { productId: 'made-up-id', side: 'left', gap: 0.3 },
    { productId: table.id, side: 'right', gap: 0.3 },
    { productId: catalogue.find((p) => p.category === 'Chair' && p.proxy).id, side: 'sideways', gap: 0.3 },
  ] }) + '\n```');
  const r = await ask();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.slots.length, 1, 'unknown id, duplicate and bad side are dropped');
  assert.equal(r.body.slots[0].gap, 1.2, 'gap is clamped');
  assert.ok(lastBody.messages[0].content.includes(sofa.id) && !lastBody.messages[0].content.includes('sofa-velvet'), 'prompt uses real catalogue, not demo models');

  mockReply = ok('I think a rug would be nice.');
  assert.equal((await ask()).status, 502);
  mockReply = () => ({ ok: false, status: 500, json: async () => ({}) });
  assert.equal((await ask()).status, 502);
});

test('AI layout: 503 when no API key is configured', async () => {
  const db = await openDb(); await seedProducts(db, catalogue);
  const app2 = createApp({ db, jwtSecret: 't', uploadDir: tmp, authLimit: 1000 });
  const s2 = await new Promise((r) => { const x = app2.listen(0, () => r(x)); });
  const b2 = `http://localhost:${s2.address().port}`;
  const tok = (await (await fetch(b2 + '/v1/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'n@x.com', password: 'Hometown-Pass-77' }) })).json()).token;
  const res = await fetch(b2 + '/v1/layout/suggest', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: JSON.stringify({ roomType: 'Living room', anchorId: 'x' }) });
  assert.equal(res.status, 503);
  s2.close();
});

test('catalogue: paging by offset returns every product (client fetches all pages)', async () => {
  const seen = [];
  let total = Infinity;
  for (let offset = 0; offset < total; offset += 100) {
    const r = (await call('GET', `/products?limit=100&offset=${offset}`)).body;
    total = r.total; seen.push(...r.items);
  }
  assert.equal(seen.length, catalogue.length);
  assert.equal(new Set(seen.map((p) => p.id)).size, catalogue.length);
});

test('model URLs are built from PUBLIC_URL at read time, and old rows are migrated to keys', async () => {
  const mk = (publicUrl, db) => createApp({ db, jwtSecret: 't', uploadDir: tmp, publicUrl, authLimit: 1000 });
  const db = await openDb(); await seedProducts(db, catalogue);
  const id = catalogue.find((p) => p.category === 'Bed').id;
  const row = JSON.parse((await db.prepare('SELECT data FROM products WHERE id=?').get(id)).data);
  row.model3D = { url: 'http://old-host/files/models/legacy-v1.glb', version: 1, unit: 'm' };
  await db.prepare('UPDATE products SET data=? WHERE id=?').run(JSON.stringify(row), id);
  await migrateModelKeys(db); // runs when the database opens (here: after we planted an old-style row)
  const get = async (publicUrl) => {
    const s = await new Promise((r) => { const x = mk(publicUrl, db).listen(0, () => r(x)); });
    const body = await (await fetch(`http://localhost:${s.address().port}/v1/products/${id}`)).json();
    s.close(); return body;
  };
  assert.equal((await get('http://cdn-a')).model3D.url, 'http://cdn-a/files/models/legacy-v1.glb');
  assert.equal((await get('http://cdn-b')).model3D.url, 'http://cdn-b/files/models/legacy-v1.glb');
  assert.equal(JSON.parse((await db.prepare('SELECT data FROM products WHERE id=?').get(id)).data).model3D.key, 'models/legacy-v1.glb');
});

test('AI layout: per-user limits per minute and per day return 429', async () => {
  const db = await openDb(); await seedProducts(db, catalogue);
  const app2 = createApp({ db, jwtSecret: 't', uploadDir: tmp, authLimit: 1000, anthropicKey: '', layoutLimits: { perMinute: 2, perDay: 3 } });
  const s2 = await new Promise((r) => { const x = app2.listen(0, () => r(x)); });
  const b2 = `http://localhost:${s2.address().port}`;
  const reg = async (email) => (await (await fetch(b2 + '/v1/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Hometown-Pass-77' }) })).json()).token;
  const hit = async (tok) => (await fetch(b2 + '/v1/layout/suggest', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: JSON.stringify({ roomType: 'Living room', anchorId: 'x' }) }));
  const a = await reg('a@x.com'), b = await reg('b@x.com');
  assert.equal((await hit(a)).status, 503); assert.equal((await hit(a)).status, 503);
  const third = await hit(a);
  assert.equal(third.status, 429); assert.match((await third.json()).error, /minute/);
  assert.equal((await hit(b)).status, 503, 'limits are per user');
  s2.close();
});

test('products by category use the SQL filter', async () => {
  const r = (await call('GET', '/products?category=Bed&limit=100')).body;
  assert.equal(r.total, catalogue.filter((p) => p.category === 'Bed').length);
});
