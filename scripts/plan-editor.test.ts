import assert from 'node:assert/strict';
import fs from 'node:fs';
import { clampInside, clampScale, defaultRoom, describePiece, fitRoomToItems, fromPlaced, halfExtent, itemsToPlan, nudge, planToItems, screenToPlan, snapCm, toPlaced, turnDeg, wallDistances } from '../src/plan/editor.ts';
import { collidingUids } from '../src/utils/geometry.ts';
import { narrowUids } from '../src/utils/clearance.ts';
import type { Product } from '../src/types/furniture.ts';

const catalogue: Product[] = JSON.parse(fs.readFileSync('src/data/catalogue.json', 'utf8'));
const find = (id: string) => catalogue.find((p) => p.id === id);
const sofa = catalogue.find((p) => p.role === 'sofa' && !p.sizeReview && p.proxy)!;
const bed = catalogue.find((p) => p.role === 'bed' && !p.sizeReview && p.proxy)!;

// ---- snapping and turning ----
assert.equal(snapCm(12), 10); assert.equal(snapCm(13), 15); assert.equal(snapCm(-7), -5); assert.equal(snapCm(22, 10), 20);
assert.equal(turnDeg(0, 15), 15); assert.equal(turnDeg(175, 15), -170); assert.equal(turnDeg(-90, -90), 180); assert.equal(turnDeg(90, 90), 180); assert.equal(turnDeg(180, 90), -90);

// ---- default room ----
assert.deepEqual(defaultRoom({ widthCm: 450, depthCm: 380 }), { w: 450, d: 380 }, 'a scan wins');
assert.deepEqual(defaultRoom(null, 'unknown'), { w: 400, d: 350 });
const med = defaultRoom(null, 'medium');
assert.ok(Math.abs((med.w * med.d) / 1e4 - 16) < 0.5 && Math.abs(med.w / med.d - 4 / 3) < 0.02, 'medium preset ~16 m2 at 4:3');
assert.equal(defaultRoom({ widthCm: 99999, depthCm: 10 }).w, 2000, 'clamped');

// ---- wall distances ----
const room = { w: 400, d: 300 };
const dims = { w: 200, d: 90 };
let wd = wallDistances({ x: 200, z: 45 + 30, rot: 0 }, dims, room);
assert.equal(wd.north, 30); assert.equal(wd.south, 300 - (75 + 45)); assert.equal(wd.west, 100); assert.equal(wd.east, 100);
assert.equal(wd.nearest, 'north'); assert.equal(wd.nearestCm, 30);
wd = wallDistances({ x: 200, z: 150, rot: 90 }, dims, room); // turned: now 90 wide, 200 deep
assert.equal(wd.west, 200 - 45); assert.equal(wd.north, 150 - 100);
assert.ok(wallDistances({ x: 10, z: 150, rot: 0 }, dims, room).west < 0, 'sticks out of the west wall');
const e = halfExtent({ rot: 45 }, { w: 100, d: 100 });
assert.ok(Math.abs(e.x - 70.71) < 0.01 && Math.abs(e.z - 70.71) < 0.01);
assert.equal(describePiece('Sofa', { x: 200, z: 75, rot: 0 }, dims, room), 'Sofa, 200 by 90 cm, 30 cm from the north wall');
assert.match(describePiece('Sofa', { x: 10, z: 150, rot: 0 }, dims, room), /outside the west wall/);

// ---- keeping pieces inside ----
assert.deepEqual(clampInside({ x: -50, z: 999, rot: 0 }, dims, room), { x: 100, z: 255 });
assert.deepEqual(clampInside({ x: 200, z: 150, rot: 0 }, dims, room), { x: 200, z: 150 }, 'already inside: untouched');
assert.deepEqual(clampInside({ x: 0, z: 0, rot: 0 }, { w: 500, d: 500 }, { w: 400, d: 300 }), { x: 250, z: 250 }, 'a piece bigger than the room does not crash');

// ---- nudge (north is -z) ----
assert.deepEqual(nudge({ x: 100, z: 100 }, 'north'), { x: 100, z: 75 });
assert.deepEqual(nudge({ x: 100, z: 100 }, 'east', 10), { x: 110, z: 100 });
assert.deepEqual(nudge({ x: 100, z: 100 }, 'south'), { x: 100, z: 125 });
assert.deepEqual(nudge({ x: 100, z: 100 }, 'west'), { x: 75, z: 100 });

// ---- canvas transform ----
const view = { scale: 2, tx: 30, ty: 10 };
const p = screenToPlan(30 + 2 * (22 + 3 * 100), 10 + 2 * (3 * 50), view, 3, 22);
assert.ok(Math.abs(p.x - 100) < 1e-9 && Math.abs(p.z - 50) < 1e-9, 'screen -> plan at zoom 2 with a pan');
assert.equal(clampScale(0.1), 0.5); assert.equal(clampScale(9), 4); assert.equal(clampScale(1.5), 1.5);

// ---- plan -> design -> AR -> plan: positions survive within 1 mm ----
const pieces = [
  { uid: 'a', productId: sofa.id, x: 205, z: 100, rot: 0 },
  { uid: 'b', productId: bed.id, x: 500, z: 300, rot: 90 },
  { uid: 'c', productId: sofa.id, x: 205, z: 500, rot: -45 },
];
const items = planToItems(pieces);
assert.deepEqual(items[0].offset, [0, 0, 0], 'first piece is the origin, like AR');
assert.equal(items[1].rotationY, 90);
// what AR does when the user taps at world point `at` (src/features/ar/useDesignIO.ts): position = at + offset, rotation unchanged
const at: [number, number, number] = [1.234, 0.02, -0.876];
const world = items.map((d) => ({ position: [at[0] + d.offset[0], at[1] + d.offset[1], at[2] + d.offset[2]] as [number, number, number], rotationY: d.rotationY }));
// ...then the user saves in AR (offsets from the first piece) and opens it in the plan with the first piece at its old spot
const saved = world.map((w) => ({ productId: 'x', offset: [w.position[0] - world[0].position[0], w.position[1] - world[0].position[1], w.position[2] - world[0].position[2]] as [number, number, number], rotationY: w.rotationY, scale: 1 }));
const back = itemsToPlan(saved, { x: pieces[0].x, z: pieces[0].z });
for (let i = 0; i < pieces.length; i++) {
  assert.ok(Math.abs(back[i].x - pieces[i].x) < 0.1 && Math.abs(back[i].z - pieces[i].z) < 0.1, `piece ${i} within 1 mm`);
  assert.equal(back[i].rot, pieces[i].rot);
}
assert.deepEqual(planToItems([]), []);

// placed items round trip (history hook uses metres)
const placed = toPlaced(pieces);
assert.deepEqual(placed[1].position, [5, 0, 3]);
assert.deepEqual(fromPlaced(placed).map((q) => [q.x, q.z, q.rot]), pieces.map((q) => [q.x, q.z, q.rot]));

// ---- fitting a design into a room ----
const fit = fitRoomToItems(items, find, null);
assert.ok(fit.room.w >= 120 && fit.room.d >= 120);
const placedFit = itemsToPlan(items, fit.origin);
for (const pc of placedFit) { const pr = find(pc.productId)!; const w = wallDistances(pc, pr.dimensionsCm, fit.room); assert.ok(w.nearestCm >= 59, 'every piece has the 60 cm margin: ' + w.nearestCm); }
assert.equal(fitRoomToItems(items, find, { widthCm: 3000, depthCm: 3000 }).room.w, 2000, 'a scan bigger than the limit is clamped');
assert.deepEqual(fitRoomToItems([], find, null).room, { w: 400, d: 350 });

// ---- same collision / walkway rules as AR ----
assert.equal(collidingUids(toPlaced(pieces), find).size, 0);
const overlapping = toPlaced([{ uid: 'a', productId: sofa.id, x: 200, z: 100, rot: 0 }, { uid: 'b', productId: sofa.id, x: 220, z: 110, rot: 0 }]);
assert.equal(collidingUids(overlapping, find).size, 2, 'overlapping pieces are flagged');
const wardrobe = catalogue.find((p) => p.category === 'Wardrobe' && !p.sizeReview && p.proxy)!;
const sofaHalf = sofa.dimensionsCm.d / 2, wHalf = wardrobe.dimensionsCm.d / 2;
const tight = toPlaced([{ uid: 'a', productId: sofa.id, x: 200, z: 100, rot: 0 }, { uid: 'b', productId: wardrobe.id, x: 200, z: 100 + sofaHalf + 40 + wHalf, rot: 0 }]);
assert.equal(narrowUids(tight, find).size, 2, 'a 40 cm gap between big pieces is a narrow walkway');

console.log('plan editor tests passed');
