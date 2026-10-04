// Attaches reviewed 3D models to catalogue products.
//   1. Put a GLB per product at models/raw/<product id>.glb (ids are in src/data/catalogue.json)
//   2. MODEL_BASE_URL=https://cdn.example.com/models/ node scripts/publish-models.mjs
//   3. Upload models/published/*.glb to that URL, review each model on a phone, then ship.
// Per model: downscale textures to 1024 px, scale to the listed HEIGHT (uniform), stand it on y=0, centre it on the footprint, dedupe/prune,
// then check width/depth against the listed size. Anything off by >10% or over 8 MB is reported as REVIEW and NOT attached.
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, getBounds, prune, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';

const BASE = process.env.MODEL_BASE_URL ?? 'https://CHANGE-ME.example.com/models/';
const catPath = 'src/data/catalogue.json';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

export async function normalise(inFile, outFile, dims) {
  const doc = await io.read(inFile);
  const scene = doc.getRoot().listScenes()[0];
  const { min, max } = getBounds(scene);
  const s = dims.h / 100 / (max[1] - min[1]);
  const root = doc.createNode('root');
  for (const n of scene.listChildren()) { scene.removeChild(n); root.addChild(n); }
  scene.addChild(root);
  root.setScale([s, s, s]).setTranslation([-((min[0] + max[0]) / 2) * s, -min[1] * s, -((min[2] + max[2]) / 2) * s]);
  // Textures are usually most of a model's weight. Downscale to <=1024 px, keeping the original image format, so no
  // compression extension is needed and any glTF loader (including the AR library's) can read the result.
  const tooBig = doc.getRoot().listTextures().some((t) => (t.getSize() ?? [0, 0]).some((v) => v > 1024)); // re-encoding small textures only makes them bigger
  await doc.transform(dedup(), prune(), ...(tooBig ? [textureCompress({ encoder: sharp, resize: [1024, 1024] })] : []));
  await io.write(outFile, doc);
  const w = (max[0] - min[0]) * s * 100, d = (max[2] - min[2]) * s * 100;
  const mb = fs.statSync(outFile).size / 1e6;
  const issues = [];
  if (Math.abs(w - dims.w) / dims.w > 0.1) issues.push(`width ${w.toFixed(0)}cm vs listed ${dims.w}cm`);
  if (Math.abs(d - dims.d) / dims.d > 0.1) issues.push(`depth ${d.toFixed(0)}cm vs listed ${dims.d}cm`);
  if (mb > 8) issues.push(`${mb.toFixed(1)}MB over the 8MB budget`);
  return { w, d, mb, issues };
}

if (process.argv[1]?.endsWith('publish-models.mjs')) {
  fs.mkdirSync('models/published', { recursive: true });
  const catalogue = JSON.parse(fs.readFileSync(catPath, 'utf8'));
  let ok = 0, review = 0;
  for (const p of catalogue) {
    const raw = `models/raw/${p.id}.glb`;
    if (p.model3D || !fs.existsSync(raw)) continue;
    const r = await normalise(raw, `models/published/${p.id}.glb`, p.dimensionsCm);
    console.log(`${r.issues.length ? 'REVIEW' : 'OK    '} ${p.id}  ${r.w.toFixed(0)}x${r.d.toFixed(0)}cm  ${r.mb.toFixed(1)}MB  ${r.issues.join('; ')}`);
    if (r.issues.length) { review++; continue; }
    p.model3D = { url: `${BASE}${p.id}.glb`, version: 1, unit: 'm' };
    ok++;
  }
  fs.writeFileSync(catPath, JSON.stringify(catalogue, null, 1));
  console.log(`${ok} model(s) attached, ${review} need review. ${catalogue.filter((p) => !p.model3D).length} products still have no model.`);
}
