import assert from 'node:assert/strict';
import fs from 'node:fs';
import { collidingUids, footprint } from '../src/utils/geometry.ts';
import { roomFromCorners, placeLayout, layoutFits, placeOffsets } from '../src/utils/room.ts';
import type { Product, SampleRoom } from '../src/types/furniture.ts';

const catalogue: Product[] = JSON.parse(fs.readFileSync('src/data/catalogue.json', 'utf8'));
const find = (id: string) => catalogue.find((p) => p.id === id);

const noisy = (n: number) => ((Math.sin(n * 12.9898) * 43758.5453) % 1) * 0.03; // deterministic +-3 cm
function rectCorners(w: number, d: number, angleDeg: number, ox: number, oz: number): [number, number][] {
  const a = (angleDeg * Math.PI) / 180;
  return ([[0, 0], [w, 0], [w, d], [0, d]] as [number, number][]).map(([x, z], i) => [
    ox + x * Math.cos(a) - z * Math.sin(a) + noisy(i), oz + x * Math.sin(a) + z * Math.cos(a) + noisy(i + 9)]);
}

// Noisy rotated rectangles are measured within 3 %.
for (const [w, d, ang] of [[5.0, 4.2, 0], [5.0, 4.2, 30], [3.1, 4.4, -70], [6, 3, 141]] as const) {
  const room = roomFromCorners(rectCorners(w, d, ang, 2, -1))!;
  const [L, S] = [Math.max(w, d) * 100, Math.min(w, d) * 100];
  assert.ok(Math.abs(room.widthCm - L) / L < 0.03 && Math.abs(room.depthCm - S) / S < 0.03, `dims ${w}x${d}@${ang}: got ${room.widthCm.toFixed(0)}x${room.depthCm.toFixed(0)}`);
  assert.ok(room.rectangularity > 0.95);
}
// L-shaped room: area is exact, rectangularity flags the irregular shape.
{
  const L = roomFromCorners([[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]])!;
  assert.ok(Math.abs(L.areaM2 - 12) < 1e-9);
  assert.ok(L.rectangularity < 0.8);
}
assert.equal(roomFromCorners([[0, 0], [1, 1]]), null);

// A layout placed into a rotated, noisy scanned room stays inside it and collision-free (real catalogue pieces).
{
  const sofa = catalogue.find((p) => p.role === 'sofa' && !p.sizeReview && p.dimensionsCm.w < 230)!;
  const table = catalogue.find((p) => p.role === 'coffee-table' && !p.sizeReview && p.dimensionsCm.w < 140)!;
  const layout: Pick<SampleRoom, 'roomCm' | 'pieces'> = {
    roomCm: { w: 450, d: 380 },
    pieces: [
      { productId: sofa.id, x: 225, z: 60, rot: 0, anchor: true },
      { productId: table.id, x: 225, z: 200, rot: 0, anchor: false },
    ],
  };
  const room = roomFromCorners(rectCorners(5.2, 4.4, 33, 1, 2))!;
  assert.ok(layoutFits(layout.roomCm, room, 0));
  assert.ok(!layoutFits(layout.roomCm, roomFromCorners(rectCorners(4.0, 3.0, 0, 0, 0))!, 0), 'too small room must not fit');
  for (const k of [0, 2]) {
    const items = placeLayout(layout, room, k);
    assert.equal(collidingUids(items, find).size, 0);
    const a = (room.yawDeg * Math.PI) / 180;
    for (const [i, it] of items.entries()) for (const [x, z] of footprint(it, find(it.productId)!)) {
      const dx = x - room.centre[0], dz = z - room.centre[1];
      const lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a);
      assert.ok(Math.abs(lx) * 100 <= room.widthCm / 2 + 1 && Math.abs(lz) * 100 <= room.depthCm / 2 + 1, `piece ${i} outside scanned room (k=${k})`);
    }
  }
}
// placeOffsets: a plan opened in AR after a scan is centred in the room and turned to its walls, keeping every distance
{
  const room = roomFromCorners([[0, 0], [4, 1], [3, 4.5], [-1, 3.5]].map(([x, z]) => [x, z] as [number, number]))!;
  const items = [
    { productId: 'a', offset: [0, 0, 0] as [number, number, number], rotationY: 0, scale: 1 },
    { productId: 'b', offset: [2, 0, 1] as [number, number, number], rotationY: 90, scale: 1 },
  ];
  const out = placeOffsets(items, room, 'x');
  assert.equal(out.length, 2);
  const mid = [(out[0].position[0] + out[1].position[0]) / 2, (out[0].position[2] + out[1].position[2]) / 2];
  assert.ok(Math.hypot(mid[0] - room.centre[0], mid[1] - room.centre[1]) < 1e-9, 'bounding-box centre at the room centre');
  assert.ok(Math.abs(Math.hypot(out[1].position[0] - out[0].position[0], out[1].position[2] - out[0].position[2]) - Math.hypot(2, 1)) < 1e-9, 'distance between pieces kept');
  assert.equal(out[0].rotationY, room.yawDeg); assert.equal(out[1].rotationY, 90 + room.yawDeg);
  assert.deepEqual(placeOffsets([], room), []);
}
console.log('room scan tests passed');
