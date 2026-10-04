// Builds simplified, true-scale 3D shapes (sofa, bed, wardrobe, chair, table, storage) in the product's colour.
// Each is a 1 m x 1 m x 1 m GLB (origin at footprint centre, base on y=0, front = +z). The app scales it to the
// product's real width/height/depth, so footprint, height and clearances are exact; appearance is deliberately plain.
// Every product without a photo-real model gets `proxy: {template, color}`. Products flagged `sizeReview` are skipped.
//   node scripts/make-proxy-models.mjs
import fs from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';

const COLORS = { brown: '#7A5A44', beige: '#D8C8AE', grey: '#8E9396', white: '#EEEBE4', black: '#2E2E30', blue: '#4A6C8F', red: '#A24B45',
  green: '#5E7F63', multicolor: '#B8956A', orange: '#C9773E', tan: '#BE9A6B', gold: '#C2A25A', pink: '#D4A5A5', yellow: '#D9B84A', neutral: '#A89F94' };
const TEMPLATES = {
  Sofa: [['body', 0, .18, 0, 1, .36, 1], ['soft', 0, .44, .1, .76, .16, .8], ['body', 0, .65, -.4, 1, .7, .2], ['body', -.45, .45, .1, .1, .5, .8], ['body', .45, .45, .1, .1, .5, .8]],
  Bed: [['body', 0, .2, 0, 1, .4, 1], ['soft', 0, .5, .03, .94, .2, .9], ['body', 0, .6, -.47, 1, .8, .06]],
  Wardrobe: [['body', 0, .5, 0, 1, 1, 1], ['dark', 0, .5, .505, .012, .96, .01], ['dark', -.05, .5, .51, .016, .2, .02], ['dark', .05, .5, .51, .016, .2, .02]],
  Chair: [['soft', 0, .5, 0, 1, .1, 1], ['body', 0, .77, -.45, 1, .46, .1], ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => ['dark', x * .42, .22, z * .42, .08, .45, .08])],
  Table: [['body', 0, .95, 0, 1, .1, 1], ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => ['dark', x * .44, .45, z * .44, .08, .9, .08])],
  // Wall pieces: a thin frame with a lighter inset. Front = +z. In AR the box is stretched to W x H x thickness.
  Wall: [['body', 0, .5, 0, 1, 1, 1], ['soft', 0, .5, .5, .8, .8, .02]],
  Storage: [['body', 0, .5, 0, 1, 1, 1], ['dark', 0, .33, .505, .96, .01, .01], ['dark', 0, .66, .505, .96, .01, .01], ...[.17, .5, .83].map((y) => ['dark', 0, y, .512, .2, .02, .02])],
};
const mix = (hex, t) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (t > 0 ? v + (255 - v) * t : v * (1 + t)) / 255); };
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

async function build(template, colorKey, file) {
  const base = COLORS[colorKey];
  const mats = { body: [mix(base, 0), 0.8], soft: [mix(base, 0.12), 0.95], dark: [mix(base, -0.45), 0.6] };
  const doc = new Document(), buf = doc.createBuffer(), mesh = doc.createMesh(template);
  for (const [name, [rgb, rough]] of Object.entries(mats)) {
    const parts = TEMPLATES[template].filter((b) => b[0] === name).map(box);
    if (!parts.length) continue;
    const P = [], N = [], I = [], T = [];
    for (const p of parts) { const off = P.length / 3; P.push(...p.P); N.push(...p.N); T.push(...p.T); I.push(...p.I.map((i) => i + off)); }
    const acc = (type, arr, T) => doc.createAccessor().setType(type).setArray(new T(arr)).setBuffer(buf);
    mesh.addPrimitive(doc.createPrimitive()
      .setAttribute('POSITION', acc('VEC3', P, Float32Array)).setAttribute('NORMAL', acc('VEC3', N, Float32Array)).setAttribute('TEXCOORD_0', acc('VEC2', T, Float32Array))
      .setIndices(acc('SCALAR', I, Uint16Array))
      .setMaterial(doc.createMaterial(name).setBaseColorFactor([...lin(rgb), 1]).setRoughnessFactor(rough).setMetallicFactor(0)));
  }
  doc.createScene().addChild(doc.createNode(template).setMesh(mesh));
  await new NodeIO().write(file, doc);
}

const catPath = 'src/data/catalogue.json';
const catalogue = JSON.parse(fs.readFileSync(catPath, 'utf8'));
fs.mkdirSync('assets/proxy', { recursive: true });
const used = new Set();
let skipped = 0;
for (const p of catalogue) {
  delete p.proxy;
  if (p.model3D) continue;
  if (p.sizeReview || !TEMPLATES[p.category]) { skipped++; continue; }
  const color = COLORS[(p.colorFamily ?? '').toLowerCase()] ? p.colorFamily.toLowerCase() : 'neutral';
  p.proxy = { template: p.category, color };
  used.add(`${p.category}-${color}`);
}
for (const key of used) { const [t, c] = key.split('-'); await build(t, c, `assets/proxy/${key}.glb`); }
// Metro needs static require() calls, so the asset map is generated.
fs.writeFileSync('src/data/proxyAssets.ts',
  `// Generated by scripts/make-proxy-models.mjs. Do not edit.\n/* eslint-disable */\nexport const PROXY_ASSETS: Record<string, number> = {\n${[...used].sort().map((k) => `  '${k}': require('../../assets/proxy/${k}.glb'),`).join('\n')}\n};\n`);
fs.writeFileSync(catPath, JSON.stringify(catalogue, null, 1));
const bytes = [...used].reduce((s, k) => s + fs.statSync(`assets/proxy/${k}.glb`).size, 0);
console.log(`${catalogue.filter((p) => p.proxy).length} products got a simplified shape; ${used.size} GLBs, ${(bytes / 1024).toFixed(0)} KB total; ${skipped} skipped (size review).`);
