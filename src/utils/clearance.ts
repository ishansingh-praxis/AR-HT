import { footprint, overlaps } from './geometry.ts';
import type { PlacedItem, Product } from '../types/furniture';

export const WALKWAY_M = 0.6;

/** Gaps narrower than this are not a passage at all (a bedside table beside a bed), so they aren't flagged. */
const MIN_PASSAGE_M = 0.25;
/** Tables and chairs are meant to sit close to other pieces, so only big pieces (sofa, bed, wardrobe, storage) are checked. */
const EXEMPT = new Set(['Table', 'Chair']);

/** Pieces separated by 25-60 cm: a gap too tight to walk through comfortably. */
export function narrowUids(items: PlacedItem[], find: (id: string) => Product | undefined): Set<string> {
  const out = new Set<string>();
  const shapes = items.map((i) => { const p = find(i.productId); return p ? footprint(i, p) : null; });
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const a = shapes[i], b = shapes[j];
      // overlaps() with a negative gap inflates both rectangles, so "overlap" here means "closer than 60 cm".
      const ca = find(items[i].productId)?.category ?? '', cb = find(items[j].productId)?.category ?? '';
      if (EXEMPT.has(ca) || EXEMPT.has(cb)) continue;
      if (a && b && !overlaps(a, b, -MIN_PASSAGE_M) && overlaps(a, b, -WALKWAY_M)) { out.add(items[i].uid); out.add(items[j].uid); }
    }
  return out;
}

/** Floor area (m²) and longest side of the corners the user marked on the floor, as [x, z] points. */
export function roomStats(pts: [number, number][]): { area: number; maxSpan: number; walls: number[] } {
  let a = 0, span = 0;
  const walls: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
    a += x1 * z2 - x2 * z1;
    walls.push(Math.hypot(x2 - x1, z2 - z1));
    for (const [x3, z3] of pts) span = Math.max(span, Math.hypot(x1 - x3, z1 - z3));
  }
  return { area: Math.abs(a) / 2, maxSpan: span, walls };
}

/** Would `p` fit in the measured room alongside what is already placed? Uses area and the longest span; it does not know the room's shape. */
export function fitsRoom(p: Product, room: { area: number; maxSpan: number }, usedM2: number): boolean {
  const w = p.dimensionsCm.w / 100, d = p.dimensionsCm.d / 100;
  return w * d <= (room.area - usedM2) * 0.5 && Math.max(w, d) <= room.maxSpan;
}
