import type { PlacedItem, Product, Role, RoomType } from '../types/furniture';

export interface RoomContext {
  roomType: RoomType;
  /** Usable floor area in m² (from a scan or the user's size choice). Unknown = no space filter. */
  areaM2?: number;
  placed: { product: Product; item: PlacedItem }[];
  favorites?: string[];
  maxResults?: number;
}
export interface Recommendation { product: Product; score: number; reasons: string[] }

/** How many of each role a finished room of this type wants. */
export const WANTED: Record<RoomType, Partial<Record<Role, number>>> = {
  living: { sofa: 1, 'coffee-table': 1, 'tv-unit': 1, chair: 2, 'side-table': 2, storage: 1, rug: 1, lamp: 1 },
  bedroom: { bed: 1, 'side-table': 2, wardrobe: 1, storage: 1, chair: 1, rug: 1, lamp: 2 },
  dining: { 'dining-table': 1, chair: 6, storage: 1, lamp: 1 },
  study: { desk: 1, chair: 2, storage: 2, 'side-table': 1, lamp: 1 },
  other: { sofa: 1, chair: 2, 'coffee-table': 1, 'side-table': 1, storage: 1 },
};
export const ROLE_LABEL: Record<Role, string> = {
  sofa: 'sofa', bed: 'bed', chair: 'chair', 'coffee-table': 'coffee table', 'side-table': 'side table',
  'dining-table': 'dining table', desk: 'desk', 'tv-unit': 'TV unit', wardrobe: 'wardrobe',
  storage: 'storage unit', rug: 'rug', lamp: 'lamp', decor: 'decor',
};
const WALK_SHARE = 0.55; // furniture may cover at most this share of the floor, the rest is for walking

const footprintM2 = (p: Product) => (p.dimensionsCm.w * p.dimensionsCm.d) / 10000;

function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

/** 0..1. Neutrals go with everything; otherwise reward analogous (close hue) or complementary (opposite) colours. */
export function colourHarmony(a: string | undefined, b: string | undefined): number {
  const A = a ? hexToHsl(a) : null, B = b ? hexToHsl(b) : null;
  if (!A || !B) return 0.5;
  const neutral = (x: [number, number, number]) => x[1] < 0.15 || x[2] < 0.12 || x[2] > 0.9;
  if (neutral(A) || neutral(B)) return 0.8;
  const diff = Math.abs(A[0] - B[0]);
  const hue = Math.min(diff, 360 - diff);
  return hue <= 40 ? 1 : hue >= 150 ? 0.85 : 0.5;
}

export function recommend(catalogue: Product[], ctx: RoomContext): Recommendation[] {
  const wanted = WANTED[ctx.roomType];
  const count: Partial<Record<Role, number>> = {};
  let used = 0;
  for (const { product } of ctx.placed) { count[product.role] = (count[product.role] ?? 0) + 1; used += footprintM2(product); }

  const placedStyles = new Set(ctx.placed.flatMap((x) => x.product.styles));
  const placedFamilies = new Set(ctx.placed.map((x) => x.product.family).filter(Boolean) as string[]);
  const anchor = ctx.placed.reduce<Product | null>((m, x) => (!m || footprintM2(x.product) > footprintM2(m) ? x.product : m), null);
  const fav = new Set(ctx.favorites ?? []);

  const scored: Recommendation[] = [];
  for (const p of catalogue) {
    const quota = wanted[p.role];
    if (!quota) continue;                                             // not part of this kind of room
    if ((count[p.role] ?? 0) >= quota) continue;                      // role already filled
    if (!p.ar.placements.includes('floor')) continue;                 // AR only places on the floor for now
    if (p.roomTypes.length && !p.roomTypes.includes(ctx.roomType)) continue;
    if (ctx.areaM2 && used + footprintM2(p) > ctx.areaM2 * WALK_SHARE) continue; // hard fit filter

    const reasons: string[] = [];
    const missing = (count[p.role] ?? 0) === 0;
    const need = missing ? 1 : 0.5;
    if (missing && ctx.placed.length) reasons.push(`Adds the ${ROLE_LABEL[p.role]} this room doesn't have yet`);

    const family = p.family && placedFamilies.has(p.family) ? 1 : 0;
    if (family) reasons.push(`Same ${p.family![0].toUpperCase()}${p.family!.slice(1)} collection as your ${ROLE_LABEL[ctx.placed.find((x) => x.product.family === p.family)!.product.role]}`);

    let style = 0.5;
    if (placedStyles.size && p.styles.length) {
      const shared = p.styles.filter((s) => placedStyles.has(s));
      style = shared.length / p.styles.length;
      if (shared.length) reasons.push(`Matches the ${shared[0]} style`);
    }

    let palette = 0.5;
    const hex = p.colors[0]?.hex;
    if (ctx.placed.length && hex) {
      palette = Math.max(...ctx.placed.map((x) => colourHarmony(hex, x.product.colors[0]?.hex)));
      if (palette >= 0.85 && anchor?.colors[0]) reasons.push(`Colours go well with your ${ROLE_LABEL[anchor.role]}`);
    }

    let size = 0.5;
    if (anchor) size = Math.min(1, footprintM2(anchor) / Math.max(footprintM2(p), 0.01));
    const favScore = fav.has(p.id) ? 1 : 0;
    if (favScore) reasons.push('You saved this');
    if (ctx.areaM2) reasons.push('Leaves room to walk around');

    const score = 0.35 * need + 0.2 * family + 0.15 * style + 0.15 * palette + 0.1 * size + 0.05 * favScore;
    scored.push({ product: p, score: Math.round(score * 1000) / 1000, reasons: reasons.length ? reasons : ['Fits this kind of room'] });
  }

  scored.sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id));
  // Diversity: at most 2 per role, so five near-identical sofas don't fill the list.
  const perRole: Partial<Record<Role, number>> = {};
  const out: Recommendation[] = [];
  for (const r of scored) {
    const n = perRole[r.product.role] ?? 0;
    if (n >= 2) continue;
    perRole[r.product.role] = n + 1;
    out.push(r);
    if (out.length >= (ctx.maxResults ?? 6)) break;
  }
  return out;
}
