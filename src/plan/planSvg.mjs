// Top-down, to-scale room plan as an SVG string. Pure (no React, no Node APIs), so the SAME drawing is used by the app
// (react-native-svg SvgXml) and by the server's share page. Plain .mjs + planSvg.d.mts so Node can run it without a build step.
//
// Conventions match the rest of the app: centimetres, plan x to the right, plan z DOWN the page, `rot` degrees about +Y
// (Viro right-handed, rot 0 faces +z = down the plan; SVG rotates clockwise in a y-down plane, hence rotate(-rot)).

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const n = (v) => Math.round(v * 10) / 10;

export const PLAN_COLORS = { ink: '#14211F', muted: '#6B7A77', accent: '#2F6F5E', floor: '#EEF2F0', fallback: '#B8C4C0' };

/**
 * @param {{ roomCm: {w:number,d:number}, pieces: {x:number,z:number,rot:number,w:number,d:number,fill?:string,label?:string}[],
 *           width?: number, highlight?: number, flagged?: number[], title?: string }} plan
 */
export function planSvg({ roomCm, pieces, width = 360, highlight, flagged, title }) {
  const pad = 22; // room for the dimension labels
  const k = (width - pad) / roomCm.w;
  const rw = roomCm.w * k, rd = roomCm.d * k;
  const height = rd + pad;
  const c = PLAN_COLORS;
  const label = title ?? `Plan of the room, ${Math.round(roomCm.w)} by ${Math.round(roomCm.d)} centimetres`;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" viewBox="0 0 ${n(width)} ${n(height)}" role="img" aria-label="${esc(label)}">`);
  out.push(`<rect x="${pad}" y="0" width="${n(rw)}" height="${n(rd)}" fill="${c.floor}" stroke="${c.ink}" stroke-width="2"/>`);
  pieces.forEach((pc, i) => {
    const w = pc.w * k, d = pc.d * k;
    const fill = pc.fill ?? c.fallback;
    const on = highlight === i;
    const bad = flagged?.includes(i);
    out.push(`<g transform="translate(${n(pad + pc.x * k)} ${n(pc.z * k)}) rotate(${n(-pc.rot)})">`);
    out.push(`<rect x="${n(-w / 2)}" y="${n(-d / 2)}" width="${n(w)}" height="${n(d)}" rx="3" fill="${esc(fill)}" fill-opacity="0.8" stroke="${bad ? '#B3402F' : on ? c.accent : esc(fill)}" stroke-width="${on || bad ? 3 : 1}"/>`);
    // front edge marker
    out.push(`<line x1="${n(-w / 2)}" y1="${n(d / 2 - 1.5)}" x2="${n(w / 2)}" y2="${n(d / 2 - 1.5)}" stroke="${c.ink}" stroke-width="3" stroke-opacity="0.55"/>`);
    if (pc.label && w > 34 && d > 18) out.push(`<text x="0" y="3" font-size="9" fill="${c.ink}" text-anchor="middle" font-family="sans-serif">${esc(pc.label)}</text>`);
    out.push('</g>');
  });
  out.push(`<text x="${n(pad + rw / 2)}" y="${n(rd + 15)}" font-size="11" fill="${c.muted}" text-anchor="middle" font-family="sans-serif">${(roomCm.w / 100).toFixed(1)} m</text>`);
  out.push(`<text x="10" y="${n(rd / 2)}" font-size="11" fill="${c.muted}" text-anchor="middle" font-family="sans-serif" transform="rotate(-90 10 ${n(rd / 2)})">${(roomCm.d / 100).toFixed(1)} m</text>`);
  out.push('</svg>');
  return out.join('');
}

/**
 * A saved design stores offsets in metres from its first piece. This turns it into plan input: the room is the pieces'
 * bounding box plus a margin (or `scanCm` when the user scanned a room that is at least that big), pieces centred in it.
 * @param {{ productId:string, offset:[number,number,number], rotationY:number, scale:number }[]} items
 * @param {(id:string) => ({dimensionsCm:{w:number,d:number}, role?:string, colors?:{hex:string}[]} | undefined)} find
 */
export function designPlan(items, find, scanCm) {
  const rows = items.flatMap((it) => {
    const p = find(it.productId);
    return p ? [{ it, p }] : [];
  });
  const MARGIN = 60;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const { it, p } of rows) {
    const a = (it.rotationY * Math.PI) / 180;
    const hw = (p.dimensionsCm.w * it.scale) / 2, hd = (p.dimensionsCm.d * it.scale) / 2;
    // half-extent of the rotated rectangle on each axis
    const ex = Math.abs(Math.cos(a)) * hw + Math.abs(Math.sin(a)) * hd;
    const ez = Math.abs(Math.sin(a)) * hw + Math.abs(Math.cos(a)) * hd;
    const x = it.offset[0] * 100, z = it.offset[2] * 100;
    minX = Math.min(minX, x - ex); maxX = Math.max(maxX, x + ex); minZ = Math.min(minZ, z - ez); maxZ = Math.max(maxZ, z + ez);
  }
  if (!rows.length) return { roomCm: { w: 300, d: 300 }, pieces: [] };
  let w = maxX - minX + 2 * MARGIN, d = maxZ - minZ + 2 * MARGIN;
  if (scanCm && scanCm.w >= w && scanCm.d >= d) { w = scanCm.w; d = scanCm.d; }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  return {
    roomCm: { w: Math.round(w), d: Math.round(d) },
    pieces: rows.map(({ it, p }) => ({
      x: it.offset[0] * 100 - cx + w / 2, z: it.offset[2] * 100 - cz + d / 2, rot: it.rotationY,
      w: p.dimensionsCm.w * it.scale, d: p.dimensionsCm.d * it.scale,
      fill: p.colors?.[0]?.hex, label: p.role ? String(p.role).replace('-', ' ') : undefined,
    })),
  };
}
