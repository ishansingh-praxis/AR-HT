// Pure shadow-camera framing (no React / Viro imports).
type V3 = [number, number, number];

export interface ShadowFrame {
  /** Where the orthographic shadow camera sits (above the middle of all floor pieces). */
  position: V3;
  /** Side length in metres of the area the shadow map covers (min 4, max 10). */
  size: number;
}

/** Centre the shadow camera on the bounding box of all floor items and size it to cover them. */
export function shadowFrame(positions: V3[]): ShadowFrame {
  if (!positions.length) return { position: [0, 3, 0], size: 4 };
  const xs = positions.map((p) => p[0]), zs = positions.map((p) => p[2]), ys = positions.map((p) => p[1]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [z0, z1] = [Math.min(...zs), Math.max(...zs)];
  const span = Math.max(x1 - x0, z1 - z0) + 2.5; // + room for the pieces themselves
  return {
    position: [(x0 + x1) / 2, Math.min(...ys) + 3, (z0 + z1) / 2],
    size: Math.min(10, Math.max(4, span)),
  };
}
