import type { PlacedItem, RoomPiece, SampleRoom } from '../types/furniture';

export interface RoomBox {
  widthCm: number;       // long side
  depthCm: number;       // short side
  areaM2: number;        // polygon area from the marked corners
  rectangularity: number; // polygon area / bounding-rectangle area; below ~0.9 means an irregular room
  centre: [number, number]; // metres, AR world x/z
  yawDeg: number;        // Y rotation that turns local +x onto the room's long axis
  corners: number;
}

/** Room from floor corners marked in AR (metres, x/z). Uses the minimum-area bounding rectangle, so it works at any angle. */
export function roomFromCorners(pts: [number, number][]): RoomBox | null {
  if (pts.length < 3) return null;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
    area += x1 * z2 - x2 * z1;
  }
  area = Math.abs(area) / 2;

  const extents = (t: number) => {
    const ux = Math.cos(t), uz = Math.sin(t);
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, z] of pts) {
      const u = x * ux + z * uz, v = -x * uz + z * ux;
      a0 = Math.min(a0, u); a1 = Math.max(a1, u); b0 = Math.min(b0, v); b1 = Math.max(b1, v);
    }
    return { t, a0, a1, b0, b1, area: (a1 - a0) * (b1 - b0) };
  };
  let best = extents(0);
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
    if (Math.hypot(x2 - x1, z2 - z1) < 1e-6) continue;
    const e = extents(Math.atan2(z2 - z1, x2 - x1));
    if (e.area < best.area) best = e;
  }
  if (best.b1 - best.b0 > best.a1 - best.a0) best = extents(best.t + Math.PI / 2); // long axis = x
  const ux = Math.cos(best.t), uz = Math.sin(best.t);
  const mu = (best.a0 + best.a1) / 2, mv = (best.b0 + best.b1) / 2;
  let yaw = (-best.t * 180) / Math.PI;
  yaw = ((((yaw + 180) % 360) + 360) % 360) - 180;
  return {
    widthCm: (best.a1 - best.a0) * 100,
    depthCm: (best.b1 - best.b0) * 100,
    areaM2: area,
    rectangularity: best.area > 0 ? area / best.area : 0,
    centre: [mu * ux - mv * uz, mu * uz + mv * ux],
    yawDeg: yaw,
    corners: pts.length,
  };
}

/** Does the sample layout fit inside the room when turned `k` quarter turns? `marginCm` is spare room per axis. */
export function layoutFits(layout: SampleRoom['roomCm'], room: RoomBox, k: number, marginCm = 0): boolean {
  const odd = Math.abs(k) % 2 === 1;
  const w = odd ? layout.d : layout.w, d = odd ? layout.w : layout.d;
  return w + marginCm <= room.widthCm && d + marginCm <= room.depthCm;
}

/** Puts a sample layout into a scanned room, centred, aligned to its walls, turned `k` quarter turns. */
export function placeLayout(layout: Pick<SampleRoom, 'roomCm' | 'pieces'>, room: RoomBox, k: number, uidPrefix = 'L'): PlacedItem[] {
  const phi = room.yawDeg + k * 90;
  const a = (phi * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  const lcx = layout.roomCm.w / 2, lcz = layout.roomCm.d / 2;
  return layout.pieces.map((p: RoomPiece, i) => {
    const dx = (p.x - lcx) / 100, dz = (p.z - lcz) / 100;
    return {
      uid: `${uidPrefix}${i}`,
      productId: p.productId,
      position: [room.centre[0] + dx * c + dz * s, 0, room.centre[1] - dx * s + dz * c] as [number, number, number],
      rotationY: p.rot + phi,
      scale: 1,
    };
  });
}
