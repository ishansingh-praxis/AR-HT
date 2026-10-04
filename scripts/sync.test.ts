import assert from 'node:assert/strict';
import { applyDelta, fetchAllPages } from '../src/sync/catalogue.ts';
import { shadowFrame } from '../src/utils/shadow.ts';

// ---- bug 1: paging the catalogue ----
const make = (n: number) => Array.from({ length: n }, (_, i) => i);
const pager = (n: number, limit = 100, calls: number[] = []) => async (offset: number) => { calls.push(offset); return { total: n, items: make(n).slice(offset, offset + limit) }; };
const calls: number[] = [];
assert.equal((await fetchAllPages(pager(681, 100, calls)))!.length, 681);
assert.deepEqual(calls, [0, 100, 200, 300, 400, 500, 600]);
assert.equal((await fetchAllPages(pager(0)))!.length, 0);
// a server that stops early must not replace the bundled list
assert.equal(await fetchAllPages(async (o) => ({ total: 300, items: o < 100 ? make(100) : [] })), null);

// ---- bug 5: shadow framing covers every floor item ----
assert.deepEqual(shadowFrame([]).size, 4);
const one = shadowFrame([[1, 0, 2]]);
assert.deepEqual(one.position, [1, 3, 2]); assert.equal(one.size, 4);
const far = shadowFrame([[0, 0, 0], [6, 0, 1]]);
assert.deepEqual(far.position, [3, 3, 0.5]);
assert.ok(far.size >= 6 + 2, 'covers a 6 m spread');
assert.equal(shadowFrame([[0, 0, 0], [40, 0, 0]]).size, 10, 'max 10 m');

// ---- catalogue delta merge ----
{
  const cur = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }, { id: 'c', v: 1 }];
  const out = applyDelta(cur, { products: [{ id: 'b', v: 2 }, { id: 'd', v: 1 }], removed: ['c', 'zzz'] });
  assert.deepEqual(out, [{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'd', v: 1 }], 'changed replaced in place, new appended, removed dropped');
  assert.deepEqual(applyDelta(cur, { products: [], removed: [] }), cur);
  assert.deepEqual(applyDelta([], { products: [{ id: 'x' }], removed: ['x'] }), [], 'a product both removed and changed stays removed');
}

console.log('sync + shadow tests passed');
