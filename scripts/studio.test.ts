import assert from 'node:assert/strict';
import fs from 'node:fs';
import { KINDS, THEMES, autoPlace, budgetOf, designRoom, getKind, getTheme, gapCm, corners, placeAnother, rupees, setsFor, themeScore } from '../src/studio/studio.ts';
import { collidingUids } from '../src/utils/geometry.ts';
import type { PlacedItem, Product } from '../src/types/furniture.ts';

const catalogue: Product[] = JSON.parse(fs.readFileSync('src/data/catalogue.json', 'utf8'));
const find = (id: string) => catalogue.find((p) => p.id === id);
const toItems = (ps: { uid: string; productId: string; x: number; z: number; rot: number }[]): PlacedItem[] =>
  ps.map((p) => ({ uid: p.uid, productId: p.productId, position: [p.x / 100, 0, p.z / 100], rotationY: p.rot, scale: 1 }));

// ---- money ----
assert.equal(rupees(1234567), '₹12,34,567');
assert.equal(rupees(890), '₹890');
assert.equal(setsFor({ setSize: 2 }, 6), 3); assert.equal(setsFor({ setSize: 2 }, 5), 3); assert.equal(setsFor({}, 4), 4);
const priced = catalogue.filter((p) => p.priceInr && !p.setSize).slice(0, 3);
const b = budgetOf([{ productId: priced[0].id }, { productId: priced[0].id }, { productId: priced[1].id }], find);
assert.equal(b.total, priced[0].priceInr! * 2 + priced[1].priceInr!);
assert.equal(b.lines.length, 2); assert.equal(b.unpriced, 0);
assert.equal(budgetOf([{ productId: 'sofa-velvet' }], find).unpriced, 1, 'a product without a price is counted, not silently free');
assert.deepEqual(budgetOf([], find), { total: 0, lines: [], unpriced: 0 });
const setProduct = catalogue.find((p) => p.setSize === 2 && p.priceInr)!;
assert.equal(budgetOf(Array(4).fill({ productId: setProduct.id }), find).total, setProduct.priceInr! * 2, '4 chairs sold in pairs = 2 sets');

// ---- themes ----
const sofaBlue = catalogue.find((p) => p.role === 'sofa' && p.proxy?.color === 'blue')!;
assert.ok(themeScore(sofaBlue, getTheme('bold')) > themeScore(sofaBlue, getTheme('warm')), 'a blue sofa suits "bold" more than "warm"');
assert.equal(getTheme('nope').id, THEMES[0].id);

// ---- geometry helpers ----
const sq = corners(100, 100, 0, 100, 50);
assert.ok(Math.abs(gapCm(sq, corners(100, 200, 0, 100, 50)) - 50) < 1e-6, 'gap between two boxes');
assert.equal(gapCm(sq, corners(100, 120, 0, 100, 50)), 0, 'overlap is 0');

// ---- every room type x every theme gets a believable, collision-free layout from the real catalogue ----
for (const kind of KINDS) {
  for (const theme of THEMES) {
    const room = kind.room;
    const r = designRoom(catalogue, kind, theme, room, find);
    const where = `${kind.id}/${theme.id}`;
    assert.ok(r.pieces.length >= 3, `${where}: at least 3 pieces placed (got ${r.pieces.length}, unplaced ${r.unplaced.join(',')})`);
    assert.deepEqual(r.unplaced, [], `${where}: everything chosen fits the room`);
    assert.equal(collidingUids(toItems(r.pieces), find).size, 0, `${where}: no overlaps`);
    for (const pc of r.pieces) {
      const p = find(pc.productId)!;
      for (const [x, z] of corners(pc.x, pc.z, pc.rot, p.dimensionsCm.w, p.dimensionsCm.d)) assert.ok(x >= -1 && x <= room.w + 1 && z >= -1 && z <= room.d + 1, `${where}: ${p.name} inside the room`);
    }
    assert.deepEqual(designRoom(catalogue, kind, theme, room, find).pieces, r.pieces, `${where}: deterministic`);
    assert.ok(budgetOf(r.pieces, find).total > 0, `${where}: has a budget`);
  }
}

// ---- layouts make sense ----
{
  const r = designRoom(catalogue, getKind('living'), getTheme('modern'), getKind('living').room, find);
  const sofa = r.pieces.find((p) => find(p.productId)!.role === 'sofa')!, coffee = r.pieces.find((p) => find(p.productId)!.role === 'coffee-table');
  assert.ok(coffee, 'a living room has a coffee table');
  const d = Math.hypot(coffee!.x - sofa.x, coffee!.z - sofa.z);
  assert.ok(d < 220, `coffee table close to the sofa (${d.toFixed(0)} cm)`);
  assert.equal(coffee!.rot, sofa.rot, 'coffee table lines up with the sofa');
  const dining = designRoom(catalogue, getKind('dining'), getTheme('warm'), getKind('dining').room, find);
  assert.ok(dining.pieces.filter((p) => find(p.productId)!.role === 'chair').length >= 4, 'dining room has chairs');
  const bed = designRoom(catalogue, getKind('bedroom'), getTheme('minimal'), getKind('bedroom').room, find);
  assert.ok(bed.pieces.filter((p) => /bedside/i.test(find(p.productId)!.subcategory ?? '')).length >= 1, 'bedroom has a bedside table');
}

// ---- a tiny room still works: nothing overlaps; what cannot fit is reported instead of squeezed in ----
{
  const small = designRoom(catalogue, getKind('living'), getTheme('modern'), { w: 260, d: 240 }, find);
  assert.equal(collidingUids(toItems(small.pieces), find).size, 0);
  assert.ok(small.pieces.length >= 1);
}

// ---- budget limit: a lower budget swaps in cheaper pieces ----
{
  const kind = getKind('bedroom'), theme = getTheme('classic');
  const full = budgetOf(designRoom(catalogue, kind, theme, kind.room, find).pieces, find).total;
  const capped = designRoom(catalogue, kind, theme, kind.room, find, { budgetInr: Math.round(full * 0.6) });
  const cut = budgetOf(capped.pieces, find).total;
  assert.ok(cut < full, `a 60 % budget lowers the total (${rupees(full)} -> ${rupees(cut)})`);
}

// ---- adding one more piece finds free floor, or says there is none ----
{
  const kind = getKind('living');
  const base = designRoom(catalogue, kind, getTheme('modern'), kind.room, find);
  const small = catalogue.find((p) => p.role === 'side-table' && p.dimensionsCm.w < 60 && !p.sizeReview && p.proxy)!;
  const more = placeAnother(kind.room, base.pieces, small, find);
  assert.ok(more, 'there is room for a small side table');
  assert.equal(collidingUids(toItems([...base.pieces, more!]), find).size, 0, 'the new piece does not overlap');
  const wardrobe = catalogue.find((p) => p.role === 'wardrobe' && !p.sizeReview && p.proxy)!;
  assert.equal(placeAnother({ w: 120, d: 120 }, [], wardrobe, find), null, 'a wardrobe does not fit a 1.2 m square');
}
assert.equal(autoPlace({ w: 300, d: 300 }, [], find).pieces.length, 0);
console.log('studio tests passed');
