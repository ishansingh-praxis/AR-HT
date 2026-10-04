// Room planner logic (pure: no React / RN imports). Given a room type, a theme and a room size it picks a matching set of real products,
// places them so they fit (clear walkways, chairs around tables, a coffee table in front of the sofa...) and adds up the budget.
// Units: centimetres in the room frame (origin top-left, x right, z down). `rot` is the direction a piece FACES: 0 faces +z (down the plan),
// 180 faces -z, 90 faces +x, -90 faces -x (the same convention as src/data/rooms.json).
import type { Product } from '../types/furniture.ts';

export type KindId = 'living' | 'bedroom' | 'dining' | 'kitchen' | 'kids' | 'study';
export interface Slot {
  key: string;
  /** Pieces wanted. A function gets the number of seats of the chosen table (for dining chairs). */
  count: number | ((seats: number) => number);
  match: (p: Product) => boolean;
  /** Extra preference (higher is better), e.g. smaller beds for kids. */
  prefer?: (p: Product) => number;
}
export interface Kind { id: KindId; icon: string; room: { w: number; d: number }; slots: Slot[] }
export interface Theme { id: string; icon: string; colors: string[]; materials?: RegExp }
export interface Piece { uid: string; productId: string; x: number; z: number; rot: number }
export type Find = (id: string) => Product | undefined;

const text = (p: Product) => `${p.subcategory ?? ''} ${p.name}`.toLowerCase();
const has = (p: Product, re: RegExp) => re.test(text(p));
const area = (p: Product) => p.dimensionsCm.w * p.dimensionsCm.d;
const seatsOf = (p: Product) => Number(/(\d+)\s*seater/i.exec(text(p))?.[1] ?? 4);

export const THEMES: Theme[] = [
  { id: 'modern', icon: '🏙️', colors: ['grey', 'charcoal', 'white', 'black', 'lightgrey', 'navy', 'blue'], materials: /fabric|metal|glass|engineered/i },
  { id: 'warm', icon: '🪵', colors: ['brown', 'oak', 'teak', 'tan', 'beige', 'cream', 'walnut'], materials: /wood|sheesham|mango|teak|rubber/i },
  { id: 'classic', icon: '🏛️', colors: ['walnut', 'wenge', 'espresso', 'burgundy', 'cream', 'gold', 'brown'], materials: /solid|sheesham|leather|velvet|wood/i },
  { id: 'minimal', icon: '⚪', colors: ['white', 'cream', 'beige', 'lightgrey', 'oak'] },
  { id: 'bold', icon: '🎨', colors: ['blue', 'teal', 'mustard', 'red', 'green', 'orange', 'pink', 'yellow', 'navy', 'burgundy', 'olive'] },
];
export const getTheme = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];

const bedroomBed = (p: Product) => p.role === 'bed' && !has(p, /kid|crib|cot|bunk|sofa cum/);
export const KINDS: Kind[] = [
  { id: 'living', icon: '🛋️', room: { w: 450, d: 380 }, slots: [
    { key: 'sofa', count: 1, match: (p) => p.role === 'sofa' && has(p, /3 seater|2 seater/) },
    { key: 'coffee', count: 1, match: (p) => p.role === 'coffee-table' },
    { key: 'tv', count: 1, match: (p) => p.role === 'tv-unit' },
    { key: 'accent', count: 1, match: (p) => p.role === 'chair' && has(p, /accent|arm ?chair/) },
    { key: 'side', count: 1, match: (p) => p.role === 'side-table' && !has(p, /bedside/) },
  ] },
  { id: 'bedroom', icon: '🛏️', room: { w: 380, d: 360 }, slots: [
    { key: 'bed', count: 1, match: bedroomBed, prefer: (p) => (has(p, /queen|king/) ? 0.5 : 0) },
    { key: 'bedside', count: 2, match: (p) => p.role === 'side-table' && has(p, /bedside/) },
    { key: 'wardrobe', count: 1, match: (p) => p.role === 'wardrobe', prefer: (p) => (has(p, /3 door/) ? 0.3 : 0) },
    { key: 'dresser', count: 1, match: (p) => has(p, /dressing|chest of drawers/) },
  ] },
  { id: 'dining', icon: '🍽️', room: { w: 400, d: 360 }, slots: [
    { key: 'table', count: 1, match: (p) => p.role === 'dining-table' && has(p, /dining table|dining set/) },
    { key: 'chairs', count: (seats) => seats, match: (p) => has(p, /dining chair|dining bench/) && p.role === 'chair' },
    { key: 'storage', count: 1, match: (p) => has(p, /sideboard|crockery|bar cabinet|multipurpose cabinet/) },
  ] },
  { id: 'kitchen', icon: '🍳', room: { w: 320, d: 320 }, slots: [
    { key: 'table', count: 1, match: (p) => p.role === 'dining-table' && has(p, /dining table|dining set/) && seatsOf(p) <= 4 },
    { key: 'chairs', count: () => 4, match: (p) => has(p, /dining chair/) && p.role === 'chair' },
    { key: 'storage', count: 1, match: (p) => has(p, /bar unit|bar cabinet|crockery|trolley|pantry|sideboard/) },
  ] },
  { id: 'kids', icon: '🧸', room: { w: 330, d: 330 }, slots: [
    { key: 'bed', count: 1, match: (p) => p.role === 'bed' && !has(p, /crib|cot|sofa cum/), prefer: (p) => (has(p, /kid/) ? 2 : -area(p) / 20000) },
    { key: 'desk', count: 1, match: (p) => has(p, /study table/) },
    { key: 'chair', count: 1, match: (p) => p.role === 'chair' && has(p, /office chair|study/) },
    { key: 'wardrobe', count: 1, match: (p) => p.role === 'wardrobe', prefer: (p) => -area(p) / 20000 },
    { key: 'dresser', count: 1, match: (p) => has(p, /chest of drawers/) },
  ] },
  { id: 'study', icon: '📚', room: { w: 320, d: 300 }, slots: [
    { key: 'desk', count: 1, match: (p) => has(p, /study table|desk/) },
    { key: 'chair', count: 1, match: (p) => p.role === 'chair' && has(p, /office chair/) },
    { key: 'storage', count: 2, match: (p) => p.role === 'storage' && !has(p, /shoe|trolley|bar unit/) && p.dimensionsCm.w >= 60 },
  ] },
];
export const getKind = (id: string) => KINDS.find((k) => k.id === id) ?? KINDS[0];

// ---------------------------------------------------------------- picking the set

const isUsable = (p: Product) => !p.sizeReview && !p.demo && !!(p.model3D || p.proxy) && p.ar.placements.includes('floor') && p.category !== 'Wall';
const colourOf = (p: Product) => p.proxy?.color ?? (p.colorFamily ?? '').toLowerCase();

/** 0 to 1: how well a product suits a theme (its photo colour and material). */
export function themeScore(p: Product, theme: Theme): number {
  const c = colourOf(p);
  let s = theme.colors.includes(c) ? 0.8 - 0.05 * Math.min(theme.colors.indexOf(c), 4) : 0;
  if (theme.materials && theme.materials.test(`${p.material ?? ''} ${p.name}`)) s += 0.25;
  return Math.min(1, s);
}

export interface SuggestOptions { budgetInr?: number }

/** One product per slot (and the number of pieces wanted), chosen for theme, fit, a middle price and matching collections. */
export function suggestSet(catalogue: Product[], kind: Kind, theme: Theme, room: { w: number; d: number }, opts: SuggestOptions = {}): { productId: string; count: number; key: string }[] {
  const roomArea = room.w * room.d;
  const fits = (p: Product) => p.dimensionsCm.w <= room.w - 40 && p.dimensionsCm.d <= room.d - 40 && area(p) <= roomArea * 0.3;
  const pool = catalogue.filter((p) => isUsable(p) && fits(p));
  const chosen: { slot: Slot; ranked: Product[]; count: number }[] = [];
  let anchorCollection: string | undefined;
  let seats = 4;
  for (const slot of kind.slots) {
    const cands = pool.filter(slot.match);
    if (!cands.length) continue;
    const prices = cands.map((p) => p.priceInr ?? 0).filter(Boolean).sort((a, b) => a - b);
    const median = prices[prices.length >> 1] || 1;
    const score = (p: Product) => {
      const price = p.priceInr ?? median;
      const mid = Math.max(0, 1 - Math.abs(Math.log(price / median)) / Math.log(8));
      return 3 * themeScore(p, theme) + 1.5 * (1 - area(p) / (roomArea * 0.3)) + 0.8 * mid + (anchorCollection && p.collection === anchorCollection ? 2 : 0) + (slot.prefer?.(p) ?? 0);
    };
    const ranked = [...cands].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
    if (chosen.length === 0) anchorCollection = ranked[0].collection;
    if (slot.key === 'table') seats = seatsOf(ranked[0]);
    chosen.push({ slot, ranked, count: typeof slot.count === 'function' ? slot.count(seats) : slot.count });
  }
  // Over budget? Swap the dearest slots for the cheapest candidate that still suits the theme, until it fits or nothing changes.
  const pick = chosen.map((c) => c.ranked[0]);
  const total = () => pick.reduce((s, p, i) => s + (p.priceInr ?? 0) * setsFor(p, chosen[i].count), 0);
  if (opts.budgetInr && total() > opts.budgetInr) {
    for (let guard = 0; guard < 40 && total() > opts.budgetInr; guard++) {
      const order = pick.map((p, i) => ({ i, cost: (p.priceInr ?? 0) * setsFor(p, chosen[i].count) })).sort((a, b) => b.cost - a.cost);
      let changed = false;
      for (const { i } of order) {
        const cheaper = chosen[i].ranked.filter((p) => (p.priceInr ?? Infinity) < (pick[i].priceInr ?? 0) && themeScore(p, theme) >= 0.25)
          .sort((a, b) => (b.priceInr ?? 0) - (a.priceInr ?? 0))[0]; // the next step down, not the very cheapest
        if (cheaper) { pick[i] = cheaper; changed = true; break; }
      }
      if (!changed) break;
    }
  }
  return pick.map((p, i) => ({ productId: p.id, count: chosen[i].count, key: chosen[i].slot.key }));
}

// ---------------------------------------------------------------- budget

/** Sets needed for `pieces` of a product (6 chairs sold in 2s = 3 sets). */
export const setsFor = (p: Pick<Product, 'setSize'>, pieces: number) => (p.setSize ? Math.ceil(pieces / p.setSize) : pieces);

export interface BudgetLine { productId: string; name: string; pieces: number; sets: number; unit: number | null; subtotal: number }
export function budgetOf(pieces: { productId: string }[], find: Find): { total: number; lines: BudgetLine[]; unpriced: number } {
  const count = new Map<string, number>();
  for (const p of pieces) count.set(p.productId, (count.get(p.productId) ?? 0) + 1);
  const lines: BudgetLine[] = [];
  let unpriced = 0;
  for (const [id, n] of count) {
    const p = find(id);
    if (!p) continue;
    const sets = setsFor(p, n);
    if (!p.priceInr) unpriced++;
    lines.push({ productId: id, name: p.name, pieces: n, sets, unit: p.priceInr ?? null, subtotal: (p.priceInr ?? 0) * sets });
  }
  return { total: lines.reduce((s, l) => s + l.subtotal, 0), lines, unpriced };
}

/** Indian digit grouping: 1234567 -> "12,34,567". */
export const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

// ---------------------------------------------------------------- placing

type P2 = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
/** Four corners (cm) of a piece's floor footprint. */
export function corners(x: number, z: number, rot: number, w: number, d: number): P2[] {
  const a = rad(rot), ux: P2 = [Math.cos(a), -Math.sin(a)], uz: P2 = [Math.sin(a), Math.cos(a)];
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as P2[]).map(([sx, sz]) => [x + sx * (w / 2) * ux[0] + sz * (d / 2) * uz[0], z + sx * (w / 2) * ux[1] + sz * (d / 2) * uz[1]]);
}
const project = (poly: P2[], ax: P2): [number, number] => { let lo = Infinity, hi = -Infinity; for (const [x, z] of poly) { const v = x * ax[0] + z * ax[1]; lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; };
function overlap(a: P2[], b: P2[]): boolean {
  for (const poly of [a, b]) for (let i = 0; i < 2; i++) {
    const e: P2 = [poly[i + 1][0] - poly[i][0], poly[i + 1][1] - poly[i][1]], l = Math.hypot(e[0], e[1]) || 1, ax: P2 = [-e[1] / l, e[0] / l];
    const [a0, a1] = project(a, ax), [b0, b1] = project(b, ax);
    if (a1 <= b0 + 0.5 || b1 <= a0 + 0.5) return false;
  }
  return true;
}
const nearSeg = (p: P2, s: P2, e: P2) => { const dx = e[0] - s[0], dz = e[1] - s[1], t = Math.max(0, Math.min(1, ((p[0] - s[0]) * dx + (p[1] - s[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(p[0] - (s[0] + t * dx), p[1] - (s[1] + t * dz)); };
/** Shortest distance (cm) between two footprints; 0 when they touch or overlap. */
export function gapCm(a: P2[], b: P2[]): number {
  if (overlap(a, b)) return 0;
  let m = Infinity;
  for (const [p, q] of [[a, b], [b, a]] as [P2[], P2[]][]) for (const pt of p) for (let i = 0; i < 4; i++) m = Math.min(m, nearSeg(pt, q[i], q[(i + 1) % 4]));
  return m;
}

const TABLE_LIKE = (p: Product) => p.role === 'coffee-table' || p.role === 'dining-table' || p.role === 'chair' || p.role === 'desk' || p.role === 'side-table';
const dim = (p: Product) => p.dimensionsCm;

interface Placed extends Piece { p: Product; poly: P2[] }
const make = (uid: string, p: Product, x: number, z: number, rot: number): Placed => ({ uid, productId: p.id, x, z, rot, p, poly: corners(x, z, rot, dim(p).w, dim(p).d) });

/** A spot is valid when it is inside the room, overlaps nothing, and every gap to another piece is deliberate (touching, table reach, or a real walkway). */
function valid(room: { w: number; d: number }, c: Placed, placed: Placed[], pass = 55): boolean {
  if (c.poly.some(([x, z]) => x < -0.5 || x > room.w + 0.5 || z < -0.5 || z > room.d + 0.5)) return false;
  for (const q of placed) {
    if (overlap(c.poly, q.poly)) return false;
    const g = gapCm(c.poly, q.poly);
    const near = TABLE_LIKE(c.p) || TABLE_LIKE(q.p);
    const chairs = c.p.role === 'chair' && q.p.role === 'chair'; // chairs around a table: any small gap is fine
    if (!(g <= 12 || chairs || (near && g >= 30 && g <= 52) || g >= pass)) return false;
  }
  return true;
}

type Wall = 'top' | 'bottom' | 'left' | 'right';
const WALL_ROT: Record<Wall, number> = { top: 0, bottom: 180, left: 90, right: -90 };
/** Spots against a wall, back to the wall, facing into the room, from the middle of the wall outwards (or from a corner). */
function wallSpots(room: { w: number; d: number }, p: Product, wall: Wall, from: 'middle' | 'corner'): Placed[] {
  const rot = WALL_ROT[wall], horizontal = wall === 'top' || wall === 'bottom';
  const along = horizontal ? dim(p).w : dim(p).w, depth = dim(p).d, len = horizontal ? room.w : room.d;
  const lo = along / 2 + 3, hi = len - along / 2 - 3;
  const ts: number[] = [];
  if (from === 'middle') { const mid = len / 2; for (let k = 0; mid - k >= lo || mid + k <= hi; k += 10) { if (mid - k >= lo) ts.push(mid - k); if (k && mid + k <= hi) ts.push(mid + k); } }
  else for (let t = lo; t <= hi; t += 10) ts.push(t);
  return ts.map((t) => {
    const gap = 2;
    const x = horizontal ? t : wall === 'left' ? gap + depth / 2 : room.w - gap - depth / 2;
    const z = horizontal ? (wall === 'top' ? gap + depth / 2 : room.d - gap - depth / 2) : t;
    return make('', p, x, z, rot);
  });
}
const facing = (rot: number): P2 => [Math.sin(rad(rot)), Math.cos(rad(rot))];
const rightOf = (rot: number): P2 => [Math.cos(rad(rot)), -Math.sin(rad(rot))];
const wallFacing = (rot: number): Wall => (Math.round(rot) === 0 ? 'bottom' : Math.round(rot) === 180 ? 'top' : Math.round(rot) === 90 ? 'right' : 'left'); // the wall a piece faces

/** Candidate spots for `p` in the role `key`, in order of preference. */
function spots(room: { w: number; d: number }, key: string, p: Product, placed: Placed[], seats: number): Placed[] {
  const byKey = (k: string) => placed.find((q) => q.uid.startsWith(`${k}:`));
  const anchor = placed[0];
  const out: Placed[] = [];
  const relative = (base: Placed, along: number, forward: number, rot: number) => {
    const r = rightOf(base.rot), f = facing(base.rot);
    return make('', p, base.x + r[0] * along + f[0] * forward, base.z + r[1] * along + f[1] * forward, rot);
  };
  if (key === 'coffee' && anchor) {
    for (const gap of [45, 40, 50, 35]) out.push(relative(anchor, 0, dim(anchor.p).d / 2 + gap + dim(p).d / 2, anchor.rot));
  } else if (key === 'tv' && anchor) {
    const opp = wallFacing(anchor.rot);
    out.push(...wallSpots(room, p, opp, 'middle'));
  } else if ((key === 'side' || key === 'bedside') && anchor) {
    const n = placed.filter((q) => q.uid.startsWith(`${key}:`)).length;
    const sides = n % 2 === 0 ? [1, -1] : [-1, 1]; // fill the left and right of the anchor in turn
    for (const s of sides) out.push(relative(anchor, s * (dim(anchor.p).w / 2 + 5 + dim(p).w / 2), -(dim(anchor.p).d / 2 - dim(p).d / 2), anchor.rot));
  } else if (key === 'accent') {
    const c = byKey('coffee') ?? anchor;
    if (c) for (const s of [1, -1]) out.push(relative(c, s * (dim(c.p).w / 2 + 40 + dim(p).d / 2), 0, c.rot + (s === 1 ? -90 : 90)));
  } else if (key === 'chairs' && anchor) {
    const n = placed.filter((q) => q.uid.startsWith('chairs:')).length;
    const top = Math.ceil(seats / 2);
    const side = n < top ? -1 : 1; // first half on one long side, the rest on the other
    const idx = n < top ? n : n - top, count = n < top ? top : seats - top;
    const span = dim(anchor.p).w, step = span / Math.max(count, 1);
    out.push(relative(anchor, -span / 2 + step * (idx + 0.5), side * (dim(anchor.p).d / 2 + 5 + dim(p).d / 2), anchor.rot + (side === 1 ? 180 : 0)));
    // tables with a short side: chairs at the ends
    for (const e of [1, -1]) out.push(relative(anchor, e * (dim(anchor.p).w / 2 + 5 + dim(p).d / 2), (idx - (count - 1) / 2) * 20, anchor.rot - e * 90));
  } else if (key === 'chair' && (byKey('desk') ?? anchor)) { // desk chair, pushed up to the desk
    const desk = (byKey('desk') ?? anchor)!;
    for (const gap of [3, 12, 25]) for (const off of [0, 25, -25]) out.push(relative(desk, off, dim(desk.p).d / 2 + dim(p).d / 2 + gap, desk.rot + 180));
  } else if (!anchor) { // the first piece (the anchor)
    const walls: Wall[] = room.w >= room.d ? ['top', 'bottom', 'left', 'right'] : ['left', 'right', 'top', 'bottom'];
    if (key === 'table') out.push(make('', p, room.w / 2, room.d / 2, 0), make('', p, room.w / 2, room.d / 2, 90));
    else for (const w of walls) out.push(...wallSpots(room, p, w, 'middle'));
  }
  // everything else (wardrobes, storage, dressers, whatever could not go next to its partner) goes against a wall, corners first
  if (key === 'chairs' || key === 'chair' || key === 'coffee') return out; // no corner fallback for these
  for (const w of (['left', 'right', 'bottom', 'top'] as Wall[])) out.push(...wallSpots(room, p, w, 'corner'));
  return out;
}

/**
 * Places `items` (productId + count, anchor first) in the room. Returns the placed pieces and the product ids that did not fit.
 * Deterministic: the same input gives the same layout.
 */
export function autoPlace(room: { w: number; d: number }, items: { productId: string; count: number; key: string }[], find: Find, seats = 4, variant = 0): { pieces: Piece[]; unplaced: string[] } {
  const placed: Placed[] = [];
  const unplaced: string[] = [];
  let n = 0;
  for (const it of items) {
    const p = find(it.productId);
    if (!p) continue;
    for (let i = 0; i < it.count; i++) {
      const cands = spots(room, it.key, p, placed, seats);
      const ok = cands.filter((c) => valid(room, c, placed));
      // variant 0 takes the best anchor spot; later variants move the anchor along its walls so the rest may fit
      const spot = placed.length === 0 && variant > 0 ? ok[Math.min(ok.length - 1, Math.floor((variant * ok.length) / VARIANTS))] : ok[0];
      if (spot) placed.push({ ...spot, uid: `${it.key}:${n++}` });
      else unplaced.push(p.id);
    }
  }
  return { pieces: placed.map(({ uid, productId, x, z, rot }, i) => ({ uid: `s${i}`, productId, x: Math.round(x), z: Math.round(z), rot })), unplaced };
}

const VARIANTS = 8;
/** The whole thing: pick a set for the room and theme, and place it. */
export function designRoom(catalogue: Product[], kind: Kind, theme: Theme, room: { w: number; d: number }, find: Find, opts: SuggestOptions = {}) {
  const set = suggestSet(catalogue, kind, theme, room, opts);
  const table = set.find((x) => x.key === 'table');
  const tp = table && find(table.productId);
  const seats = tp ? seatsOf(tp) : 4;
  let best = autoPlace(room, set, find, seats, 0);
  for (let v = 1; v < VARIANTS && best.unplaced.length > 0; v++) {
    const r = autoPlace(room, set, find, seats, v);
    if (r.unplaced.length < best.unplaced.length) best = r;
  }
  return { set, pieces: best.pieces, unplaced: best.unplaced };
}

/** One more piece of `p` somewhere sensible in a room that already has pieces (used by the + button). Null when there is no space. */
export function placeAnother(room: { w: number; d: number }, existing: Piece[], p: Product, find: Find): Piece | null {
  const placed = existing.flatMap((e) => { const q = find(e.productId); return q ? [make(e.uid, q, e.x, e.z, e.rot)] : []; });
  const cands: Placed[] = [];
  for (const w of ['left', 'right', 'bottom', 'top'] as Wall[]) cands.push(...wallSpots(room, p, w, 'corner'));
  for (let x = 60; x < room.w - 40; x += 20) for (let z = 60; z < room.d - 40; z += 20) cands.push(make('', p, x, z, 0));
  const spot = cands.find((c) => valid(room, c, placed, 45));
  return spot ? { uid: `s${Date.now().toString(36)}${placed.length}`, productId: p.id, x: Math.round(spot.x), z: Math.round(spot.z), rot: spot.rot } : null;
}
