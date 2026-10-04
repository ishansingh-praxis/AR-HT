// Usage: node scripts/build-rooms.mjs   -> writes src/data/rooms.json from scripts/rooms/curation.mjs and src/data/catalogue.json.
import fs from 'node:fs';
import { ROOMS } from './rooms/curation.mjs';

const catalogue = JSON.parse(fs.readFileSync('src/data/catalogue.json', 'utf8'));
const byId = new Map(catalogue.map((p) => [p.id, p]));
const r1 = (n) => Math.round(n * 10) / 10;

function resolve(room, pc) {
  const p = byId.get(pc.h);
  if (!p) throw new Error(`${room.id}: product not in catalogue: ${pc.h}`);
  if (p.sizeReview || !(p.proxy || p.model3D)) throw new Error(`${room.id}: ${pc.h} is not placeable`);
  if (!pc.wall) return { productId: pc.h, x: pc.x, z: pc.z, rot: pc.rot, anchor: !!pc.anchor };
  const { d } = p.dimensionsCm;
  const { w: W, d: D } = room.room;
  const g = pc.gap ?? 0;
  const spec = {
    top: { x: pc.at, z: d / 2 + g, rot: 0 },
    bottom: { x: pc.at, z: D - d / 2 - g, rot: 180 },
    left: { x: d / 2 + g, z: pc.at, rot: 90 },
    right: { x: W - d / 2 - g, z: pc.at, rot: -90 },
  }[pc.wall];
  return { productId: pc.h, x: r1(spec.x), z: r1(spec.z), rot: spec.rot, anchor: !!pc.anchor };
}

const rooms = ROOMS.map((r) => ({
  id: r.id, title: r.title, roomType: r.roomType, style: r.style, blurb: r.blurb, notes: r.notes, roomCm: r.room, door: r.door,
  pieces: r.pieces.map((pc) => resolve(r, pc)),
}));
fs.writeFileSync('src/data/rooms.json', JSON.stringify(rooms, null, 1));
for (const r of rooms) console.log(`${r.id}: ${r.roomCm.w}x${r.roomCm.d} cm (${((r.roomCm.w * r.roomCm.d) / 1e4).toFixed(1)} m2), ${r.pieces.length} pieces`);
