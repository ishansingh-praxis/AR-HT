// Builds simplified, true-scale 3D shapes (sofa, bed, wardrobe, chair, table, storage, wall piece) coloured like the product.
// Each GLB is a 1 m x 1 m x 1 m shape (origin at footprint centre, base on y=0, front = +z). The app scales it to the product's real
// width/height/depth, so footprint, height and clearances are exact. The shapes are detailed (cushions, legs, headboards, doors, handles)
// and take their colour from the product's own photo (`dominantHex`, see add-blurhash.mjs), but they are NOT photo-real models.
// Every product without a real model gets `proxy: {template, color}`. Products flagged `sizeReview` are skipped.
//   node scripts/make-proxy-models.mjs
import fs from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';

// name -> sRGB hex. The product's photo colour snaps to the nearest one (a small palette keeps the app bundle small).
export const COLORS = {
  brown: '#7A5A44', walnut: '#5C4033', oak: '#B08D57', teak: '#A9744F', wenge: '#3B2A22', espresso: '#2E1F18',
  beige: '#D8C8AE', cream: '#EDE3D0', tan: '#BE9A6B', white: '#EEEBE4', lightgrey: '#BFC3C4', grey: '#8E9396', charcoal: '#484B4F', black: '#2E2E30',
  blue: '#4A6C8F', navy: '#2B3A55', teal: '#3F7F7A', green: '#5E7F63', olive: '#7C7A45', red: '#A24B45', burgundy: '#6E2F3A',
  orange: '#C9773E', mustard: '#C99A2E', yellow: '#D9B84A', gold: '#C2A25A', pink: '#D4A5A5', multicolor: '#B8956A', neutral: '#A89F94',
};
const LEGACY = new Set(['multicolor', 'neutral']); // never chosen by distance

const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** Nearest palette name for a #RRGGBB colour (weighted RGB distance: the eye is most sensitive to green). */
export function nearestColour(hex) {
  const [r, g, b] = rgb(hex);
  let best = 'neutral', bd = Infinity;
  for (const [name, h] of Object.entries(COLORS)) {
    if (LEGACY.has(name)) continue;
    const [r2, g2, b2] = rgb(h);
    const d = 2 * (r - r2) ** 2 + 4 * (g - g2) ** 2 + 3 * (b - b2) ** 2;
    if (d < bd) { bd = d; best = name; }
  }
  return best;
}

// [material, cx, cy, cz, sx, sy, sz] boxes in a 1 m cube. body = main colour, soft = cushions (lighter), dark = legs and handles.
const row = (n, w, fn) => Array.from({ length: n }, (_, i) => fn(-(n - 1) / 2 * w + i * w));
export const TEMPLATES = {
  Sofa: [
    ['body', 0, 0.27, 0, 1, 0.3, 1],                                   // base
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => ['dark', x * 0.44, 0.05, z * 0.44, 0.07, 0.1, 0.07]), // legs
    ['body', 0, 0.74, -0.4, 0.78, 0.52, 0.2],                          // back
    ['body', -0.45, 0.4, 0, 0.1, 0.6, 1], ['body', 0.45, 0.4, 0, 0.1, 0.6, 1], // arms
    ...row(3, 0.26, (x) => ['soft', x, 0.5, 0.16, 0.25, 0.16, 0.62]),   // seat cushions
    ...row(3, 0.26, (x) => ['soft', x, 0.72, -0.22, 0.25, 0.36, 0.16]), // back cushions
  ],
  Bed: [
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => ['dark', x * 0.46, 0.05, z * 0.46, 0.07, 0.1, 0.07]),
    ['body', 0, 0.2, 0.02, 1, 0.2, 0.96],                              // frame
    ['soft', 0, 0.41, 0.03, 0.94, 0.22, 0.9],                          // mattress
    ['body', 0, 0.55, -0.47, 1, 0.9, 0.06],                            // headboard
    ['soft', 0, 0.62, -0.435, 0.88, 0.5, 0.03],                        // padded panel
    ['soft', -0.23, 0.56, -0.3, 0.38, 0.1, 0.2], ['soft', 0.23, 0.56, -0.3, 0.38, 0.1, 0.2], // pillows
    ['body', 0, 0.53, 0.3, 0.9, 0.03, 0.42],                           // folded cover
  ],
  Wardrobe: [
    ['dark', 0, 0.025, -0.02, 0.96, 0.05, 0.94],                       // plinth
    ['body', 0, 0.525, -0.02, 1, 0.95, 0.96],                          // carcass (front at z 0.46)
    ['soft', -0.245, 0.52, 0.48, 0.45, 0.84, 0.03], ['soft', 0.245, 0.52, 0.48, 0.45, 0.84, 0.03], // door panels (front 0.495)
    ['dark', 0, 0.52, 0.48, 0.008, 0.86, 0.034],                       // door gap (front 0.497)
    ['dark', -0.04, 0.5, 0.48, 0.018, 0.22, 0.04], ['dark', 0.04, 0.5, 0.48, 0.018, 0.22, 0.04], // handles (front 0.5)
    ['body', 0, 0.99, -0.02, 1, 0.02, 0.96],                           // top
  ],
  Chair: [
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => ['dark', x * 0.43, 0.22, z * 0.43, 0.08, 0.44, 0.08]), // legs
    ['body', 0, 0.47, 0, 1, 0.06, 1],                                  // seat frame
    ['soft', 0, 0.53, 0.02, 0.92, 0.08, 0.9],                          // seat cushion
    ['body', 0, 0.78, -0.45, 1, 0.45, 0.08],                           // back frame
    ['soft', 0, 0.78, -0.4, 0.82, 0.34, 0.05],                         // back cushion
  ],
  Table: [
    ['body', 0, 0.97, 0, 1, 0.06, 1],                                  // top
    ['body', 0, 0.9, 0, 0.84, 0.08, 0.84],                             // apron
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => ['dark', x * 0.43, 0.43, z * 0.43, 0.08, 0.86, 0.08]), // legs
  ],
  Storage: [
    ['dark', 0, 0.025, -0.02, 0.96, 0.05, 0.94],
    ['body', 0, 0.53, -0.02, 1, 0.94, 0.96],
    ...[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([x, y]) => ['soft', x * 0.245, 0.53 + y * 0.215, 0.48, 0.46, 0.4, 0.03]),   // doors / drawer fronts (front 0.495)
    ...[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([x, y]) => ['dark', x * 0.245, 0.53 + y * 0.215, 0.48, 0.14, 0.02, 0.04]), // handles (front 0.5)
  ],
  // Wall pieces: a thin frame with a lighter inset. Front = +z. In AR the box is stretched to W x H x thickness.
  Wall: [['body', 0, 0.5, 0, 1, 1, 1], ['soft', 0, 0.5, 0.5, 0.8, 0.8, 0.02]],
};

const mix = (hex, t) => rgb(hex).map((v) => (t > 0 ? v + (255 - v) * t : v * (1 + t)) / 255);
const lin = (c) => c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); // glTF colours are linear

function box([, cx, cy, cz, sx, sy, sz]) {
  const P = [], N = [], I = [], T = [];
  const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, -1]], [[-1, 0, 0], [0, 1, 0], [0, 0, 1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, 1], [-1, 0, 0]], [[0, 0, 1], [0, 1, 0], [1, 0, 0]], [[0, 0, -1], [0, 1, 0], [-1, 0, 0]]];
  for (const [n, u, v] of faces) {
    const b = P.length / 3;
    for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
      P.push(cx + (n[0] + u[0] * a + v[0] * c) * sx / 2, cy + (n[1] + u[1] * a + v[1] * c) * sy / 2, cz + (n[2] + u[2] * a + v[2] * c) * sz / 2), N.push(...n), T.push((a + 1) / 2, 1 - (c + 1) / 2); // UVs so a product photo can be wrapped on (glTF v points down)
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return { P, N, I, T };
}

export async function build(template, colorKey, file) {
  const base = COLORS[colorKey];
  const mats = { body: [mix(base, 0), 0.8], soft: [mix(base, 0.14), 0.95], dark: [mix(base, -0.5), 0.55] };
  const doc = new Document(), buf = doc.createBuffer(), mesh = doc.createMesh(template);
  for (const [name, [c, rough]] of Object.entries(mats)) {
    const parts = TEMPLATES[template].filter((b) => b[0] === name).map(box);
    if (!parts.length) continue;
    const P = [], N = [], I = [], T = [];
    for (const p of parts) { const off = P.length / 3; P.push(...p.P); N.push(...p.N); T.push(...p.T); I.push(...p.I.map((i) => i + off)); }
    const acc = (type, arr, A) => doc.createAccessor().setType(type).setArray(new A(arr)).setBuffer(buf);
    mesh.addPrimitive(doc.createPrimitive()
      .setAttribute('POSITION', acc('VEC3', P, Float32Array)).setAttribute('NORMAL', acc('VEC3', N, Float32Array)).setAttribute('TEXCOORD_0', acc('VEC2', T, Float32Array))
      .setIndices(acc('SCALAR', I, Uint16Array))
      .setMaterial(doc.createMaterial(name).setBaseColorFactor([...lin(c), 1]).setRoughnessFactor(rough).setMetallicFactor(0)));
  }
  doc.createScene().addChild(doc.createNode(template).setMesh(mesh));
  await new NodeIO().write(file, doc);
}

if (process.argv[1]?.endsWith('make-proxy-models.mjs')) {
  const catPath = 'src/data/catalogue.json';
  const catalogue = JSON.parse(fs.readFileSync(catPath, 'utf8'));
  fs.rmSync('assets/proxy', { recursive: true, force: true }); // drop shapes that are no longer used
  fs.mkdirSync('assets/proxy', { recursive: true });
  const used = new Set();
  let skipped = 0;
  for (const p of catalogue) {
    delete p.proxy;
    if (p.model3D) continue;
    if (p.sizeReview || !TEMPLATES[p.category]) { skipped++; continue; }
    // colour from the product photo; fall back to HomeTown's colour family, then neutral
    const fam = (p.colorFamily ?? '').toLowerCase();
    const color = p.dominantHex ? nearestColour(p.dominantHex) : COLORS[fam] ? fam : 'neutral';
    p.proxy = { template: p.category, color };
    used.add(`${p.category}-${color}`);
  }
  for (const key of used) { const [t, c] = key.split('-'); await build(t, c, `assets/proxy/${key}.glb`); }
  // Metro needs static require() calls, so the asset map is generated.
  fs.writeFileSync('src/data/proxyAssets.ts',
    `// Generated by scripts/make-proxy-models.mjs. Do not edit.\n/* eslint-disable */\nexport const PROXY_ASSETS: Record<string, number> = {\n${[...used].sort().map((k) => `  '${k}': require('../../assets/proxy/${k}.glb'),`).join('\n')}\n};\n`);
  fs.writeFileSync(catPath, JSON.stringify(catalogue, null, 1));
  const bytes = [...used].reduce((s, k) => s + fs.statSync(`assets/proxy/${k}.glb`).size, 0);
  const byColour = {};
  for (const p of catalogue) if (p.proxy) byColour[p.proxy.color] = (byColour[p.proxy.color] ?? 0) + 1;
  console.log(`${catalogue.filter((p) => p.proxy).length} products got a shape; ${used.size} GLBs, ${(bytes / 1024).toFixed(0)} KB total; ${skipped} skipped (size review).`);
  console.log('colours', byColour);
}
