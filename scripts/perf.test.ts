import assert from 'node:assert/strict';
import { LOD_GLB_LIMIT, MAX_PIECES, modelCacheName, pickQuality, proxyUids, shouldDropQuality } from '../src/utils/perf.ts';
import type { PlacedItem, Product } from '../src/types/furniture.ts';

const GB = 1024 ** 3;
// ---- quality auto-pick ----
assert.equal(pickQuality({ os: 'android', ramBytes: 8 * GB, apiLevel: 34 }), 'high');
assert.equal(pickQuality({ os: 'android', ramBytes: 6 * GB, apiLevel: 30 }), 'high');
assert.equal(pickQuality({ os: 'android', ramBytes: 4 * GB, apiLevel: 34 }), 'standard', 'low RAM');
assert.equal(pickQuality({ os: 'android', ramBytes: 8 * GB, apiLevel: 28 }), 'standard', 'old Android');
assert.equal(pickQuality({ os: 'android' }), 'standard', 'unknown device');
assert.equal(pickQuality({ os: 'ios', modelId: 'iPhone14,2' }), 'high');
assert.equal(pickQuality({ os: 'ios', modelId: 'iPhone13,1' }), 'high');
assert.equal(pickQuality({ os: 'ios', modelId: 'iPhone12,1' }), 'standard');
assert.equal(pickQuality({ os: 'ios', modelId: 'iPad13,1' }), 'standard');
assert.equal(pickQuality({ os: 'web' }), 'standard');

// ---- fps-based drop ----
assert.equal(shouldDropQuality('high', 15, 10), true);
assert.equal(shouldDropQuality('high', 15, 5), false, 'few pieces: not the pieces that are slow');
assert.equal(shouldDropQuality('high', 40, 12), false);
assert.equal(shouldDropQuality('standard', 5, 12), false, 'already standard');
assert.equal(shouldDropQuality('high', 0, 12), false, 'no samples yet');

// ---- level of detail ----
const real = (id: string, proxy = true) => ({ id, model3D: { url: 'u', version: 1, unit: 'm' }, ...(proxy ? { proxy: { template: 'Sofa', color: 'grey' } } : {}) }) as unknown as Product;
const items: PlacedItem[] = Array.from({ length: 20 }, (_, i) => ({ uid: `u${i}`, productId: i === 17 ? 'noproxy' : i === 3 ? 'shape-only' : 'real', position: [0, 0, 0], rotationY: 0, scale: 1 }));
const find = (id: string) => (id === 'shape-only' ? ({ id, proxy: { template: 'Sofa', color: 'grey' } } as unknown as Product) : id === 'noproxy' ? real(id, false) : real(id));
const lod = proxyUids(items, find);
assert.ok(!lod.includes('u3'), 'shape-only pieces are never in the list (they already are shapes)');
assert.equal(items.filter((i) => find(i.productId).model3D).length, 19);
assert.deepEqual(lod, ['u16', 'u18', 'u19'], 'real models past the 15th use their shape; a model with no shape keeps the model');
assert.deepEqual(proxyUids(items.slice(0, 10), find), []);
assert.equal(MAX_PIECES, 30); assert.equal(LOD_GLB_LIMIT, 15);

// ---- cache file names ----
assert.equal(modelCacheName('sofa-1', 2), 'sofa-1-v2.glb');
assert.equal(modelCacheName('../x/y', 1), '___x_y-v1.glb', 'cannot escape the folder');

console.log('perf tests passed');
