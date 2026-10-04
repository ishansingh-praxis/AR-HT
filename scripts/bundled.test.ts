import assert from 'node:assert/strict';
import { applyBundled } from '../src/utils/bundled.ts';

const p = (id: string, extra = {}) => ({ id, name: id, ...extra }) as never;
const list = [p('a'), p('b', { proxy: { template: 'Sofa', color: 'grey' } }), p('c', { model3D: { url: 'http://x/c.glb', version: 3, unit: 'm' } })];

const out = applyBundled(list, new Set(['b', 'c'])) as unknown as { id: string; model3D?: { bundled?: boolean; url: string }; proxy?: unknown }[];
assert.equal(out[0], list[0], 'products without a bundled model are untouched');
assert.equal(out[1].model3D?.bundled, true);
assert.equal(out[1].model3D?.url, '');
assert.ok(out[1].proxy, 'the simplified shape stays as a fallback');
assert.equal(out[2].model3D?.bundled, true, 'a bundled file wins over a remote model of the same product');
assert.equal(applyBundled(out as never, new Set(['b', 'c'])), out as never, 'applying twice changes nothing and keeps the same array');
assert.equal(applyBundled(list, new Set()), list);
console.log('bundled model tests passed');
