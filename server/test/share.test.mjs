import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, seedProducts } from '../src/db.mjs';
import { createApp } from '../src/app.mjs';

const catalogue = JSON.parse(fs.readFileSync('../src/data/catalogue.json', 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ht-share-'));
const PW = 'Correct-Horse-91';
let server, base, db, tokA, tokB, idA;

const call = async (method, url, { token, json, body } = {}) => {
  const res = await fetch(base + url, { method, headers: { ...(token && { authorization: `Bearer ${token}` }), ...(json && { 'content-type': 'application/json' }) }, body: json ? JSON.stringify(json) : body });
  const text = await res.text();
  let b = null; try { b = text ? JSON.parse(text) : null; } catch { b = text; }
  return { status: res.status, body: b, headers: res.headers };
};
const sofa = catalogue.find((p) => p.role === 'sofa' && !p.sizeReview && p.retailerUrl);
const bed = catalogue.find((p) => p.role === 'bed' && !p.sizeReview);
const item = (p, x, z, rot = 0) => ({ productId: p.id, offset: [x, 0, z], rotationY: rot, scale: 1 });

before(async () => {
  db = await openDb(); await seedProducts(db, catalogue);
  const app = createApp({
    db, jwtSecret: 'test-secret-1234567', uploadDir: path.join(tmp, 'uploads'), publicUrl: 'http://api.test', authLimit: 3000, mail: { send: async () => {} },
    share: { domain: 'share.test', appleTeamId: 'TEAM123456', iosBundleId: 'in.hometown.roomdesigner', androidPackage: 'in.hometown.roomdesigner', androidCerts: ['AA:BB'], playStoreUrl: 'https://play.example/app' },
  });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}`;
  const a = (await call('POST', '/v1/auth/register', { json: { email: 'a@x.com', password: PW, name: 'Secret Name' } })).body;
  tokA = a.accessToken; idA = a.user.id;
  tokB = (await call('POST', '/v1/auth/register', { json: { email: 'b@x.com', password: PW } })).body.accessToken;
});
after(() => server.close());

test('share: create is idempotent, owner only, link uses the share domain; revoke -> 404 everywhere', async () => {
  const d = (await call('POST', '/v1/designs', { token: tokA, json: { name: 'My <b>living</b> room', roomType: 'Living room', items: [item(sofa, 0, 0), item(bed, 2, 0, 90)] } })).body;
  assert.equal((await call('POST', `/v1/designs/${d.id}/share`)).status, 401);
  assert.equal((await call('POST', `/v1/designs/${d.id}/share`, { token: tokB })).status, 404, 'not the owner');
  const s1 = await call('POST', `/v1/designs/${d.id}/share`, { token: tokA });
  assert.equal(s1.status, 201);
  assert.match(s1.body.slug, /^[a-z2-9]{10}$/);
  assert.equal(s1.body.url, `https://share.test/d/${s1.body.slug}`);
  const s2 = await call('POST', `/v1/designs/${d.id}/share`, { token: tokA });
  assert.equal(s2.status, 200);
  assert.equal(s2.body.slug, s1.body.slug, 'same link every time');
  assert.equal((await call('GET', `/v1/designs/${d.id}`, { token: tokA })).body.shareSlug, s1.body.slug);

  // public JSON: no account details
  const j = await call('GET', `/v1/shared/${s1.body.slug}`);
  assert.equal(j.status, 200);
  assert.equal(j.body.items.length, 2);
  assert.ok(j.body.products.some((p) => p.id === sofa.id));
  assert.ok(!JSON.stringify(j.body).includes('Secret Name') && !JSON.stringify(j.body).includes('a@x.com'));

  assert.equal((await call('DELETE', `/v1/designs/${d.id}/share`, { token: tokB })).status, 404);
  assert.equal((await call('DELETE', `/v1/designs/${d.id}/share`, { token: tokA })).status, 204);
  assert.equal((await call('GET', `/v1/shared/${s1.body.slug}`)).status, 404);
  assert.equal((await call('GET', `/d/${s1.body.slug}`)).status, 404);
  // sharing again after revoke makes a NEW slug
  const s3 = await call('POST', `/v1/designs/${d.id}/share`, { token: tokA });
  assert.notEqual(s3.body.slug, s1.body.slug);
});

test('share page: renders without auth, escapes HTML, has plan SVG, OG tags, product links with UTM, no personal data', async () => {
  const d = (await call('POST', '/v1/designs', { token: tokA, json: { name: '<script>alert(1)</script> Den', items: [item(sofa, 0, 0), item(sofa, 0, 1.2), item(bed, 2.5, 0, 90)] } })).body;
  const { slug } = (await call('POST', `/v1/designs/${d.id}/share`, { token: tokA })).body;
  const res = await fetch(`${base}/d/${slug}`); // no Authorization header
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
  const html = await res.text();
  assert.ok(!html.includes('<script>alert(1)'), 'name is escaped');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; Den'));
  assert.ok(html.includes('<svg') && html.includes('rotate('), 'plan drawn');
  assert.match(html, /property="og:title" content="&lt;script&gt;/);
  assert.match(html, new RegExp(`property="og:url" content="https://share.test/d/${slug}"`));
  assert.ok(html.includes(sofa.name.replace(/&/g, '&amp;')) && html.includes('× 2'), 'products listed with counts');
  assert.match(html, /utm_source=hometown-ar&amp;utm_medium=web&amp;utm_campaign=share-page/);
  assert.ok(html.includes(`hometownar://d/${slug}`), 'open in app link');
  assert.ok(html.includes('https://play.example/app'));
  assert.ok(!html.includes('Secret Name') && !html.includes('a@x.com'));
  assert.ok(!/<script/i.test(html), 'page has no scripts');
});

test('thumbnails: signed link in the user folder, upload, attach, shows on page (og:image)', async () => {
  assert.equal((await call('POST', '/v1/thumbnails/upload-url', { json: { clientId: 'abcdefgh1' } })).status, 401);
  assert.equal((await call('POST', '/v1/thumbnails/upload-url', { token: tokA, json: { clientId: '../../etc' } })).status, 400);
  const up = (await call('POST', '/v1/thumbnails/upload-url', { token: tokA, json: { clientId: 'dthumb12345' } })).body;
  assert.match(up.key, new RegExp(`^thumbnails/${idA}/dthumb12345-[a-z0-9]+\\.jpg$`));
  const put = await fetch(up.uploadUrl.replace('http://api.test', base), { method: 'PUT', body: Buffer.from('fake-jpeg-bytes'), headers: { 'content-type': 'image/jpeg' } });
  assert.equal(put.status, 201);
  const d = (await call('POST', '/v1/designs', { token: tokA, json: { clientId: 'dthumb12345', items: [item(sofa, 0, 0)], thumbnailKey: up.key } })).body;
  assert.equal(d.thumbnailUrl, `http://api.test/files/${up.key}`);
  const { slug } = (await call('POST', `/v1/designs/${d.id}/share`, { token: tokA })).body;
  const html = await (await fetch(`${base}/d/${slug}`)).text();
  assert.ok(html.includes(`property="og:image" content="http://api.test/files/${up.key}"`));
  // someone else cannot attach a thumbnail from another user's folder
  assert.equal((await call('POST', '/v1/designs', { token: tokB, json: { items: [item(sofa, 0, 0)], thumbnailKey: up.key } })).status, 400);
  // too large
  const big = (await call('POST', '/v1/thumbnails/upload-url', { token: tokA, json: { clientId: 'dthumb99999' } })).body;
  assert.equal((await fetch(big.uploadUrl.replace('http://api.test', base), { method: 'PUT', body: Buffer.alloc(3 * 1024 * 1024) })).status, 413);
});

test('designs: creating twice with the same clientId returns the first one', async () => {
  const body = { clientId: 'clientid-0001', name: 'Once', items: [item(sofa, 0, 0)] };
  const a = await call('POST', '/v1/designs', { token: tokA, json: body });
  const b = await call('POST', '/v1/designs', { token: tokA, json: body });
  assert.equal(a.status, 201); assert.equal(b.status, 200);
  assert.equal(a.body.id, b.body.id);
  assert.equal(b.body.clientId, 'clientid-0001');
  // another user can use the same clientId for their own design
  assert.equal((await call('POST', '/v1/designs', { token: tokB, json: body })).status, 201);
  // after deleting, the id can be reused
  await call('DELETE', `/v1/designs/${a.body.id}`, { token: tokA });
  assert.equal((await call('POST', '/v1/designs', { token: tokA, json: body })).status, 201);
});

test('app links: well-known files come from the environment', async () => {
  const aasa = await call('GET', '/.well-known/apple-app-site-association');
  assert.equal(aasa.status, 200);
  assert.deepEqual(aasa.body.applinks.details[0].appIDs, ['TEAM123456.in.hometown.roomdesigner']);
  assert.deepEqual(aasa.body.applinks.details[0].components.map((c) => c['/']), ['/d/*', '/item/*']);
  const links = await call('GET', '/.well-known/assetlinks.json');
  assert.equal(links.body[0].target.package_name, 'in.hometown.roomdesigner');
  assert.deepEqual(links.body[0].target.sha256_cert_fingerprints, ['AA:BB']);
});
