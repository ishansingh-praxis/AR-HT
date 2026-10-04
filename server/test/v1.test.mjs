import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, seedProducts, seedRooms } from '../src/db.mjs';
import { createApp } from '../src/app.mjs';

const catalogue = JSON.parse(fs.readFileSync('../src/data/catalogue.json', 'utf8'));
const rooms = JSON.parse(fs.readFileSync('../src/data/rooms.json', 'utf8'));
const glb = path.resolve('../models/raw/_example-GlamVelvetSofa.glb'); // 219 x 102 x 79 cm
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ht-v1-'));
let server, base, db, adminTok;

const call = async (method, url, { token, json, form } = {}) => {
  const res = await fetch(`${base}/v1${url}`, {
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
const register = async (email) => (await call('POST', '/auth/register', { json: { email, password: 'Hometown-Pass-77' } })).body.token;

before(async () => {
  db = openDb();
  seedProducts(db, catalogue); seedRooms(db, rooms);
  const app = createApp({ db, jwtSecret: 't', uploadDir: tmp, publicUrl: 'http://host-a', authLimit: 1000, eventLimit: 1000, corsOrigins: ['https://admin.example'] });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}`;
  adminTok = await register('admin@x.com');
  db.prepare("UPDATE users SET role='admin' WHERE email='admin@x.com'").run();
});
after(() => server.close());

test('rooms: curated rooms are served from the database', async () => {
  const r = await call('GET', '/rooms');
  assert.equal(r.status, 200);
  assert.equal(r.body.length, rooms.length);
  assert.ok(r.body.every((x) => x.pieces.length && x.roomCm.w > 0));
});

test('catalogue delta: full, since, removed, ETag 304, gzip', async () => {
  const full = (await call('GET', '/catalogue')).body;
  assert.equal(full.products.length, catalogue.length);
  assert.deepEqual(full.removed, []);
  assert.ok(full.version >= catalogue.length);
  const none = (await call('GET', `/catalogue?since=${full.version}`)).body;
  assert.deepEqual([none.products.length, none.removed.length, none.version], [0, 0, full.version]);

  const first = await fetch(`${base}/v1/catalogue?since=${full.version}`);
  const etag = first.headers.get('etag');
  assert.ok(etag);
  assert.equal((await fetch(`${base}/v1/catalogue?since=${full.version}`, { headers: { 'if-none-match': etag } })).status, 304);
  const gz = await fetch(`${base}/v1/catalogue`, { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(gz.headers.get('content-encoding'), 'gzip');

  const p = newProduct({ id: 'delta-sofa', name: 'Delta Sofa', role: 'sofa' });
  assert.equal((await call('POST', '/admin/products', { token: adminTok, form: upload(p) })).status, 201);
  const d1 = (await call('GET', `/catalogue?since=${full.version}`)).body;
  assert.deepEqual(d1.products.map((x) => x.id), ['delta-sofa']);
  assert.ok(d1.version > full.version);
  assert.match(d1.products[0].model3D.url, /^http:\/\/host-a\/files\/models\//);
  assert.equal((await call('DELETE', '/admin/products/delta-sofa', { token: adminTok })).status, 204);
  const d2 = (await call('GET', `/catalogue?since=${d1.version}`)).body;
  assert.deepEqual([d2.products.length, d2.removed], [0, ['delta-sofa']]);
});

test('admin: a product can be created without a GLB (proxy) and a GLB attached later', async () => {
  const base0 = newProduct({ id: 'desk-proxy', name: 'Desk Proxy', category: 'Table', role: 'desk' });
  const f = new FormData(); f.set('product', JSON.stringify(base0));
  const made = await call('POST', '/admin/products', { token: adminTok, form: f });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.equal(made.body.product.modelStatus, 'proxy');
  assert.equal(made.body.product.model3D, undefined);
  const f2 = new FormData(); f2.set('product', JSON.stringify({ ...base0, dimensionsCm: { w: 120, d: 60, h: 75 } }));
  assert.equal((await call('PUT', '/admin/products/desk-proxy', { token: adminTok, form: f2 })).status, 200, 'proxy dimensions change freely');
  assert.equal((await call('GET', '/products/desk-proxy')).body.dimensionsCm.w, 120);
  const ok = await call('PUT', '/admin/products/desk-proxy', { token: adminTok, form: upload(base0) });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.product.modelStatus, 'ready');
  assert.equal((await call('DELETE', '/admin/products/desk-proxy', { token: adminTok })).status, 204);
});

test('products: role and roomType filters', async () => {
  const sofas = (await call('GET', '/products?role=sofa&limit=100')).body;
  assert.equal(sofas.total, catalogue.filter((p) => p.role === 'sofa').length);
  assert.ok(sofas.items.every((p) => p.role === 'sofa'));
  const bed = (await call('GET', '/products?roomType=bedroom&limit=100')).body;
  assert.equal(bed.total, catalogue.filter((p) => (p.roomTypes ?? []).includes('bedroom')).length);
});

test('wishlist is per user, idempotent and validates the product', async () => {
  const a = await register('wa@x.com'), b = await register('wb@x.com');
  const id = catalogue[5].id;
  assert.equal((await call('GET', '/wishlist')).status, 401);
  assert.equal((await call('PUT', `/wishlist/${id}`, { token: a })).status, 204);
  assert.equal((await call('PUT', `/wishlist/${id}`, { token: a })).status, 204, 'idempotent');
  assert.equal((await call('PUT', '/wishlist/ghost', { token: a })).status, 404);
  assert.deepEqual((await call('GET', '/wishlist', { token: a })).body.map((x) => x.id), [id]);
  assert.deepEqual((await call('GET', '/wishlist', { token: b })).body, [], 'per user');
  assert.equal((await call('DELETE', `/wishlist/${id}`, { token: a })).status, 204);
  assert.deepEqual((await call('GET', '/wishlist', { token: a })).body, []);
});

test('designs: since, soft delete, replace items, stale updatedAt is 409, thumbnail and scan stored', async () => {
  const tok = await register('sync@x.com');
  const items = (n) => Array.from({ length: n }, () => ({ productId: catalogue[0].id, offset: [0, 0, 0], rotationY: 0, scale: 1 }));
  const uid = (await call('GET', '/me', { token: tok })).body.user.id;
  assert.equal((await call('POST', '/designs', { token: tok, json: { items: items(1), thumbnailKey: 'thumbs/elsewhere.jpg' } })).status, 400, 'thumbnail key must be in the user folder');
  const a = (await call('POST', '/designs', { token: tok, json: { name: 'A', items: items(1), roomType: 'Living room', frame: true, scan: { widthCm: 450, depthCm: 380, areaM2: 17.1 }, thumbnailKey: `thumbnails/${uid}/a.jpg` } })).body;
  assert.equal(a.scan.areaM2, 17.1); assert.equal(a.thumbnailKey, `thumbnails/${uid}/a.jpg`); assert.equal(a.frame, true); assert.ok(a.updatedAt >= a.createdAt);
  const t0 = (await call('GET', '/designs', { token: tok })).body.serverTime;
  await new Promise((r) => setTimeout(r, 5));
  const b = (await call('POST', '/designs', { token: tok, json: { name: 'B', items: items(1) } })).body;
  const since = (await call('GET', `/designs?since=${t0}`, { token: tok })).body;
  assert.deepEqual(since.designs.map((d) => d.id), [b.id], 'only changes since the timestamp');

  const ok = await call('PATCH', `/designs/${a.id}`, { token: tok, json: { items: items(3), updatedAt: a.updatedAt } });
  assert.equal(ok.status, 200); assert.equal(ok.body.items.length, 3); assert.ok(ok.body.updatedAt > a.updatedAt);
  const stale = await call('PATCH', `/designs/${a.id}`, { token: tok, json: { items: items(2), updatedAt: a.updatedAt } });
  assert.equal(stale.status, 409); assert.equal(stale.body.current.items.length, 3);
  assert.equal((await call('PATCH', `/designs/${a.id}`, { token: tok, json: {} })).status, 400);
  assert.equal((await call('PATCH', `/designs/${a.id}`, { token: tok, json: { items: [{ productId: 'ghost', offset: [0, 0, 0], rotationY: 0, scale: 1 }] } })).status, 400);

  const t1 = Date.now() - 1;
  assert.equal((await call('DELETE', `/designs/${b.id}`, { token: tok })).status, 204);
  assert.equal((await call('GET', `/designs/${b.id}`, { token: tok })).status, 404);
  const after = (await call('GET', `/designs?since=${t1}`, { token: tok })).body;
  assert.ok(after.deleted.includes(b.id));
  assert.ok(!(await call('GET', '/designs', { token: tok })).body.designs.some((d) => d.id === b.id));
});

test('events: allow-listed names, flat props, 50 per batch', async () => {
  const ev = (name, props = {}) => ({ name, ts: Date.now(), props });
  const post = (json) => call('POST', '/events', { json });
  const before0 = Number(db.prepare('SELECT COUNT(*) AS n FROM events').get().n);
  assert.equal((await post({ deviceId: 'device-12345', events: [ev('rec_shown', { productId: 'x', n: 3 }), ev('room_scanned', { areaM2: 14, corners: 4 })] })).status, 204);
  assert.equal((await post({ deviceId: 'device-12345', events: [ev('steal_camera_frame')] })).status, 400);
  assert.equal((await post({ deviceId: 'device-12345', events: [ev('rec_shown', { frame: { nested: 'object' } })] })).status, 400, 'props must be flat scalars');
  assert.equal((await post({ deviceId: 'short', events: [ev('rec_shown')] })).status, 400);
  assert.equal((await post({ deviceId: 'device-12345', events: Array.from({ length: 51 }, () => ev('rec_shown')) })).status, 400);
  assert.equal(Number(db.prepare('SELECT COUNT(*) AS n FROM events').get().n) - before0, 2, 'only the valid batch is stored');
});

test('hygiene: request id, /ready, unknown route 404, bad JSON 400, CORS allow-list', async () => {
  const h = await fetch(`${base}/health`);
  assert.ok(h.headers.get('x-request-id'));
  assert.equal((await fetch(`${base}/ready`)).status, 200);
  assert.equal((await fetch(`${base}/v1/nope`)).status, 404);
  assert.equal((await fetch(`${base}/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' })).status, 400);
  const evil = await fetch(`${base}/health`, { headers: { origin: 'https://evil.example' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  const good = await fetch(`${base}/health`, { headers: { origin: 'https://admin.example' } });
  assert.equal(good.headers.get('access-control-allow-origin'), 'https://admin.example');
});
