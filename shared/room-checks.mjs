// Integrity checks for a sample room (pure, no I/O). The same rules as scripts/rooms.test.ts, so the admin room editor
// shows live exactly what would fail the build: one anchor, everything inside the room, no overlaps, no awkward gaps,
// and a 60 cm walkway from the door to the front of the anchor piece. Units: centimetres in, metres inside the maths.

/** Four corners [x, z] (metres) of a piece's footprint. rot 0 faces +z; Viro right-handed rotation about Y. */
export function corners(piece, product) {
  const hw = product.dimensionsCm.w / 200, hd = product.dimensionsCm.d / 200;
  const a = (piece.rot * Math.PI) / 180;
  const ux = [Math.cos(a), -Math.sin(a)], uz = [Math.sin(a), Math.cos(a)];
  const cx = piece.x / 100, cz = piece.z / 100;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [cx + sx * hw * ux[0] + sz * hd * uz[0], cz + sx * hw * ux[1] + sz * hd * uz[1]]);
}

const project = (poly, axis) => { let lo = Infinity, hi = -Infinity; for (const [x, z] of poly) { const d = x * axis[0] + z * axis[1]; lo = Math.min(lo, d); hi = Math.max(hi, d); } return [lo, hi]; };
/** Separating-axis overlap of two rectangles; touching within `gapM` is not an overlap. */
function overlaps(a, b, gapM = 0.02) {
  for (const poly of [a, b]) for (let i = 0; i < 2; i++) {
    const e = [poly[i + 1][0] - poly[i][0], poly[i + 1][1] - poly[i][1]], len = Math.hypot(e[0], e[1]) || 1, axis = [-e[1] / len, e[0] / len];
    const [a0, a1] = project(a, axis), [b0, b1] = project(b, axis);
    if (a1 - gapM <= b0 || b1 - gapM <= a0) return false;
  }
  return true;
}
const nearSeg = (p, s, e) => { const dx = e[0] - s[0], dz = e[1] - s[1], t = Math.max(0, Math.min(1, ((p[0] - s[0]) * dx + (p[1] - s[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(p[0] - (s[0] + t * dx), p[1] - (s[1] + t * dz)); };
const gapCm = (a, b) => {
  let m = Infinity;
  for (const [p, q] of [[a, b], [b, a]]) for (const pt of p) for (let i = 0; i < 4; i++) m = Math.min(m, nearSeg(pt, q[i], q[(i + 1) % 4]));
  return m * 100;
};
const inside = (p, q) => { let sign = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4], c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]); if (c !== 0) { if (sign && Math.sign(c) !== sign) return false; sign = Math.sign(c); } } return true; };
const distToQuad = (p, q) => { if (inside(p, q)) return 0; let m = Infinity; for (let i = 0; i < 4; i++) m = Math.min(m, nearSeg(p, q[i], q[(i + 1) % 4])); return m; };

/**
 * @param room { roomCm:{w,d}, pieces:{productId,x,z,rot,anchor}[], door?:{wall,at} }
 * @param find (id) => product | undefined
 * @returns {{ problems: string[], pieceProblems: Record<number, string[]> }}  messages in plain English
 */
export function checkRoom(room, find) {
  const problems = [], pieceProblems = {};
  const flag = (i, msg) => { problems.push(msg); (pieceProblems[i] ??= []).push(msg); };
  const { w: W, d: D } = room.roomCm;
  const anchors = room.pieces.filter((p) => p.anchor).length;
  if (anchors !== 1) problems.push(`A room needs exactly one anchor piece (it has ${anchors}).`);
  const fp = room.pieces.map((p, i) => {
    const prod = find(p.productId);
    if (!prod) { flag(i, `Unknown product ${p.productId}.`); return null; }
    if (prod.sizeReview || !(prod.proxy || prod.model3D)) flag(i, `${prod.name} is not placeable (size needs review).`);
    const q = corners(p, prod);
    if (q.some(([x, z]) => x * 100 < -1 || x * 100 > W + 1 || z * 100 < -1 || z * 100 > D + 1)) flag(i, `${prod.name} sticks out of the room.`);
    return q;
  });
  for (let i = 0; i < fp.length; i++) for (let j = i + 1; j < fp.length; j++) {
    if (!fp[i] || !fp[j]) continue;
    const a = find(room.pieces[i].productId), b = find(room.pieces[j].productId);
    if (overlaps(fp[i], fp[j])) { flag(i, `${a.name} overlaps ${b.name}.`); flag(j, `${b.name} overlaps ${a.name}.`); continue; }
    if (room.pieces[i].productId === room.pieces[j].productId) continue;
    const g = gapCm(fp[i], fp[j]);
    // intentional gaps only: touching (<=12 cm), table reach (35-50 cm) or a real walkway (>=60 cm)
    if (!(g <= 12 || (g >= 35 && g <= 50) || g >= 60)) { flag(i, `${a.name} and ${b.name} leave an awkward ${g.toFixed(0)} cm gap.`); flag(j, `${b.name} and ${a.name} leave an awkward ${g.toFixed(0)} cm gap.`); }
  }
  // 60 cm walkway from the door to the front of the anchor (grid search, 30 cm clearance either side)
  const ai = room.pieces.findIndex((p) => p.anchor);
  if (ai >= 0 && fp.every(Boolean)) {
    const a = room.pieces[ai], ap = find(a.productId);
    const near = { top: a.z, bottom: D - a.z, left: a.x, right: W - a.x };
    const nearest = Object.keys(near).sort((x, y) => near[x] - near[y])[0];
    const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[nearest];
    const door = room.door ?? { wall: opposite, at: opposite === 'top' || opposite === 'bottom' ? W / 2 : D / 2 };
    const start = { top: [door.at, 40], bottom: [door.at, D - 40], left: [40, door.at], right: [W - 40, door.at] }[door.wall];
    const rad = (a.rot * Math.PI) / 180, front = [a.x + Math.sin(rad) * (ap.dimensionsCm.d / 2 + 50), a.z + Math.cos(rad) * (ap.dimensionsCm.d / 2 + 50)];
    const free = (x, z) => x >= 0 && z >= 0 && x <= W && z <= D && fp.every((q) => distToQuad([x / 100, z / 100], q) * 100 >= 30);
    if (!free(start[0], start[1])) problems.push('The door area is blocked.');
    else {
      const key = (x, z) => `${x},${z}`, seen = new Set([key(start[0], start[1])]), queue = [start];
      let reached = false;
      while (queue.length) {
        const [x, z] = queue.shift();
        if (Math.hypot(x - front[0], z - front[1]) <= 100) { reached = true; break; }
        for (const [dx, dz] of [[10, 0], [-10, 0], [0, 10], [0, -10]]) { const nx = x + dx, nz = z + dz; if (!seen.has(key(nx, nz)) && free(nx, nz)) { seen.add(key(nx, nz)); queue.push([nx, nz]); } }
      }
      if (!reached) problems.push('There is no 60 cm walkway from the door to the anchor piece.');
    }
  }
  return { problems, pieceProblems };
}
