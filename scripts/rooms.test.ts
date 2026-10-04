import assert from 'node:assert/strict';
import fs from 'node:fs';
import { collidingUids, footprint, rotateLayout } from '../src/utils/geometry.ts';
import type { PlacedItem, Product, SampleRoom } from '../src/types/furniture.ts';

type Room = SampleRoom & { door?: { wall: 'top' | 'bottom' | 'left' | 'right'; at: number } };
const catalogue: Product[] = JSON.parse(fs.readFileSync('src/data/catalogue.json', 'utf8'));
const rooms: Room[] = JSON.parse(fs.readFileSync('src/data/rooms.json', 'utf8'));
const find = (id: string) => catalogue.find((p) => p.id === id);
const toItems = (r: Pick<SampleRoom, 'pieces'>): PlacedItem[] =>
  r.pieces.map((p, i) => ({ uid: `${i}`, productId: p.productId, position: [p.x / 100, 0, p.z / 100], rotationY: p.rot, scale: 1 }));

assert.ok(rooms.length >= 12, 'at least 12 rooms');
for (const type of ['living', 'bedroom', 'dining', 'study']) assert.ok(rooms.filter((r) => r.roomType === type).length >= 3, `${type}: 3+ rooms`);

type V = [number, number];
function gapCm(a: V[], b: V[]) {
  const segs = (q: V[]) => q.map((p, i) => [p, q[(i + 1) % 4]] as const);
  const dist = (p: V, [s, e]: readonly [V, V]) => {
    const dx = e[0] - s[0], dz = e[1] - s[1], t = Math.max(0, Math.min(1, ((p[0] - s[0]) * dx + (p[1] - s[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(p[0] - (s[0] + t * dx), p[1] - (s[1] + t * dz));
  };
  let m = Infinity;
  for (const p of a) for (const s of segs(b)) m = Math.min(m, dist(p, s));
  for (const p of b) for (const s of segs(a)) m = Math.min(m, dist(p, s));
  return m * 100;
}
const inside = (p: V, q: V[]) => { // point in convex quad
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [a, b] = [q[i], q[(i + 1) % 4]];
    const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (c !== 0) { if (sign && Math.sign(c) !== sign) return false; sign = Math.sign(c); }
  }
  return true;
};
const distToQuad = (p: V, q: V[]) => {
  if (inside(p, q)) return 0;
  let m = Infinity;
  for (let i = 0; i < 4; i++) {
    const s = q[i], e = q[(i + 1) % 4];
    const dx = e[0] - s[0], dz = e[1] - s[1], t = Math.max(0, Math.min(1, ((p[0] - s[0]) * dx + (p[1] - s[1]) * dz) / (dx * dx + dz * dz)));
    m = Math.min(m, Math.hypot(p[0] - (s[0] + t * dx), p[1] - (s[1] + t * dz)));
  }
  return m;
};

for (const r of rooms) {
  const items = toItems(r);
  assert.equal(r.pieces.filter((p) => p.anchor).length, 1, `${r.id}: exactly one anchor piece`);
  for (const [i, p] of r.pieces.entries()) {
    const prod = find(p.productId);
    assert.ok(prod, `${r.id}: unknown product ${p.productId}`);
    assert.ok(!prod.sizeReview && (prod.proxy || prod.model3D), `${r.id}: ${p.productId} must be placeable`);
    for (const [x, z] of footprint(items[i], prod)) {
      assert.ok(x * 100 >= -1 && x * 100 <= r.roomCm.w + 1 && z * 100 >= -1 && z * 100 <= r.roomCm.d + 1,
        `${r.id}: ${p.productId} sticks out of the room at (${(x * 100).toFixed(0)}, ${(z * 100).toFixed(0)})`);
    }
  }
  assert.equal(collidingUids(items, find).size, 0, `${r.id}: pieces overlap`);

  // Gaps between different pieces must be intentional: touching (<=12 cm), table reach (35-50 cm) or a real walkway (>=60 cm).
  const fp = items.map((it) => footprint(it, find(it.productId)!));
  for (let i = 0; i < fp.length; i++) for (let j = i + 1; j < fp.length; j++) {
    if (r.pieces[i].productId === r.pieces[j].productId) continue;
    const g = gapCm(fp[i], fp[j]);
    assert.ok(g <= 12 || (g >= 35 && g <= 50) || g >= 60, `${r.id}: ${r.pieces[i].productId} / ${r.pieces[j].productId} leave an awkward ${g.toFixed(0)} cm gap`);
  }

  // A 60 cm walkway exists from the door to the front of the anchor piece (grid search, 30 cm clearance either side).
  const anchorIdx = r.pieces.findIndex((p) => p.anchor);
  const a = r.pieces[anchorIdx], ap = find(a.productId)!;
  const { w: W, d: D } = r.roomCm;
  const near = { top: a.z, bottom: D - a.z, left: a.x, right: W - a.x };
  const nearest = (Object.keys(near) as (keyof typeof near)[]).sort((x, y) => near[x] - near[y])[0];
  const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[nearest] as 'top' | 'bottom' | 'left' | 'right';
  const door = r.door ?? { wall: opposite, at: opposite === 'top' || opposite === 'bottom' ? W / 2 : D / 2 };
  const start: V = { top: [door.at, 40], bottom: [door.at, D - 40], left: [40, door.at], right: [W - 40, door.at] }[door.wall] as V;
  const rad = (a.rot * Math.PI) / 180, front: V = [a.x + Math.sin(rad) * (ap.dimensionsCm.d / 2 + 50), a.z + Math.cos(rad) * (ap.dimensionsCm.d / 2 + 50)];
  const STEP = 10, CLEAR = 30;
  const free = (x: number, z: number) => x >= 0 && z >= 0 && x <= W && z <= D && fp.every((q) => distToQuad([x / 100, z / 100], q) * 100 >= CLEAR);
  const key = (x: number, z: number) => `${x},${z}`;
  const seen = new Set([key(start[0], start[1])]);
  const queue: V[] = [start];
  assert.ok(free(start[0], start[1]), `${r.id}: the door area is blocked`);
  let reached = false;
  while (queue.length) {
    const [x, z] = queue.shift()!;
    if (Math.hypot(x - front[0], z - front[1]) <= 100) { reached = true; break; }
    for (const [dx, dz] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
      const nx = x + dx, nz = z + dz;
      if (!seen.has(key(nx, nz)) && free(nx, nz)) { seen.add(key(nx, nz)); queue.push([nx, nz]); }
    }
  }
  assert.ok(reached, `${r.id}: no 60 cm walkway from the door to the anchor`);
}

// the shared checker (used live by the admin room editor) agrees: every curated room is clean, and obvious breakage is caught
{
  const { checkRoom } = await import('../shared/room-checks.mjs');
  for (const r of rooms) assert.deepEqual(checkRoom(r, find as never).problems, [], `${r.id}: shared checker`);
  const r0 = rooms[0];
  const noAnchor = { ...r0, pieces: r0.pieces.map((p) => ({ ...p, anchor: false })) };
  assert.ok(checkRoom(noAnchor, find as never).problems.some((m: string) => /anchor/.test(m)));
  const moved = { ...r0, pieces: r0.pieces.map((p, i) => (i === 0 ? { ...p, x: -500 } : p)) };
  assert.ok(checkRoom(moved, find as never).problems.some((m: string) => /sticks out/.test(m)));
  const stacked = { ...r0, pieces: [...r0.pieces, { ...r0.pieces[0], anchor: false }] };
  assert.ok(checkRoom(stacked, find as never).problems.some((m: string) => /overlaps/.test(m)));
  assert.ok(checkRoom({ ...r0, pieces: [{ ...r0.pieces[0], productId: 'nope' }] }, find as never).problems.some((m: string) => /Unknown product/.test(m)));
}

// rotateLayout keeps shape
{
  const r = rooms[0], items = toItems(r), turned = rotateLayout(items, [items[0].position[0], items[0].position[2]], 90);
  assert.equal(collidingUids(turned, find).size, 0);
  assert.equal(turned[0].rotationY, items[0].rotationY + 90);
}
console.log(`room integrity tests passed (${rooms.length} rooms)`);
