import assert from 'node:assert/strict';
import { createEvents, QUEUE_CAP, BATCH_SIZE, type QueuedEvent, type KeyValue } from '../src/sync/events.ts';
import { areaOf, PRESET_AREA } from '../src/utils/area.ts';
import { toggleWish, isSaved, migrateWishlist } from '../src/utils/wishlist.ts';
import { willItFit } from '../src/utils/fit.ts';

const memory = (): KeyValue & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, get: async (k) => data.get(k) ?? null, set: async (k, v) => { data.set(k, v); } };
};

// ---- events: cap ----
{
  const store = memory();
  const ev = createEvents({ storage: store, enabled: () => true, now: () => 1 });
  for (let i = 0; i < QUEUE_CAP + 25; i++) await ev.track('piece_placed', { n: i });
  assert.equal(await ev.size(), QUEUE_CAP);
  const q: QueuedEvent[] = JSON.parse(store.data.get('events:queue')!);
  assert.equal(q[0].props.n, 25, 'oldest events are dropped');
}
// ---- events: batches of 50, one device id ----
{
  const store = memory();
  const sent: { deviceId: string; n: number }[] = [];
  const ev = createEvents({ storage: store, enabled: () => true, send: async (p) => { sent.push({ deviceId: p.deviceId, n: p.events.length }); return true; }, random: () => 'dev-1' });
  for (let i = 0; i < 120; i++) await ev.track('item_viewed', { id: `p${i}` });
  assert.equal(await ev.flush(), 120);
  assert.deepEqual(sent.map((s) => s.n), [BATCH_SIZE, BATCH_SIZE, 20]);
  assert.ok(sent.every((s) => s.deviceId === 'dev-1'));
  assert.equal(await ev.size(), 0);
}
// ---- events: a failed batch keeps the queue ----
{
  const store = memory();
  let calls = 0;
  const ev = createEvents({ storage: store, enabled: () => true, send: async () => { calls++; return calls > 1; } });
  for (let i = 0; i < 60; i++) await ev.track('ar_opened');
  assert.equal(await ev.flush(), 0, 'first batch rejected: nothing sent');
  assert.equal(await ev.size(), 60);
  assert.equal(await ev.flush(), 60, 'retried later');
  const throwing = createEvents({ storage: memory(), enabled: () => true, send: async () => { throw new Error('offline'); } });
  await throwing.track('ar_opened');
  assert.equal(await throwing.flush(), 0);
  assert.equal(await throwing.size(), 1);
}
// ---- events: opt-out ----
{
  let on = true;
  const ev = createEvents({ storage: memory(), enabled: () => on, send: async () => true });
  await ev.track('ar_opened');
  assert.equal(await ev.size(), 1);
  on = false;
  await ev.track('ar_opened');
  assert.equal(await ev.size(), 1, 'tracking stops');
  assert.equal(await ev.flush(), 0, 'nothing is sent');
  await ev.clear();
  assert.equal(await ev.size(), 0, 'queue is cleared');
}
// ---- events: no server configured keeps events queued ----
{
  const ev = createEvents({ storage: memory(), enabled: () => true });
  await ev.track('ar_opened');
  assert.equal(await ev.flush(), 0);
  assert.equal(await ev.size(), 1);
}

// ---- wishlist ----
{
  let l = toggleWish([], 'a', 1);
  l = toggleWish(l, 'b', 2);
  assert.deepEqual(l.map((w) => w.id), ['b', 'a'], 'newest first');
  assert.ok(isSaved(l, 'a'));
  l = toggleWish(l, 'a', 3);
  assert.deepEqual(l.map((w) => w.id), ['b']);
  assert.deepEqual(migrateWishlist(['x', 'y']).map((w) => w.id), ['y', 'x']);
  assert.deepEqual(migrateWishlist(undefined), []);
  assert.deepEqual(migrateWishlist([{ id: 'z', addedAt: 5 }]), [{ id: 'z', addedAt: 5 }]);
}

// ---- areaOf ----
assert.equal(areaOf({ scanned: null, preset: 'medium' }), PRESET_AREA.medium);
assert.equal(areaOf({ scanned: { areaM2: 11.5 }, preset: 'small' }), 11.5, 'a scan wins over the preset');
assert.equal(areaOf({ scanned: null, preset: 'unknown' }), undefined);

// ---- will it fit ----
{
  const sofa = { widthCm: 200, depthCm: 90 };
  assert.equal(willItFit(sofa, { freeWidthCm: 300 }).fit?.status, 'fits');
  assert.equal(willItFit(sofa, { freeWidthCm: 230 }).fit?.status, 'tight');
  assert.match(willItFit(sofa, { freeWidthCm: 180 }).message, /Too wide by 20 cm/);
  assert.equal(willItFit(sofa, {}).fit, null);
  const scanned = willItFit(sofa, { scanLongestWallCm: 450 });
  assert.equal(scanned.prefillCm, 450);
  assert.match(scanned.message, /Fits along your longest wall \(4\.5 m\)/);
  assert.match(willItFit(sofa, { scanLongestWallCm: 450, freeWidthCm: 150 }).message, /Too wide/, 'typed width overrides the prefill');
  const a = willItFit(sofa, { areaM2: 16, usedM2: 4 });
  assert.equal(a.freeFloorM2, 12);
  assert.equal(a.footprintM2, 1.8);
}
console.log('step 07 logic tests passed');
