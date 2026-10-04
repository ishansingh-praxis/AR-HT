import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, seedProducts, seedRooms, currentVersion } from '../src/db.mjs';
import { createApp } from '../src/app.mjs';

const catalogue = JSON.parse(fs.readFileSync('../src/data/catalogue.json', 'utf8'));
const rooms = JSON.parse(fs.readFileSync('../src/data/rooms.json', 'utf8'));
const glb = fs.readFileSync(path.resolve('../models/raw/_example-GlamVelvetSofa.glb')); // 219 x 102 x 79 cm
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ht-admin-'));
const PW = 'Correct-Horse-91';
let server, base, db, admin, editor, user;

const call = async (method, url, { token, json, body } = {}) => {
  const res = await fetch(base + url, { method, headers: { ...(token && { authorization: `Bearer ${token}` }), ...(json && { 'content-type': 'application/json' }) }, body: json ? JSON.stringify(json) : body });
  const text = await res.text();
  let b = null; try { b = text ? JSON.parse(text) : null; } catch { b = text; }
  return { status: res.status, body: b };
};
const form = (name, content, filename) => { const f = new FormData(); f.set(name, new Blob([content]), filename); return f; };
const productForm = (p) => { const f = new FormData(); f.set('product', JSON.stringify(p)); return f; };
const putModel = async (productId, tok = editor) => {
  const up = (await call('POST', `/v1/admin/models/${productId}/upload-url`, { token: tok })).body;
  assert.equal((await fetch(up.uploadUrl.replace('http://api.test', base), { method: 'PUT', body: glb })).status, 201);
  return up;
};

before(async () => {
  db = openDb(); seedProducts(db, catalogue); seedRooms(db, rooms);
  const app = createApp({ db, jwtSecret: 'test-secret-1234567', uploadDir: path.join(tmp, 'u'), publicUrl: 'http://api.test', authLimit: 3000, mail: { send: async () => {} } });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}`;
  const mk = async (email, role) => { const s = (await call('POST', '/v1/auth/register', { json: { email, password: PW } })).body; if (role !== 'user') db.prepare('UPDATE users SET role=? WHERE email=?').run(role, email); return s.accessToken; };
  admin = await mk('admin@x.com', 'admin'); editor = await mk('editor@x.com', 'editor'); user = await mk('user@x.com', 'user');
  // a product whose listed size matches the example GLB, for model tests
  await call('POST', '/v1/admin/products', { token: editor, body: productForm({ id: 'sofa-rev', name: 'Review Sofa', category: 'Sofa', role: 'sofa', dimensionsCm: { w: 219, d: 102, h: 79 } }) });
});
after(() => server.close());

test('every editor tool needs the editor role', async () => {
  for (const [m, u] of [['GET', '/v1/admin/models-queue'], ['GET', '/v1/admin/stats'], ['GET', '/v1/admin/rooms'], ['POST', '/v1/admin/products/sofa-rev/size-checked']]) {
    assert.equal((await call(m, u)).status, 401, `${u} without token`);
    assert.equal((await call(m, u, { token: user })).status, 403, `${u} as a plain user`);
    assert.notEqual((await call(m, u, { token: editor })).status, 403, `${u} as editor`);
  }
});

test('size-checked clears sizeReview, marks confidence high and is audited', async () => {
  const flagged = catalogue.find((p) => p.sizeReview);
  assert.ok(flagged, 'catalogue has a flagged product');
  const r = await call('POST', `/v1/admin/products/${flagged.id}/size-checked`, { token: editor });
  assert.equal(r.status, 200);
  assert.equal(r.body.product.sizeReview, undefined);
  assert.equal(r.body.product.dimsConfidence, 'high');
  assert.equal((await call('GET', `/v1/products/${flagged.id}`)).body.sizeReview, undefined);
  assert.ok((await call('GET', '/v1/admin/audit', { token: admin })).body.some((x) => x.action === 'product.size-checked' && x.target === flagged.id));
  assert.equal((await call('POST', '/v1/admin/products/nope/size-checked', { token: editor })).status, 404);
});

const CSV = [
  'Handle,Title,Status,Vendor,category (product.metafields.custom.category),segment,product_length,product_width,product_depth,product_height,Image Src,Image Position,Variant Price,Variant SKU,Color Family,main_material,family_name',
  'import-sofa,Import 3 Seater Sofa | Fabric,active,HomeTown,Living Room Furniture,3 Seater Sofas,2100 MM,900 MM,,850 MM,https://cdn.test/a1.jpg,1,29999,SKU-A,Grey,Fabric,Import',
].join('\n');

test('import: preview shows the diff, publish applies it, a missing product is only removed on request', async () => {
  assert.equal((await call('POST', '/v1/admin/import', { token: editor, body: form('file', 'not,a,shopify\n1,2,3', 'x.csv') })).status, 422);
  const v0 = currentVersion(db);
  const pre = await call('POST', '/v1/admin/import', { token: editor, body: form('file', CSV, 'export.csv') });
  assert.equal(pre.status, 201);
  assert.deepEqual(pre.body.diff.added, ['import-sofa']);
  assert.equal(pre.body.diff.counts.removed > 100, true, 'everything else is "missing" from this tiny file');
  assert.equal((await call('GET', '/v1/products/import-sofa')).status, 404, 'nothing changes before publish');
  assert.equal(currentVersion(db), v0);

  const pub = await call('POST', `/v1/admin/import/${pre.body.id}/publish`, { token: editor, json: {} });
  assert.equal(pub.status, 200);
  assert.equal(pub.body.removed, 0, 'missing products stay unless removeMissing is true');
  assert.equal((await call('GET', '/v1/products/import-sofa')).status, 200);
  assert.ok(currentVersion(db) > v0, 'catalogue version bumped');
  assert.equal((await call('GET', '/v1/products?limit=100')).body.total, catalogue.length + 2, 'import-sofa and sofa-rev added, nothing removed');
  assert.equal((await call('POST', `/v1/admin/import/${pre.body.id}/publish`, { token: editor, json: {} })).status, 404, 'a job publishes once');
  const delta = (await call('GET', `/v1/catalogue?since=${v0}`)).body;
  assert.ok(delta.products.some((p) => p.id === 'import-sofa'));

});

test('model review: submit waits, reject needs a reason, approve publishes and bumps the version, once', async () => {
  const q0 = (await call('GET', '/v1/admin/models-queue', { token: editor })).body;
  assert.ok(q0.needsModel.some((p) => p.id === 'sofa-rev'), 'sofa-rev has no model yet');

  const up1 = await putModel('sofa-rev');
  const sub = await call('POST', '/v1/admin/models/sofa-rev/validate', { token: editor, json: { key: up1.key, review: true } });
  assert.equal(sub.status, 202);
  assert.equal(sub.body.status, 'pending');
  assert.ok(sub.body.validation.triangles > 0 && Array.isArray(sub.body.validation.textures) && sub.body.validation.fileMb > 0, 'report has triangles, textures, MB');
  assert.equal((await call('GET', '/v1/products/sofa-rev')).body.model3D, undefined, 'not published while pending');
  const q1 = (await call('GET', '/v1/admin/models-queue', { token: editor })).body;
  assert.equal(q1.pending.length, 1);
  assert.ok(!q1.needsModel.some((p) => p.id === 'sofa-rev'), 'no longer "needs model"');
  assert.ok(q1.pending[0].product.images !== undefined);

  assert.equal((await call('POST', `/v1/admin/models/sofa-rev/${up1.version}/reject`, { token: editor, json: { reason: 'x' } })).status, 400, 'reason too short');
  assert.equal((await call('POST', `/v1/admin/models/sofa-rev/${up1.version}/reject`, { token: editor, json: { reason: 'Legs are floating' } })).status, 200);
  assert.equal((await call('GET', '/v1/admin/models-queue', { token: editor })).body.rejected[0].report.rejectedReason, 'Legs are floating');
  assert.equal((await call('POST', `/v1/admin/models/sofa-rev/${up1.version}/approve`, { token: editor })).status, 409, 'cannot approve a rejected model');

  const up2 = await putModel('sofa-rev');
  assert.equal(up2.version, up1.version + 1);
  await call('POST', '/v1/admin/models/sofa-rev/validate', { token: editor, json: { key: up2.key, review: true } });
  const v = currentVersion(db);
  const ok = await call('POST', `/v1/admin/models/sofa-rev/${up2.version}/approve`, { token: editor });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.product.modelStatus, 'ready');
  assert.match(ok.body.product.model3D.url, /sofa-rev-v2\.glb$/);
  assert.ok(currentVersion(db) > v);
  assert.equal((await call('POST', `/v1/admin/models/sofa-rev/${up2.version}/approve`, { token: editor })).status, 409, 'only once');
  const log = (await call('GET', '/v1/admin/audit', { token: admin })).body.map((x) => x.action);
  for (const a of ['model.submit', 'model.reject', 'model.approve']) assert.ok(log.includes(a), a);
});

test('rooms: a bad room is refused with plain-English problems; a good one is saved, listed and deleted', async () => {
  const good = { ...rooms[0], id: 'editor-room-1', title: 'Editor room' };
  delete good.style; good.style = ['modern'];
  const bad = { ...good, pieces: good.pieces.map((p, i) => (i === 0 ? { ...p, x: -400 } : p)) };
  const check = await call('POST', '/v1/admin/rooms/check', { token: editor, json: bad });
  assert.equal(check.status, 200);
  assert.ok(check.body.problems.some((m) => /sticks out/.test(m)));
  const refused = await call('PUT', '/v1/admin/rooms/editor-room-1', { token: editor, json: bad });
  assert.equal(refused.status, 422);
  assert.ok(refused.body.problems.length > 0);
  assert.equal((await call('GET', '/v1/rooms')).body.some((r) => r.id === 'editor-room-1'), false);

  assert.equal((await call('PUT', '/v1/admin/rooms/other-id', { token: editor, json: good })).status, 400, 'id must match the URL');
  const saved = await call('PUT', '/v1/admin/rooms/editor-room-1', { token: editor, json: good });
  assert.equal(saved.status, 201);
  assert.equal((await call('GET', '/v1/rooms')).body.at(-1).id, 'editor-room-1');
  assert.equal((await call('PUT', '/v1/admin/rooms/editor-room-1', { token: editor, json: { ...good, title: 'Renamed' } })).status, 200);
  assert.equal((await call('GET', '/v1/rooms')).body.find((r) => r.id === 'editor-room-1').title, 'Renamed');
  assert.equal((await call('DELETE', '/v1/admin/rooms/editor-room-1', { token: editor })).status, 204);
  assert.equal((await call('DELETE', '/v1/admin/rooms/editor-room-1', { token: editor })).status, 404);
  // the original rooms all pass the same checks the editor uses
  for (const r of rooms) assert.deepEqual((await call('POST', '/v1/admin/rooms/check', { token: editor, json: r })).body.problems, [], r.id);
});

test('stats: totals, rates, daily series and top products from anonymous events', async () => {
  const now = Date.now(), ins = db.prepare('INSERT INTO events(device_id,name,ts,props) VALUES(?,?,?,?)');
  const ev = (dev, name, ago, props = {}) => ins.run(dev, name, now - ago, JSON.stringify(props));
  const H = 3600 * 1000;
  ev('dev-aaaa1111', 'ar_opened', H); ev('dev-aaaa1111', 'room_scanned', H); ev('dev-aaaa1111', 'piece_placed', H, { id: 'sofa-leather' });
  ev('dev-aaaa1111', 'rec_shown', H); ev('dev-bbbb2222', 'ar_opened', 2 * H); ev('dev-bbbb2222', 'piece_placed', 2 * H, { id: 'sofa-leather' });
  ev('dev-bbbb2222', 'piece_placed', 2 * H, { id: 'sofa-velvet' }); ev('dev-bbbb2222', 'rec_shown', 2 * H); ev('dev-bbbb2222', 'rec_placed', 2 * H, { id: 'sofa-velvet' });
  ev('dev-old', 'ar_opened', 90 * 24 * H);
  const s = (await call('GET', '/v1/admin/stats', { token: editor })).body;
  assert.equal(s.totals.devices, 2);
  assert.equal(s.totals.arSessions, 2);
  assert.equal(s.totals.scans, 1);
  assert.equal(s.totals.scanSuccessRate, 0.5);
  assert.equal(s.totals.placements, 3);
  assert.equal(s.totals.recPlacedRate, 0.5);
  assert.equal(s.topProducts[0].id, 'sofa-leather');
  assert.equal(s.topProducts[0].count, 2);
  assert.ok(s.topProducts[0].name.length > 3, 'name resolved');
  assert.ok(s.daily.length >= 1 && s.daily.reduce((n, d) => n + d.arSessions, 0) === 2);
  const wide = await call('GET', `/v1/admin/stats?from=0&to=${now}`, { token: editor });
  assert.equal(wide.status, 400, 'range capped');
  assert.equal((await call('GET', `/v1/admin/stats?from=${now - 100 * 24 * H}&to=${now}`, { token: editor })).body.totals.arSessions, 3);
});

// Last on purpose: removing "missing" products would break the tests above that need the catalogue.
test('import: removeMissing deletes products that are not in the file, except ones that carry a 3D model', async () => {
  const pre = await call('POST', '/v1/admin/import', { token: editor, body: form('file', CSV, 'export.csv') });
  assert.deepEqual(pre.body.diff.added, [], 'import-sofa was published earlier');
  const pub = await call('POST', `/v1/admin/import/${pre.body.id}/publish`, { token: editor, json: { removeMissing: true } });
  assert.ok(pub.body.removed > 100);
  assert.equal((await call('GET', '/v1/products/sofa-leather')).status, 200, 'products with a 3D model are never removed by an import');
  assert.equal((await call('GET', '/v1/products/import-sofa')).status, 200);
  assert.equal((await call('GET', '/v1/products/sofa-velvet')).status, 200, 'demo models stay');
  const gone = catalogue.find((p) => !p.model3D);
  assert.equal((await call('GET', `/v1/products/${gone.id}`)).status, 404);
  const delta = (await call('GET', '/v1/catalogue?since=1')).body;
  assert.ok(delta.removed.includes(gone.id), 'apps learn about removals through the delta');
});

test('dashboard: /admin serves the built app (or a clear message) with a CSP that allows its own scripts only', async () => {
  const built = fs.existsSync(new URL('../../admin/dist/index.html', import.meta.url));
  for (const url of ['/admin', '/admin/', '/admin/products/sofa-leather']) {
    const res = await fetch(base + url);
    assert.equal(res.status, built ? 200 : 503, url);
    assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
    if (built) assert.match(await res.text(), /<div id="root">/);
  }
  assert.equal((await fetch(base + '/admin/assets/does-not-exist.js')).status, built ? 200 : 503, 'unknown paths fall back to the app shell (client-side routing)');
});
