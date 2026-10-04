import assert from 'node:assert/strict';
import { PAD, pieceAt, pointToCm, scaleOf, slugify, snapTo, turn, uniqueId } from './lib.ts';

assert.equal(snapTo(12), 10); assert.equal(snapTo(13), 15); assert.equal(snapTo(-2), -0);
assert.equal(turn(170, 20), -170); assert.equal(turn(-170, -20), 170); assert.equal(turn(0, 90), 90); assert.equal(turn(90, -90), 0); assert.equal(turn(180, 0), 180);

// pointer -> cm round trip at 560 px wide for a 400 x 300 room
const room = { w: 400, d: 300 }, width = 560, k = scaleOf(room.w, width);
assert.ok(Math.abs(k - (560 - PAD) / 400) < 1e-9);
assert.deepEqual(pointToCm(PAD + 200 * k, 100 * k, room, width), { x: 200, z: 100 });
assert.deepEqual(pointToCm(-50, -50, room, width), { x: 0, z: 0 }, 'clamped to the room');
assert.deepEqual(pointToCm(9999, 9999, room, width), { x: 400, z: 300 });
assert.deepEqual(pointToCm(PAD + 203 * k, 98 * k, room, width), { x: 205, z: 100 }, 'snaps to 5 cm');

assert.equal(slugify('Cosy  Living Room!'), 'cosy-living-room');
assert.equal(slugify('###'), 'room');
assert.equal(uniqueId('Cosy Living', []), 'cosy-living');
assert.equal(uniqueId('Cosy Living', ['cosy-living', 'cosy-living-2']), 'cosy-living-3');
assert.ok(uniqueId('A', []).length >= 3, 'ids must be at least 3 characters');

// hit testing respects rotation: a 200 x 50 sofa turned 90 degrees is tall, not wide
const sofa = { x: 100, z: 100, rot: 90, w: 200, d: 50 };
assert.equal(pieceAt(100, 180, [sofa]), 0, 'inside along the turned length');
assert.equal(pieceAt(180, 100, [sofa]), -1, 'outside across the turned width');
assert.equal(pieceAt(100, 100, [{ ...sofa, rot: 0 }, { ...sofa, x: 100, z: 100, w: 20, d: 20 }]), 1, 'the topmost (last) piece wins');
assert.equal(pieceAt(0, 0, []), -1);

console.log('admin lib tests passed');
