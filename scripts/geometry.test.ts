import { collidingUids, checkFit } from '../src/utils/geometry.ts';
import type { PlacedItem, Product } from '../src/types/furniture.ts';
import assert from 'node:assert/strict';

const prod = (w: number, d: number) => ({ id: 'x', dimensionsCm: { w, d, h: 80 } }) as unknown as Product;
const item = (uid: string, x: number, z: number, rot = 0): PlacedItem =>
  ({ uid, productId: 'x', position: [x, 0, z], rotationY: rot, scale: 1 });
const find = () => prod(200, 100);

// 2m x 1m footprints
assert.equal(collidingUids([item('a', 0, 0), item('b', 1.5, 0)], find).size, 2, 'overlap along width');
assert.equal(collidingUids([item('a', 0, 0), item('b', 2.1, 0)], find).size, 0, 'clear gap along width');
assert.equal(collidingUids([item('a', 0, 0), item('b', 0, 1.2)], find).size, 0, 'clear gap along depth');
assert.equal(collidingUids([item('a', 0, 0), item('b', 0, 0.9)], find).size, 2, 'overlap along depth');
assert.equal(collidingUids([item('a', 0, 0), item('b', 2.0, 0)], find).size, 0, 'touching is not a collision');
// Rotating b by 90deg makes it 1m wide in x: centre at x=1.4 -> b spans 0.9..1.9 in x, a spans -1..1 -> overlap.
assert.equal(collidingUids([item('a', 0, 0), item('b', 1.4, 0, 90)], find).size, 2, 'rotated overlap');
// ...and at x=1.6 the rotated b spans 1.1..2.1 -> clear.
assert.equal(collidingUids([item('a', 0, 0), item('b', 1.6, 0, 90)], find).size, 0, 'rotated clear');
// 45deg diagonal corner case: a 2x1 rect rotated 45deg at x=1.9 pokes into a's right edge.
assert.equal(collidingUids([item('a', 0, 0), item('b', 1.9, 0, 45)], find).size, 2, 'diagonal overlap');

assert.deepEqual(checkFit(210, 300), { status: 'fits', spareCm: 90 });
assert.deepEqual(checkFit(210, 230), { status: 'tight', spareCm: 20 });
assert.deepEqual(checkFit(210, 200), { status: 'no', shortByCm: 10 });
console.log('geometry tests passed');
