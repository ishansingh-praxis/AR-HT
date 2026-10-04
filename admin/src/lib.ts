// Pure helpers for the room editor (no React, no DOM), tested in lib.test.ts.
export const PAD = 22; // same padding as src/plan/planSvg.mjs (room for the dimension labels)
export const SNAP_CM = 5;

export const snapTo = (v: number, step = SNAP_CM) => Math.round(v / step) * step;
/** Pixels per centimetre for a plan drawn `width` px wide. */
export const scaleOf = (roomW: number, width: number) => (width - PAD) / roomW;
/** Pointer position inside the plan SVG -> room centimetres (snapped, clamped inside the room). */
export function pointToCm(px: number, py: number, room: { w: number; d: number }, width: number, step = SNAP_CM) {
  const k = scaleOf(room.w, width);
  const clamp = (v: number, hi: number) => Math.min(hi, Math.max(0, v));
  return { x: clamp(snapTo((px - PAD) / k, step), room.w), z: clamp(snapTo(py / k, step), room.d) };
}
/** Rotation kept in (-180, 180]. */
export const turn = (rot: number, by: number) => { const r = (((rot + by) % 360) + 360) % 360; return r > 180 ? r - 360 : r; };

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'room';
/** A room id that is not taken yet: living-room, living-room-2, ... */
export function uniqueId(title: string, taken: string[]) {
  const base = slugify(title).padEnd(3, 'x');
  let id = base, n = 2;
  while (taken.includes(id)) id = `${base}-${n++}`;
  return id;
}
/** Index of the piece under a point (topmost = last drawn), using each piece's rotated rectangle. */
export function pieceAt(x: number, z: number, pieces: { x: number; z: number; rot: number; w: number; d: number }[]): number {
  for (let i = pieces.length - 1; i >= 0; i--) {
    const p = pieces[i], a = (p.rot * Math.PI) / 180;
    const dx = x - p.x, dz = z - p.z;
    // into the piece's own axes (local x = (cos a, -sin a), local z = (sin a, cos a))
    const lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a);
    if (Math.abs(lx) <= p.w / 2 && Math.abs(lz) <= p.d / 2) return i;
  }
  return -1;
}
