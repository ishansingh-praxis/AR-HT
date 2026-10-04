import type { Product, SavedDesign } from '../types/furniture';

/** Rule-based: what usually goes with what. HomeTown's own related-product fields are almost empty, so this stands in. */
const PAIRS: Record<string, string[]> = {
  Sofa: ['Table', 'Chair', 'Storage'], Chair: ['Table', 'Sofa'], Table: ['Chair', 'Sofa'],
  Bed: ['Storage', 'Table', 'Wardrobe'], Wardrobe: ['Bed', 'Storage'], Storage: ['Sofa', 'Bed'],
};
const first = (s?: string) => (s ?? '').toLowerCase().split(/[\s,/]+/)[0];

/** Similar material / colour family scores higher, so suggestions match what's already in the room. */
const styleScore = (a: Product, b: Product) =>
  (first(a.material) && first(a.material) === first(b.material) ? 1 : 0) +
  (a.colorFamily && a.colorFamily === b.colorFamily ? 1 : 0) +
  (a.colors?.[0] && a.colors[0].name === b.colors?.[0]?.name ? 1 : 0);

/** Complete the look: other categories that pair with `anchor`, skipping pieces already in the room. */
export function completeLook(anchor: Product, all: Product[], placedIds: string[]): Product[] {
  const wanted = PAIRS[anchor.category] ?? [];
  return all
    .filter((p) => wanted.includes(p.category) && !placedIds.includes(p.id))
    // HomeTown's own related-products list wins, then category order, then similar style.
    .sort((a, b) => Number(!!anchor.related?.includes(b.id)) - Number(!!anchor.related?.includes(a.id)) || wanted.indexOf(a.category) - wanted.indexOf(b.category) || styleScore(anchor, b) - styleScore(anchor, a));
}

/** Alternatives: same category, closest in width first. */
export function alternatives(p: Product, all: Product[]): Product[] {
  return all.filter((x) => x.category === p.category && x.id !== p.id)
    .sort((a, b) => Math.abs(a.dimensionsCm.w - p.dimensionsCm.w) - Math.abs(b.dimensionsCm.w - p.dimensionsCm.w));
}

/** Other colours/sizes of the same product family. */
export const colourVariants = (p: Product, all: Product[]): Product[] =>
  p.linked?.length ? all.filter((x) => p.linked!.includes(x.id)) :
  // No HomeTown links: a family name like "Elba" can span a sofa, a bed and a table, so variants must also be the same category.
  p.family ? all.filter((x) => x.family === p.family && x.category === p.category && x.id !== p.id) : [];

/* ---------- Starter layouts ---------- */
export type Side = 'front' | 'left' | 'right' | 'back';
export interface Slot { productId: string; side: Side; gap: number }
/** `sub` prefers HomeTown's own segment names (e.g. "Center Tables"), so a living room gets a centre table, not a dining table. */
const LAYOUT: Record<string, { anchor: string; anchorSub?: RegExp; slots: { category: string; sub?: RegExp; side: Side; gap: number }[] }> = {
  'Living room': { anchor: 'Sofa', anchorSub: /3 seater/i, slots: [{ category: 'Table', sub: /center/i, side: 'front', gap: 0.45 }, { category: 'Chair', sub: /accent/i, side: 'left', gap: 0.25 }, { category: 'Chair', sub: /accent/i, side: 'right', gap: 0.25 }] },
  Bedroom: { anchor: 'Bed', anchorSub: /queen|king/i, slots: [{ category: 'Table', sub: /bedside/i, side: 'left', gap: 0.05 }, { category: 'Table', sub: /bedside/i, side: 'right', gap: 0.05 }, { category: 'Wardrobe', side: 'front', gap: 1.0 }] },
  'Dining room': { anchor: 'Table', anchorSub: /dining table/i, slots: [{ category: 'Chair', sub: /dining chair/i, side: 'front', gap: 0.05 }, { category: 'Chair', sub: /dining chair/i, side: 'back', gap: 0.05 }, { category: 'Storage', sub: /sideboard|bar cabinet/i, side: 'left', gap: 0.9 }] },
  Office: { anchor: 'Table', anchorSub: /study/i, slots: [{ category: 'Chair', sub: /office/i, side: 'front', gap: 0.1 }, { category: 'Storage', sub: /multipurpose|chest/i, side: 'right', gap: 0.3 }] },
};
export const anchorCategory = (room: string) => LAYOUT[room]?.anchor ?? 'Sofa';
const pick = (all: Product[], category: string, sub?: RegExp, not: Set<string> = new Set()) => {
  const inCat = all.filter((p) => p.category === category && !p.demo);
  const pool = inCat.length ? inCat : all.filter((p) => p.category === category);
  return pool.find((p) => sub?.test(p.subcategory ?? '') && !not.has(p.id)) ?? pool.find((p) => !not.has(p.id)) ?? pool[0];
};
/** The product a room type starts from when the user hasn't picked one. */
export const pickAnchor = (room: string, all: Product[]) => pick(all, anchorCategory(room), LAYOUT[room]?.anchorSub);

/** Turns "this piece goes on that side of the anchor, this far away" into positions. Front is +z at rotation 0. */
export function layoutFromSlots(a: Product, slots: Slot[], all: Product[]): SavedDesign['items'] {
  const items: SavedDesign['items'] = [{ productId: a.id, offset: [0, 0, 0], rotationY: 0, scale: 1 }];
  for (const slot of slots) {
    const p = all.find((x) => x.id === slot.productId);
    if (!p) continue;
    const aw = a.dimensionsCm.w / 200, ad = a.dimensionsCm.d / 200, pw = p.dimensionsCm.w / 200, pd = p.dimensionsCm.d / 200;
    const o: Record<Side, [number, number, number]> = {
      front: [0, 0, ad + slot.gap + pd], back: [0, 0, -(ad + slot.gap + pd)],
      left: [-(aw + slot.gap + pw), 0, 0], right: [aw + slot.gap + pw, 0, 0],
    };
    // Pieces turn to face the anchor; the model's own front is assumed to be +z.
    const rot = { front: 180, back: 0, left: 90, right: -90 }[slot.side];
    items.push({ productId: p.id, offset: o[slot.side], rotationY: rot, scale: 1 });
  }
  return items;
}

/** A ready-made layout around the user's first piece. Missing categories are skipped. */
export function buildStarter(room: string, all: Product[], anchor?: Product): SavedDesign['items'] | null {
  const spec = LAYOUT[room];
  const a = anchor ?? pickAnchor(room, all);
  if (!spec || !a) return null;
  const used = new Set([a.id]);
  const slots: Slot[] = [];
  for (const sl of spec.slots) {
    const p = pick(all, sl.category, sl.sub, used);
    if (!p) continue;
    used.add(p.id);
    slots.push({ productId: p.id, side: sl.side, gap: sl.gap });
  }
  return layoutFromSlots(a, slots, all);
}
