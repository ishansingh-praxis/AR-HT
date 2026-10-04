import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, seedProducts } from '../src/db.mjs';
import { createApp } from '../src/app.mjs';

const catalogue = JSON.parse(fs.readFileSync('../src/data/catalogue.json', 'utf8'));
const glb = path.resolve('../.cache/sofa-velvet-v1.glb'); // 219 x 102 x 79 cm, cached by `npm run validate:models`
let server, base, adminTok, userTok;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'furni-'));

const call = async (method, url, { token, json, form } = {}) => {
  const res = await fetch(base + url, {
    method,
    headers: { ...(token && { authorization: `Bearer ${token}` }), ...(json && { 'content-type': 'application/json' }) },
    body: json ? JSON.stringify(json) : form,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

before(async () => {
  const db = openDb();
  seedProducts(db, catalogue);
  const app = createApp({ db, jwtSecret: 't', uploadDir: tmp, adminEmails: ['admin@x.com'], authLimit: 1000 });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}`;
  adminTok = (await call('POST', '/auth/register', { json: { email: 'admin@x.com', password: 'password123' } })).body.token;
  userTok = (await call('POST', '/auth/register', { json: { email: 'user@x.com', password: 'password123', name: 'U' } })).body.token;
});
after(() => server.close());

const newProduct = (over = {}) => ({
  id: 'sofa-new', name: 'New Sofa', role: 'sofa', styles: ['modern'], roomTypes: ['living'],
  dimensionsCm: { w: 219, d: 102, h: 79 }, ...over,
});
const upload = (product, file = glb) => {
  const f = new FormData();
  f.set('product', JSON.stringify(product));
  f.set('model', new Blob([fs.readFileSync(file)]), 'm.glb');
  return f;
};

test('auth: register, login, wrong password, duplicate, short password', async () => {
  assert.equal((await call('POST', '/auth/login', { json: { email: 'user@x.com', password: 'password123' } })).status, 200);
  assert.equal((await call('POST', '/auth/login', { json: { email: 'user@x.com', password: 'nope' } })).status, 401);
  assert.equal((await call('POST', '/auth/register', { json: { email: 'user@x.com', password: 'password123' } })).status, 409);
  assert.equal((await call('POST', '/auth/register', { json: { email: 'a@b.com', password: 'short' } })).status, 400);
  assert.equal((await call('GET', '/me')).status, 401);
  assert.equal((await call('GET', '/me', { token: userTok })).body.user.role, 'user');
  assert.equal((await call('GET', '/me', { token: adminTok })).body.user.role, 'admin');
});

test('catalogue: list, filters, detail, 404', async () => {
  const total = catalogue.length;
  assert.equal((await call('GET', '/products?limit=100')).body.total, total);
  assert.equal((await call('GET', '/products?role=sofa&limit=100')).body.total, catalogue.filter((p) => p.role === 'sofa').length);
  assert.equal((await call('GET', '/products?roomType=bedroom&limit=100')).body.total, catalogue.filter((p) => p.roomTypes.includes('bedroom')).length);
  assert.equal((await call('GET', '/products?q=nova&limit=100')).body.total, catalogue.filter((p) => p.name.toLowerCase().includes('nova')).length);
  const sofa = (await call('GET', '/products/icon-velvet-3-seater-sofa-beige')).body;
  assert.equal(sofa.dimensionsCm.w, 202);
  assert.equal(sofa.modelStatus, 'proxy');
  assert.equal((await call('GET', '/products/nope')).status, 404);
});

test('wishlist is per user and idempotent', async () => {
  assert.equal((await call('PUT', '/wishlist/chair-sheen', { token: userTok })).status, 204);
  assert.equal((await call('PUT', '/wishlist/chair-sheen', { token: userTok })).status, 204);
  assert.deepEqual((await call('GET', '/wishlist', { token: userTok })).body, ['chair-sheen']);
  assert.deepEqual((await call('GET', '/wishlist', { token: adminTok })).body, []);
  assert.equal((await call('PUT', '/wishlist/ghost', { token: userTok })).status, 404);
  await call('DELETE', '/wishlist/chair-sheen', { token: userTok });
  assert.deepEqual((await call('GET', '/wishlist', { token: userTok })).body, []);
});

test('designs: save, list, owner-only access, validation', async () => {
  const items = [{ productId: 'sofa-velvet', offset: [0, 0, 0], rotationY: 0, scale: 1 }];
  const c = await call('POST', '/designs', { token: userTok, json: { items } });
  assert.equal(c.status, 201);
  assert.equal((await call('GET', `/designs/${c.body.id}`, { token: userTok })).body.items.length, 1);
  assert.equal((await call('GET', `/designs/${c.body.id}`, { token: adminTok })).status, 404);
  assert.equal((await call('POST', '/designs', { token: userTok, json: { items: [{ ...items[0], productId: 'ghost' }] } })).status, 400);
  assert.equal((await call('POST', '/designs', { token: userTok, json: { items: [] } })).status, 400);
  assert.equal((await call('GET', '/designs', { token: userTok })).body.length, 1);
});

test('admin: auth, upload accepted, wrong-size rejected, non-GLB rejected, model optional, update rules', async () => {
  assert.equal((await call('POST', '/admin/products', { token: userTok, form: upload(newProduct()) })).status, 403);
  assert.equal((await call('POST', '/admin/products', { form: upload(newProduct()) })).status, 401);

  const bad = await call('POST', '/admin/products', { token: adminTok, form: upload(newProduct({ dimensionsCm: { w: 150, d: 102, h: 79 } })) });
  assert.equal(bad.status, 422);
  assert.match(bad.body.issues[0], /^w: model is 219 cm but listed as 150 cm/);
  assert.equal((await call('POST', '/admin/products', { token: adminTok, form: upload(newProduct({ role: 'spaceship' })) })).status, 400, 'unknown role');

  const junk = path.join(tmp, 'junk.glb');
  fs.writeFileSync(junk, 'not a glb');
  assert.equal((await call('POST', '/admin/products', { token: adminTok, form: upload(newProduct(), junk) })).status, 422);
  assert.equal((await call('GET', '/products/sofa-new')).status, 404, 'rejected uploads must not create products');

  const ok = await call('POST', '/admin/products', { token: adminTok, form: upload(newProduct()) });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.product.model3D.version, 1);
  assert.equal(ok.body.product.modelStatus, 'ready');
  assert.equal((await fetch(ok.body.product.model3D.url.replace(/^/, base))).status, 200);
  assert.equal((await call('POST', '/admin/products', { token: adminTok, form: upload(newProduct()) })).status, 409);

  // a product with no GLB yet is allowed (real data has none): it becomes a to-scale proxy
  const f0 = new FormData(); f0.set('product', JSON.stringify(newProduct({ id: 'desk-proxy', role: 'desk', roomTypes: ['study'] })));
  const prox = await call('POST', '/admin/products', { token: adminTok, form: f0 });
  assert.equal(prox.status, 201);
  assert.equal(prox.body.product.modelStatus, 'proxy');
  assert.equal(prox.body.product.model3D, undefined);

  // metadata-only edit is fine; changing dimensions of a product that HAS a model without re-uploading is not
  const f1 = new FormData(); f1.set('product', JSON.stringify(newProduct({ styles: ['minimal'] })));
  assert.equal((await call('PUT', '/admin/products/sofa-new', { token: adminTok, form: f1 })).status, 200);
  assert.deepEqual((await call('GET', '/products/sofa-new')).body.styles, ['minimal']);
  const f2 = new FormData(); f2.set('product', JSON.stringify(newProduct({ dimensionsCm: { w: 230, d: 102, h: 79 } })));
  assert.equal((await call('PUT', '/admin/products/sofa-new', { token: adminTok, form: f2 })).status, 422);
  // ...but a proxy product's size can be corrected freely
  const f3 = new FormData(); f3.set('product', JSON.stringify(newProduct({ id: 'desk-proxy', role: 'desk', roomTypes: ['study'], dimensionsCm: { w: 120, d: 60, h: 75 } })));
  assert.equal((await call('PUT', '/admin/products/desk-proxy', { token: adminTok, form: f3 })).status, 200);

  assert.equal((await call('DELETE', '/admin/products/sofa-new', { token: adminTok })).status, 204);
});

test('events: valid batch stored, unknown names and oversize batches rejected', async () => {
  const ev = (name, props = {}) => ({ name, ts: Date.now(), props });
  assert.equal((await call('POST', '/events', { json: { deviceId: 'device-12345', events: [ev('rec_shown', { productId: 'x', role: 'sofa' }), ev('room_scanned', { areaM2: 14, corners: 4 })] } })).status, 204);
  assert.equal((await call('POST', '/events', { json: { deviceId: 'device-12345', events: [ev('steal_camera_frame')] } })).status, 400);
  assert.equal((await call('POST', '/events', { json: { deviceId: 'device-12345', events: [ev('rec_shown', { frame: { nested: 'object' } })] } })).status, 400, 'props must be flat scalars');
  assert.equal((await call('POST', '/events', { json: { deviceId: 'short', events: [ev('rec_shown')] } })).status, 400);
  assert.equal((await call('POST', '/events', { json: { deviceId: 'device-12345', events: Array.from({ length: 51 }, () => ev('rec_shown')) } })).status, 400);
});

test('account deletion removes the user and their data', async () => {
  const t = (await call('POST', '/auth/register', { json: { email: 'gone@x.com', password: 'password123' } })).body.token;
  await call('PUT', '/wishlist/chair-sheen', { token: t });
  assert.equal((await call('DELETE', '/me', { token: t })).status, 204);
  assert.equal((await call('GET', '/me', { token: t })).status, 401);
});
