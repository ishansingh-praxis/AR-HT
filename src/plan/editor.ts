// Pure logic for the 2D plan editor (no React / RN / Viro imports). Plan coordinates: centimetres, x to the right, z DOWN the page
// (the "north" wall is z = 0). Designs saved from the plan use the SAME `items[]` as AR: offsets in metres from the first piece
// and rotationY in degrees, so a design opens in either place. See also src/plan/planSvg.mjs for the drawing.
import { PRESET_AREA, type SizePreset } from '../utils/area.ts';
import type { PlacedItem, Product, SavedDesign } from '../types/furniture';

export const SNAP_CM = 5;
export const MIN_ROOM_CM = 150;
export const MAX_ROOM_CM = 2000;

export interface PlanPiece { uid: string; productId: string; x: number; z: number; rot: number }
export interface RoomSize { w: number; d: number }
export type Wall = 'north' | 'south' | 'west' | 'east';

export const snapCm = (v: number, step = SNAP_CM) => Math.round(v / step) * step;
/** Rotation kept in (-180, 180]. */
export const turnDeg = (rot: number, by: number) => { const r = (((rot + by) % 360) + 360) % 360; return r > 180 ? r - 360 : r; };
export const clampRoom = (v: number) => Math.min(MAX_ROOM_CM, Math.max(MIN_ROOM_CM, Math.round(v)));

/** Room size to start with: a scan if there is one, else a 4:3 rectangle of the chosen size preset, else 4 x 3.5 m. */
export function defaultRoom(scan?: { widthCm: number; depthCm: number } | null, preset: SizePreset = 'unknown'): RoomSize {
  if (scan) return { w: clampRoom(scan.widthCm), d: clampRoom(scan.depthCm) };
  const area = PRESET_AREA[preset];
  if (area) { const d = Math.sqrt((area * 1e4) / (4 / 3)); return { w: clampRoom(d * (4 / 3)), d: clampRoom(d) }; }
  return { w: 400, d: 350 };
}

// ---- plan <-> design (the same data the AR screen saves) ----

/** Plan pieces as placed items in metres (what collision / walkway checks and the AR history hook use). */
export const toPlaced = (pieces: PlanPiece[]): PlacedItem[] =>
  pieces.map((p) => ({ uid: p.uid, productId: p.productId, position: [p.x / 100, 0, p.z / 100], rotationY: p.rot, scale: 1 }));
/** Rounds away float noise from metre/centimetre conversions (0.01 cm). */
const cm = (v: number) => Math.round(v * 100) / 100;
export const fromPlaced = (items: PlacedItem[]): PlanPiece[] =>
  items.map((i) => ({ uid: i.uid, productId: i.productId, x: cm(i.position[0] * 100), z: cm(i.position[2] * 100), rot: i.rotationY }));

/** Saved-design items: offsets in metres from the first piece, like AR's "offset from first piece" mode. */
export function planToItems(pieces: PlanPiece[]): SavedDesign['items'] {
  if (!pieces.length) return [];
  const o = pieces[0];
  return pieces.map((p) => ({ productId: p.productId, offset: [(p.x - o.x) / 100, 0, (p.z - o.z) / 100] as [number, number, number], rotationY: p.rot, scale: 1 }));
}

/** Plan pieces for a saved design, with the first piece at `origin` (cm). Offsets keep their exact spacing. */
export function itemsToPlan(items: SavedDesign['items'], origin: { x: number; z: number }, uidPrefix = 'p'): PlanPiece[] {
  return items.map((it, i) => ({ uid: `${uidPrefix}${i}`, productId: it.productId, x: origin.x + it.offset[0] * 100, z: origin.z + it.offset[2] * 100, rot: it.rotationY }));
}

/** Room size and origin that hold a saved design with a 60 cm margin; a bigger scanned room is used when it fits. */
export function fitRoomToItems(items: SavedDesign['items'], find: (id: string) => Product | undefined, scan?: { widthCm: number; depthCm: number } | null): { room: RoomSize; origin: { x: number; z: number } } {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const it of items) {
    const p = find(it.productId);
    if (!p) continue;
    const a = (it.rotationY * Math.PI) / 180, hw = (p.dimensionsCm.w * it.scale) / 2, hd = (p.dimensionsCm.d * it.scale) / 2;
    const ex = Math.abs(Math.cos(a)) * hw + Math.abs(Math.sin(a)) * hd, ez = Math.abs(Math.sin(a)) * hw + Math.abs(Math.cos(a)) * hd;
    const x = it.offset[0] * 100, z = it.offset[2] * 100;
    minX = Math.min(minX, x - ex); maxX = Math.max(maxX, x + ex); minZ = Math.min(minZ, z - ez); maxZ = Math.max(maxZ, z + ez);
  }
  if (!Number.isFinite(minX)) return { room: defaultRoom(scan), origin: { x: 200, z: 175 } };
  let w = maxX - minX + 120, d = maxZ - minZ + 120;
  if (scan && scan.widthCm >= w && scan.depthCm >= d) { w = scan.widthCm; d = scan.depthCm; }
  w = clampRoom(w); d = clampRoom(d);
  // centre the layout in the room
  return { room: { w, d }, origin: { x: w / 2 - (minX + maxX) / 2, z: d / 2 - (minZ + maxZ) / 2 } };
}

// ---- geometry of one piece in the plan ----

/** Half-extent of the piece's rotated rectangle on each axis (cm). */
export function halfExtent(p: { rot: number }, dims: { w: number; d: number }) {
  const a = (p.rot * Math.PI) / 180;
  return { x: Math.abs(Math.cos(a)) * dims.w / 2 + Math.abs(Math.sin(a)) * dims.d / 2, z: Math.abs(Math.sin(a)) * dims.w / 2 + Math.abs(Math.cos(a)) * dims.d / 2 };
}

/** Distance (cm) from the piece's outline to each wall, and the nearest one. Negative = it sticks out. */
export function wallDistances(p: { x: number; z: number; rot: number }, dims: { w: number; d: number }, room: RoomSize) {
  const e = halfExtent(p, dims);
  const dist: Record<Wall, number> = { north: p.z - e.z, south: room.d - (p.z + e.z), west: p.x - e.x, east: room.w - (p.x + e.x) };
  const nearest = (Object.keys(dist) as Wall[]).reduce((a, b) => (dist[b] < dist[a] ? b : a));
  return { ...dist, nearest, nearestCm: dist[nearest] };
}

/** Keeps a piece inside the room (centre moved just enough). */
export function clampInside(p: { x: number; z: number; rot: number }, dims: { w: number; d: number }, room: RoomSize) {
  const e = halfExtent(p, dims);
  const hi = (limit: number, half: number) => Math.max(half, limit - half);
  return { x: Math.min(hi(room.w, e.x), Math.max(e.x, p.x)), z: Math.min(hi(room.d, e.z), Math.max(e.z, p.z)) };
}

/** Screen reader description: "Sofa, 202 by 89 cm, 45 cm from the north wall". */
export function describePiece(name: string, p: { x: number; z: number; rot: number }, dims: { w: number; d: number }, room: RoomSize): string {
  const w = wallDistances(p, dims, room);
  const cm = Math.round(Math.abs(w.nearestCm));
  return `${name}, ${Math.round(dims.w)} by ${Math.round(dims.d)} cm, ${w.nearestCm < 0 ? `${cm} cm outside the ${w.nearest} wall` : `${cm} cm from the ${w.nearest} wall`}`;
}

/** Move by whole steps in a compass direction (accessibility actions and arrow buttons). z grows downwards, so north is -z. */
export function nudge(p: { x: number; z: number }, dir: Wall, stepCm = 25) {
  return { x: p.x + (dir === 'east' ? stepCm : dir === 'west' ? -stepCm : 0), z: p.z + (dir === 'south' ? stepCm : dir === 'north' ? -stepCm : 0) };
}

/** Pan/zoom of the canvas: screen point -> plan cm, given the canvas transform. */
export function screenToPlan(sx: number, sy: number, view: { scale: number; tx: number; ty: number }, pxPerCm: number, pad = 0) {
  return { x: ((sx - view.tx) / view.scale - pad) / pxPerCm, z: ((sy - view.ty) / view.scale) / pxPerCm };
}
export const clampScale = (s: number) => Math.min(4, Math.max(0.5, s));
