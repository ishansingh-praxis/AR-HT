import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { meshy, photoFor, pickProducts, waitForModel } from './lib/image3d.mjs';
import { normalise } from './publish-models.mjs';

// ---- a fake Meshy ----
function fakeMeshy({ finishAfter = 2, fail = false, noGlb = false } = {}) {
  const log = []; let polls = 0;
  const fetchImpl = async (url, init = {}) => {
    log.push(`${init.method ?? 'GET'} ${url.replace('https://api.meshy.ai', '')}`);
    assert.equal(init.headers.authorization, 'Bearer key-123', 'sends the API key');
    const reply = (status, body) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
    if (init.method === 'POST') { const b = JSON.parse(init.body); assert.match(b.image_url, /^https:\/\//); assert.equal(b.enable_pbr, true); return reply(200, { result: 'task-1' }); }
    polls++;
    if (polls < finishAfter) return reply(200, { status: 'IN_PROGRESS', progress: polls * 40 });
    if (fail) return reply(200, { status: 'FAILED', task_error: { message: 'bad image' } });
    return reply(200, { status: 'SUCCEEDED', model_urls: noGlb ? {} : { glb: 'https://cdn.meshy.ai/x.glb' } });
  };
  return { fetchImpl, log };
}
const noWait = async () => {};

{ // happy path: create, poll twice, get the GLB link
  const f = fakeMeshy({ finishAfter: 3 });
  const m = meshy({ apiKey: 'key-123', fetchImpl: f.fetchImpl });
  const id = await m.create('https://cdn.shopify.com/a.jpg');
  assert.equal(id, 'task-1');
  const seen = [];
  const url = await waitForModel(m, id, { wait: noWait, onProgress: (s) => seen.push(s.status) });
  assert.equal(url, 'https://cdn.meshy.ai/x.glb');
  assert.deepEqual(seen, ['running', 'running', 'done']);
  assert.deepEqual(f.log, ['POST /openapi/v1/image-to-3d', 'GET /openapi/v1/image-to-3d/task-1', 'GET /openapi/v1/image-to-3d/task-1', 'GET /openapi/v1/image-to-3d/task-1']);
}
{ // failures are explained
  const m = meshy({ apiKey: 'key-123', fetchImpl: fakeMeshy({ finishAfter: 1, fail: true }).fetchImpl });
  await assert.rejects(() => waitForModel(m, 't', { wait: noWait }), /Generation failed: bad image/);
  const m2 = meshy({ apiKey: 'key-123', fetchImpl: fakeMeshy({ finishAfter: 1, noGlb: true }).fetchImpl });
  await assert.rejects(() => waitForModel(m2, 't', { wait: noWait }), /no GLB link/);
}
{ // HTTP errors carry the status and message; a stuck task times out with a resume hint
  const bad = meshy({ apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 401, text: async () => JSON.stringify({ message: 'invalid key' }) }) });
  await assert.rejects(() => bad.create('https://x/y.jpg'), (e) => e.status === 401 && /invalid key/.test(e.message));
  const stuck = { status: async () => ({ status: 'running' }) };
  await assert.rejects(() => waitForModel(stuck, 't', { wait: async () => { await new Promise((r) => setTimeout(r, 5)); }, pollMs: 1, timeoutMs: 20 }), /Timed out.*resume/);
}

// ---- which products first ----
const prod = (id, role, extra = {}) => ({ id, name: id, role, category: 'Sofa', images: [`https://cdn.shopify.com/${id}.jpg`], dimensionsCm: { w: 100, d: 50, h: 80 }, ...extra });
const cat = [prod('chair-1', 'chair'), prod('bed-1', 'bed'), prod('sofa-1', 'sofa'), prod('sofa-room', 'sofa'), prod('sofa-has-model', 'sofa', { model3D: {} }), prod('sofa-review', 'sofa', { sizeReview: 'x' }),
  prod('demo', 'sofa', { demo: true }), prod('art', 'wall-art', { category: 'Wall' }), prod('no-photo', 'sofa', { images: [] }), prod('bed-room', 'bed')];
const rooms = [{ pieces: [{ productId: 'sofa-room' }, { productId: 'bed-room' }, { productId: 'sofa-room' }] }];
assert.deepEqual(pickProducts(cat, rooms, 10).map((p) => p.id), ['sofa-room', 'bed-room', 'sofa-1', 'bed-1', 'chair-1'], 'sample-room products first (most used first), then sofas, beds, chairs; skips modelled, flagged, demo, wall, photo-less');
assert.deepEqual(pickProducts(cat, rooms, 2).map((p) => p.id), ['sofa-room', 'bed-room']);
assert.deepEqual(pickProducts(cat, rooms, 10, new Set(['sofa-room'])).map((p) => p.id).slice(0, 2), ['bed-room', 'sofa-1'], 'already requested products are skipped');
assert.equal(photoFor(prod('a', 'sofa')), 'https://cdn.shopify.com/a.jpg?width=1024'.replace('/a.jpg?', '/a.jpg?'), 'asks the CDN for 1024 px');
assert.equal(photoFor({ images: ['https://x.com/a.jpg?v=3'] }), 'https://x.com/a.jpg?v=3');

// ---- a generated model, wrong size and facing, is scaled and turned into our conventions ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'i3d-'));
const sample = path.resolve('models/raw/_example-GlamVelvetSofa.glb'); // 219 x 102 x 79 cm
const ok = await normalise(sample, path.join(tmp, 'a.glb'), { w: 219, d: 102, h: 79 });
assert.equal(ok.issues.length, 0, 'matching size: OK');
const wrong = await normalise(sample, path.join(tmp, 'b.glb'), { w: 150, d: 102, h: 79 });
assert.ok(wrong.issues.some((m) => /width/.test(m)), 'a model whose proportions do not match is sent to REVIEW');
const turned = await normalise(sample, path.join(tmp, 'c.glb'), { w: 102, d: 219, h: 79 }, 90);
assert.equal(turned.issues.length, 0, 'facing sideways is fixed with a 90 degree turn');
assert.ok(Math.abs(turned.w - 103) < 2 && Math.abs(turned.d - 220) < 2);

console.log('image-to-3D tests passed');

// ---- upright orientation of generated models ----
{
  const { pickOrientation, fitToDims } = await import('./lib/orient.mjs');
  // A sofa 160 x 81 x 80 that came out lying on its side: its long axis is the model's Y, the 81 cm depth is X, the 80 cm height is Z.
  const o = pickOrientation([81, 160, 80], [0, 0, -0.1], { w: 160, d: 81, h: 80 });
  assert.ok(Math.abs(o.size.w - 160) < 1 && Math.abs(o.size.h - 80) < 1 && Math.abs(o.size.d - 81) < 1, 'width, height and depth are matched to the right axes');
  const q = o.quat; assert.ok(Math.abs(q[0] ** 2 + q[1] ** 2 + q[2] ** 2 + q[3] ** 2 - 1) < 1e-9, 'the rotation is a unit quaternion');
  // upside down: the average vertex is in the upper half along the chosen up axis
  const flipped = pickOrientation([160, 80, 81], [0, 0.3, 0], { w: 160, d: 81, h: 80 });
  assert.equal(flipped.matrix[1][1], -1, 'an upside-down model is turned over');
  const upright = pickOrientation([160, 80, 81], [0, -0.1, 0], { w: 160, d: 81, h: 80 });
  assert.equal(upright.matrix[1][1], 1);
  // fitting: a perfect shape needs no stretch, a squashed one reports how much
  assert.ok(fitToDims({ w: 1.6, h: 0.8, d: 0.81 }, { w: 160, d: 81, h: 80 }).worst < 1.01);
  assert.ok(fitToDims({ w: 1.6, h: 0.8, d: 0.2 }, { w: 160, d: 81, h: 80 }).worst > 1.5);
  console.log('orientation tests passed');
}
