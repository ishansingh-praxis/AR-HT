// Finds the upright orientation of a generated model. Image-to-3D services do not agree on which axis is "up"
// (TripoSR output often lies on its side), so we try the six ways of assigning the model's three axes to
// width / height / depth and keep the one whose proportions best match the listed size.
// Pure maths, no I/O: tested in scripts/image3d.test.mjs.

const det3 = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

/** Quaternion [x,y,z,w] of a proper rotation matrix (rows = where each world axis reads from). */
export function quatFromMatrix(m) {
  const tr = m[0][0] + m[1][1] + m[2][2];
  let x, y, z, w;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; w = s / 4; x = (m[2][1] - m[1][2]) / s; y = (m[0][2] - m[2][0]) / s; z = (m[1][0] - m[0][1]) / s; }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; w = (m[2][1] - m[1][2]) / s; x = s / 4; y = (m[0][1] + m[1][0]) / s; z = (m[0][2] + m[2][0]) / s; }
  else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; w = (m[0][2] - m[2][0]) / s; x = (m[0][1] + m[1][0]) / s; y = s / 4; z = (m[1][2] + m[2][1]) / s; }
  else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; w = (m[1][0] - m[0][1]) / s; x = (m[0][2] + m[2][0]) / s; y = (m[1][2] + m[2][1]) / s; z = s / 4; }
  return [x, y, z, w];
}

/**
 * @param extents  [ex, ey, ez] size of the model along its own axes
 * @param centroid [cx, cy, cz] average vertex position relative to the middle of the bounding box, as a fraction of each extent (-0.5..0.5)
 * @param dims     listed size {w, d, h}
 * @returns { matrix, quat, size: {w,h,d}, score }  matrix rows: world x, y, z read from model axes (with sign)
 */
export function pickOrientation(extents, centroid, dims) {
  const want = [dims.w, dims.h, dims.d];
  let best = null;
  for (const up of [0, 1, 2]) {
    const others = [0, 1, 2].filter((a) => a !== up);
    for (const [wa, da] of [[others[0], others[1]], [others[1], others[0]]]) {
      const got = [extents[wa], extents[up], extents[da]]; // width, height, depth
      // proportions only: divide out the overall scale (the geometric mean of the ratios)
      const r = got.map((g, i) => Math.log(g / want[i]));
      const mean = (r[0] + r[1] + r[2]) / 3;
      const score = r.reduce((n, v) => n + Math.abs(v - mean), 0);
      if (!best || score < best.score) best = { score, up, wa, da, got };
    }
  }
  const { up, wa, da } = best;
  // Furniture is heavier near the floor (legs, drawers, seat): if the average vertex sits in the upper half, the model is upside down.
  const sUp = centroid[up] > 0 ? -1 : 1;
  const rows = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  rows[0][wa] = 1; rows[1][up] = sUp; rows[2][da] = 1;
  if (det3(rows) < 0) rows[2][da] = -1; // keep it a proper rotation (no mirroring)
  return { matrix: rows, quat: quatFromMatrix(rows), size: { w: best.got[0], h: best.got[1], d: best.got[2] }, score: best.score };
}

/** Per-axis scale that makes the oriented model exactly the listed size, plus how much it had to stretch (1 = none). */
export function fitToDims(size, dims) {
  const s = [dims.w / 100 / size.w, dims.h / 100 / size.h, dims.d / 100 / size.d];
  const mean = Math.exp((Math.log(s[0]) + Math.log(s[1]) + Math.log(s[2])) / 3);
  const stretch = s.map((v) => v / mean);
  return { scale: s, worst: Math.max(...stretch.map((v) => Math.max(v, 1 / v))) };
}
