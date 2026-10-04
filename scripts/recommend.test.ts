import assert from 'node:assert/strict';
import fs from 'node:fs';
import { recommend, colourHarmony, type Recommendation } from '../src/recommend/engine.ts';
import type { PlacedItem, Product, RoomType } from '../src/types/furniture.ts';

const catalogue: Product[] = JSON.parse(fs.readFileSync('src/data/catalogue.json', 'utf8'));
const find = (id: string) => catalogue.find((p) => p.id === id)!;
const mk = (id: string, role: Product['role'], w: number, d: number, extra: Partial<Product> = {}): Product => ({
  id, name: id, category: 'x', role, subcategory: '', images: ['i'], proxy: { template: 'Sofa', color: 'grey' },
  dimensionsCm: { w, d, h: 80 }, dimsConfidence: 'high', colors: [], styles: [], roomTypes: ['living'], ar: { placements: ['floor'] }, ...extra,
}) as Product;
const place = (p: Product): { product: Product; item: PlacedItem } => ({ product: p, item: { uid: p.id, productId: p.id, position: [0, 0, 0], rotationY: 0, scale: 1 } });

const sofa = mk('sofa', 'sofa', 200, 90, { collection: 'nova', styles: ['modern'], colors: [{ name: 'beige', hex: '#D8C8AC' }], material: 'Fabric', related: ['table-rel'] });
const cat = [
  mk('table', 'coffee-table', 110, 55, { styles: ['modern'], colors: [{ name: 'brown', hex: '#7A5230' }] }),
  mk('table-nova', 'coffee-table', 110, 55, { collection: 'nova' }),
  mk('table-rel', 'coffee-table', 110, 55),
  mk('sofa2', 'sofa', 210, 95),
  mk('bed', 'bed', 163, 225, { roomTypes: ['bedroom'] }),
  mk('tv', 'tv-unit', 150, 40),
  mk('chair-a', 'chair', 70, 70), mk('chair-b', 'chair', 70, 70), mk('chair-c', 'chair', 70, 70),
  mk('wall-only', 'chair', 70, 70, { ar: { placements: ['wall'] } }),
  mk('art', 'wall-art', 50, 3, { ar: { placements: ['wall'] }, roomTypes: ['living'] }),
  mk('flagged', 'storage', 80, 40, { sizeReview: 'depth looks wrong' }),
];

{ // role quotas, filters, ranking, reasons
  const r = recommend(cat, { roomType: 'living', placed: [place(sofa)] });
  const ids = r.map((x) => x.product.id);
  assert.ok(!ids.includes('sofa2'), 'role already filled (1 sofa wanted)');
  assert.ok(!ids.includes('bed'), 'roles not wanted in a living room');
  assert.ok(!ids.includes('wall-only'), 'floor placement only');
  assert.ok(!ids.includes('flagged'), 'sizeReview items are never suggested');
  assert.ok(!ids.includes('art'), 'wall art needs a marked wall');
  assert.deepEqual(recommend([cat[0], cat[1]], { roomType: 'living', placed: [place(sofa)] }).map((x) => x.product.id), ['table-nova', 'table'], 'same-collection piece ranks above a plain one');
  assert.match(r.find((x) => x.product.id === 'table-nova')!.reasons.join(' '), /Same Nova collection/);
  assert.ok(r.filter((x) => x.product.role === 'chair').length <= 2, 'diversity cap');
  assert.deepEqual(recommend(cat, { roomType: 'living', placed: [place(sofa)] }), r, 'deterministic');
}
{ // HomeTown related boost
  const r = recommend(cat, { roomType: 'living', placed: [place(sofa)] });
  const rel = r.find((x) => x.product.id === 'table-rel')!, plain = recommend([mk('table-x', 'coffee-table', 110, 55)], { roomType: 'living', placed: [place(sofa)] })[0];
  assert.match(rel.reasons.join(' '), /Recommended by HomeTown with your sofa/);
  assert.ok(rel.score > plain.score + 0.1, 'related adds ~0.15');
}
{ // wall art once a wall is marked
  const r = recommend(cat, { roomType: 'living', placed: [place(sofa)], wallMarked: true });
  assert.ok(r.some((x) => x.product.id === 'art'));
}
{ // space filters
  assert.equal(recommend(cat, { roomType: 'living', areaM2: 3, placed: [place(sofa)] }).length, 0, 'no room left: nothing may be recommended');
  const narrow = recommend(cat, { roomType: 'living', areaM2: 30, longestWallCm: 100, placed: [place(sofa)] }).map((x) => x.product.id);
  assert.ok(!narrow.includes('table') && !narrow.includes('tv'), 'pieces wider than the free wall are dropped');
  assert.ok(narrow.includes('chair-a'));
}
{ // demo items only when nothing real fits
  const demo = mk('demo-sofa-table', 'coffee-table', 100, 50, { demo: true });
  assert.equal(recommend([demo], { roomType: 'living', placed: [place(sofa)] })[0].product.id, 'demo-sofa-table', 'fallback');
  const both = recommend([demo, mk('real', 'coffee-table', 100, 50)], { roomType: 'living', placed: [place(sofa)] }).map((x) => x.product.id);
  assert.deepEqual(both, ['real']);
}
assert.equal(recommend(cat, { roomType: 'living', placed: [place(sofa), place(cat[0]), place(cat[5]), place(cat[6]), place(cat[7])] }).filter((x) => x.product.role !== 'chair').length, 0, 'quotas filled');
{ // favourites
  const r = recommend(cat, { roomType: 'living', placed: [place(sofa)], favorites: ['chair-c'] });
  assert.match(r.find((x) => x.product.id === 'chair-c')!.reasons.join(' '), /saved/);
}
assert.equal(colourHarmony('#888888', '#B03A35'), 0.8, 'neutral goes with anything');
assert.equal(colourHarmony('#B03A35', '#D9822B'), 1, 'analogous');
assert.equal(colourHarmony(undefined, '#fff'), 0.5, 'unknown colour is neutral');

// ---- the real catalogue gives suggestions for every room type once its anchor is placed ----
const anchors: Record<RoomType, (p: Product) => boolean> = {
  living: (p) => p.role === 'sofa' && !p.sizeReview && !!p.proxy && p.dimensionsCm.w < 230,
  bedroom: (p) => p.role === 'bed' && !p.sizeReview && !!p.proxy,
  dining: (p) => p.role === 'dining-table' && !p.sizeReview && !!p.proxy,
  study: (p) => p.role === 'desk' && !p.sizeReview && !!p.proxy,
  other: (p) => p.role === 'sofa' && !p.sizeReview && !!p.proxy,
};
const show = (title: string, r: Recommendation[]) => {
  console.log(`\n${title}`);
  for (const x of r.slice(0, 5)) console.log(`  ${x.score.toFixed(3)}  ${x.product.name} (${x.product.role}) - ${x.reasons[0]}`);
};
for (const type of ['living', 'bedroom', 'dining', 'study'] as RoomType[]) {
  const a = catalogue.find(anchors[type])!;
  const r = recommend(catalogue, { roomType: type, placed: [place(a)] });
  assert.ok(r.length >= 3, `${type}: real data gives 3+ suggestions (got ${r.length})`);
  assert.ok(r.every((x) => !x.product.sizeReview && !x.product.demo && x.product.ar.placements.includes('floor')));
}
if (process.argv.includes('--show')) {
  const three = catalogue.find((p) => p.role === 'sofa' && /3[- ]seater/i.test(p.name) && !p.sizeReview && p.proxy)!;
  show(`3-seater "${three.name}" in a 16 m² living room`, recommend(catalogue, { roomType: 'living', areaM2: 16, placed: [place(three)] }));
  const queen = find('nova-queen-bed-hydraulic-storage');
  show(`"${queen.name}" in a 12 m² bedroom`, recommend(catalogue, { roomType: 'bedroom', areaM2: 12, placed: [place(queen)] }));
}
console.log('recommendation tests passed');
