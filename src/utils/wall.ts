/** A wall the user marked by tapping two points where it meets the floor. Pure maths: no AR library needed. */
export type V3 = [number, number, number];
export interface Wall { a: V3; b: V3; flip: boolean }

const sub = (p: V3, q: V3): V3 => [p[0] - q[0], 0, p[2] - q[2]];
export const wallLength = (w: Wall) => Math.hypot(w.b[0] - w.a[0], w.b[2] - w.a[2]);
/** Unit vector along the wall, on the floor plane. */
export const wallDir = (w: Wall): V3 => { const d = sub(w.b, w.a), l = Math.hypot(d[0], d[2]) || 1; return [d[0] / l, 0, d[2] / l]; };
/** Horizontal unit normal pointing into the room (flip swaps sides). */
export const wallNormal = (w: Wall): V3 => { const d = wallDir(w), s = w.flip ? -1 : 1; return [-d[2] * s, 0, d[0] * s]; };

export const HANG_CENTRE_M = 1.45; // typical eye-level centre for frames, mirrors and clocks

/**
 * Where a wall piece goes when the user aims at `hit` (a floor point near the wall): slid along the wall to the
 * nearest point (kept fully on the wall), standing off by half its thickness, centred at eye height, facing into the room.
 * rotationY uses the convention that +z (the model's front) maps to (sin a, 0, cos a).
 */
export function hangOnWall(w: Wall, hit: V3, size: { w: number; h: number; d: number }, centreY = HANG_CENTRE_M) {
  const len = wallLength(w), dir = wallDir(w), n = wallNormal(w);
  const halfW = size.w / 200;
  const t = Math.min(Math.max((hit[0] - w.a[0]) * dir[0] + (hit[2] - w.a[2]) * dir[2], Math.min(halfW, len / 2)), Math.max(len - halfW, len / 2));
  const off = size.d / 200 + 0.005;
  const bottom = Math.min(Math.max(centreY - size.h / 200, 0.1), 2.4 - size.h / 100);
  const position: V3 = [w.a[0] + dir[0] * t + n[0] * off, w.a[1] + bottom, w.a[2] + dir[2] * t + n[2] * off];
  return { position, rotationY: (Math.atan2(n[0], n[2]) * 180) / Math.PI };
}
