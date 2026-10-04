import assert from 'node:assert/strict';
import fs from 'node:fs';
import { collidingUids, footprint, rotateLayout } from '../src/utils/geometry.ts';
import { roomFromCorners, placeLayout, layoutFits } from '../src/utils/room.ts';
import { recommend, colourHarmony } from '../src/recommend/engine.ts';
import type { PlacedItem, Product, SampleRoom } from '../src/types/furniture.ts';

const catalogue: Product[] = JSON.parse(fs.readFileSync('src/data/catalogue.json', 'utf8'));
const rooms: SampleRoom[] = JSON.parse(fs.readFileSync('src/data/rooms.json', 'utf8'));
const find = (id: string) => catalogue.find((p) => p.id === id);
const toItems = (r: Pick<SampleRoom, 'pieces'>, off = [0, 0]): PlacedItem[] =>
  r.pieces.map((p, i) => ({ uid: `${i}`, productId: p.productId, position: [p.x / 100 + off[0], 0, p.z / 100 + off[1]], rotationY: p.rot, scale: 1 }));

// ---- Curated rooms: real data integrity ----
for (const r of rooms) {
  const items = toItems(r);
  assert.ok(r.pieces.filter((p) => p.anchor).length === 1, `${r.id}: exactly one anchor piece`);
  for (const [i, p] of r.pieces.entries()) {
    const prod = find(p.productId);
    assert.ok(prod, `${r.id}: unknown product ${p.productId}`);
    assert.equal(prod.source, 'hometown');
    assert.ok(prod.images.length && prod.dimensionsCm.w > 0 && prod.dimensionsCm.d > 0 && prod.dimensionsCm.h > 0, `${p.productId}: needs image + dimensions`);
    // inside the room, with 1 cm slack for rounding
    for (const [x, z] of footprint(items[i], prod)) {
      assert.ok(x * 100 >= -1 && x * 100 <= r.roomCm.w + 1 && z * 100 >= -1 && z * 100 <= r.roomCm.d + 1, `${r.id}: ${p.productId} sticks out of the room at (${(x * 100).toFixed(0)}, ${(z * 100).toFixed(0)})`);
    }
  }
  assert.equal(collidingUids(items, find).size, 0, `${r.id}: pieces overlap`);
}
// Gaps between different pieces must be intentional: touching (<=12 cm), table reach distance (35-50 cm), or a real walkway (>=60 cm).
// Identical pieces in a row (dining chairs) are exempt.
function gapCm(a: [number, number][], b: [number, number][]) {
  // min distance between two convex quads via vertex-to-edge distances
  const segs = (q: [number, number][]) => q.map((p, i) => [p, q[(i + 1) % 4]] as const);
  const dist = (p: [number, number], [s, e]: readonly [[number, number], [number, number]]) => {
    const dx = e[0] - s[0], dz = e[1] - s[1], t = Math.max(0, Math.min(1, ((p[0] - s[0]) * dx + (p[1] - s[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(p[0] - (s[0] + t * dx), p[1] - (s[1] + t * dz));
  };
  let m = Infinity;
  for (const p of a) for (const s of segs(b)) m = Math.min(m, dist(p, s));
  for (const p of b) for (const s of segs(a)) m = Math.min(m, dist(p, s));
  return m * 100;
}
for (const r of rooms) {
  const items = toItems(r);
  const fp = items.map((it) => footprint(it, find(it.productId)!));
  for (let i = 0; i < fp.length; i++) for (let j = i + 1; j < fp.length; j++) {
    if (r.pieces[i].productId === r.pieces[j].productId) continue;
    const g = gapCm(fp[i], fp[j]);
    const ok = g <= 12 || (g >= 35 && g <= 50) || g >= 60;
    assert.ok(ok, `${r.id}: ${r.pieces[i].productId} / ${r.pieces[j].productId} leave an awkward ${g.toFixed(0)} cm gap`);
  }
}

// ---- rotateLayout keeps shape ----
{
  const r = rooms[0], items = toItems(r), turned = rotateLayout(items, [items[0].position[0], items[0].position[2]], 90);
  assert.equal(collidingUids(turned, find).size, 0);
  assert.equal(turned[0].rotationY, items[0].rotationY + 90);
}

// ---- Room from marked corners ----
const noisy = (n: number) => ((Math.sin(n * 12.9898) * 43758.5453) % 1) * 0.03; // deterministic +-3 cm
function rectCorners(w: number, d: number, angleDeg: number, ox: number, oz: number): [number, number][] {
  const a = (angleDeg * Math.PI) / 180;
  return ([[0, 0], [w, 0], [w, d], [0, d]] as [number, number][]).map(([x, z], i) => [ox + x * Math.cos(a) - z * Math.sin(a) + noisy(i), oz + x * Math.sin(a) + z * Math.cos(a) + noisy(i + 9)]);
}
for (const [w, d, ang] of [[5.0, 4.2, 0], [5.0, 4.2, 30], [3.1, 4.4, -70], [6, 3, 141]] as const) {
  const room = roomFromCorners(rectCorners(w, d, ang, 2, -1))!;
  const [L, S] = [Math.max(w, d) * 100, Math.min(w, d) * 100];
  assert.ok(Math.abs(room.widthCm - L) / L < 0.03 && Math.abs(room.depthCm - S) / S < 0.03, `dims ${w}x${d}@${ang}: got ${room.widthCm.toFixed(0)}x${room.depthCm.toFixed(0)}`);
  assert.ok(room.rectangularity > 0.95);
}
{ // L-shaped room: area is exact, rectangularity flags irregular
  const L = roomFromCorners([[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]])!;
  assert.ok(Math.abs(L.areaM2 - 12) < 1e-9);
  assert.ok(L.rectangularity < 0.8);
}
assert.equal(roomFromCorners([[0, 0], [1, 1]]), null);

// ---- Sample layout placed into a rotated, noisy scanned room stays inside it and collision-free ----
{
  const layout = rooms[0]; // 450 x 380
  const room = roomFromCorners(rectCorners(5.2, 4.4, 33, 1, 2))!;
  assert.ok(layoutFits(layout.roomCm, room, 0));
  assert.ok(!layoutFits(layout.roomCm, roomFromCorners(rectCorners(4.0, 3.0, 0, 0, 0))!, 0), 'too small room must not fit');
  for (const k of [0, 2]) {
    const items = placeLayout(layout, room, k);
    assert.equal(collidingUids(items, find).size, 0);
    const a = (room.yawDeg * Math.PI) / 180;
    for (const [i, it] of items.entries()) for (const [x, z] of footprint(it, find(it.productId)!)) {
      // back into the room frame: long axis along +x
      const dx = x - room.centre[0], dz = z - room.centre[1];
      const lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a);
      assert.ok(Math.abs(lx) * 100 <= room.widthCm / 2 + 1 && Math.abs(lz) * 100 <= room.depthCm / 2 + 1, `piece ${i} outside scanned room (k=${k})`);
    }
  }
}

// ---- Recommendation engine ----
const mk = (id: string, role: Product['role'], w: number, d: number, extra: Partial<Product> = {}): Product => ({
  id, name: id, category: 'x', role, subcategory: '', brand: '', description: '', material: '', images: ['i'], modelStatus: 'proxy',
  dimensionsCm: { w, d, h: 80 }, dimsConfidence: 'high', colors: [], styles: [], roomTypes: ['living'], ar: { placements: ['floor'] }, source: 'hometown', ...extra,
});
const place = (p: Product): { product: Product; item: PlacedItem } => ({ product: p, item: { uid: p.id, productId: p.id, position: [0, 0, 0], rotationY: 0, scale: 1 } });
{
  const sofa = mk('sofa', 'sofa', 200, 90, { family: 'nova', styles: ['modern'], colors: [{ name: 'beige', hex: '#D8C8AC' }] });
  const cat = [
    mk('table', 'coffee-table', 110, 55, { styles: ['modern'], colors: [{ name: 'brown', hex: '#7A5230' }] }),
    mk('table-nova', 'coffee-table', 110, 55, { family: 'nova' }),
    mk('sofa2', 'sofa', 210, 95),
    mk('bed', 'bed', 163, 225, { roomTypes: ['bedroom'] }),
    mk('wall-art', 'decor', 50, 5),
    mk('tv', 'tv-unit', 150, 40),
    mk('chair-a', 'chair', 70, 70), mk('chair-b', 'chair', 70, 70), mk('chair-c', 'chair', 70, 70),
    mk('wall-only', 'chair', 70, 70, { ar: { placements: ['wall'] } }),
  ];
  const r = recommend(cat, { roomType: 'living', placed: [place(sofa)] });
  const ids = r.map((x) => x.product.id);
  assert.ok(!ids.includes('sofa2'), 'role already filled (1 sofa wanted)');
  assert.ok(!ids.includes('bed') && !ids.includes('wall-art'), 'roles not wanted in a living room');
  assert.ok(!ids.includes('wall-only'), 'floor placement only');
  assert.ok(ids.indexOf('table-nova') < ids.indexOf('table'), 'same-family piece ranks first');
  assert.match(r.find((x) => x.product.id === 'table-nova')!.reasons.join(' '), /Same Nova collection/);
  assert.ok(r.filter((x) => x.product.role === 'chair').length <= 2, 'diversity cap');
  // space filter: a 6 m2 room with a 1.8 m2 sofa leaves 0.55*6 - 1.8 = 1.5 m2 -> the 150x40 TV unit (0.6) fits, three 0.49 chairs partly
  const tight = recommend(cat, { roomType: 'living', areaM2: 3, placed: [place(sofa)] });
  assert.equal(tight.length, 0, 'no room left: nothing may be recommended');
  assert.deepEqual(recommend(cat, { roomType: 'living', placed: [place(sofa)] }), r, 'deterministic');
  assert.equal(recommend(cat, { roomType: 'living', placed: [place(sofa), place(cat[0]), place(cat[5]), place(cat[6]), place(cat[7])] }).length, 0, 'all quotas filled');
}
assert.equal(colourHarmony('#888888', '#B03A35'), 0.8, 'neutral goes with anything');
assert.equal(colourHarmony('#B03A35', '#D9822B'), 1, 'analogous');
assert.equal(colourHarmony(undefined, '#fff'), 0.5, 'unknown colour is neutral');
// ---- Engine on the real curated catalogue ----
{
  const sofa = find('icon-velvet-3-seater-sofa-beige')!;
  const r = recommend(catalogue, { roomType: 'living', placed: [place(sofa)] });
  assert.ok(r.length >= 3, 'real data gives suggestions');
  assert.ok(r.every((x) => ['coffee-table', 'tv-unit', 'chair', 'side-table', 'storage', 'rug', 'lamp'].includes(x.product.role)));
  const bed = find('nova-queen-bed-hydraulic-storage')!;
  const b = recommend(catalogue, { roomType: 'bedroom', placed: [place(bed)] });
  assert.ok(b.every((x) => x.product.family === 'nova' || x.product.roomTypes.includes('bedroom')));
  assert.ok(b[0].product.family === 'nova', 'bedroom: Nova pieces first');
}
console.log('room + recommendation tests passed');
