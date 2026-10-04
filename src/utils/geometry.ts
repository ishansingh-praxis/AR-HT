import type { PlacedItem, Product } from '../types/furniture';

type Vec2 = [number, number];

/** Four corners (x, z in metres) of an item's floor footprint, rotated about Y. Assumes origin at footprint centre. */
export function footprint(item: PlacedItem, p: Product): Vec2[] {
  const hw = (p.dimensionsCm.w / 200) * item.scale;
  const hd = (p.dimensionsCm.d / 200) * item.scale;
  const a = (item.rotationY * Math.PI) / 180;
  // Right-handed rotation about +Y maps local x to (cos, -sin) in (x, z).
  const ux: Vec2 = [Math.cos(a), -Math.sin(a)];
  const uz: Vec2 = [Math.sin(a), Math.cos(a)];
  const [cx, , cz] = item.position;
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as Vec2[]).map(([sx, sz]) => [
    cx + sx * hw * ux[0] + sz * hd * uz[0],
    cz + sx * hw * ux[1] + sz * hd * uz[1],
  ]);
}

function project(poly: Vec2[], axis: Vec2): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const [x, z] of poly) {
    const d = x * axis[0] + z * axis[1];
    lo = Math.min(lo, d); hi = Math.max(hi, d);
  }
  return [lo, hi];
}

/** Separating-axis test for two convex rectangles. `gapM` shrinks overlap tolerance so touching isn't a collision. */
export function overlaps(a: Vec2[], b: Vec2[], gapM = 0.02): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < 2; i++) {
      const e: Vec2 = [poly[i + 1][0] - poly[i][0], poly[i + 1][1] - poly[i][1]];
      const len = Math.hypot(e[0], e[1]) || 1;
      const axis: Vec2 = [-e[1] / len, e[0] / len];
      const [a0, a1] = project(a, axis);
      const [b0, b1] = project(b, axis);
      if (a1 - gapM <= b0 || b1 - gapM <= a0) return false;
    }
  }
  return true;
}

/** uids of items that overlap at least one other item. */
export function collidingUids(items: PlacedItem[], find: (id: string) => Product | undefined): Set<string> {
  const out = new Set<string>();
  const shapes = items.map((i) => {
    const p = find(i.productId);
    return p ? footprint(i, p) : null;
  });
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const a = shapes[i], b = shapes[j];
      if (a && b && overlaps(a, b)) { out.add(items[i].uid); out.add(items[j].uid); }
    }
  return out;
}

export type Fit =
  | { status: 'fits'; spareCm: number }
  | { status: 'tight'; spareCm: number }
  | { status: 'no'; shortByCm: number };

/** Will the product's width fit a space? `clearanceCm` is the breathing room wanted on each side. */
export function checkFit(productWidthCm: number, availableCm: number, clearanceCm = 20): Fit {
  const spare = availableCm - productWidthCm;
  if (spare < 0) return { status: 'no', shortByCm: -spare };
  if (spare < clearanceCm * 2) return { status: 'tight', spareCm: spare };
  return { status: 'fits', spareCm: spare };
}

/** Rotates items about a pivot (metres, x/z) by `deg` about +Y. Positions and headings both turn. */
export function rotateLayout(items: PlacedItem[], pivot: [number, number], deg: number): PlacedItem[] {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  return items.map((it) => {
    const dx = it.position[0] - pivot[0], dz = it.position[2] - pivot[1];
    return {
      ...it,
      position: [pivot[0] + dx * c + dz * s, it.position[1], pivot[1] - dx * s + dz * c],
      rotationY: it.rotationY + deg,
    };
  });
}
