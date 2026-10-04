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
import { fitToDims, pickOrientation } from './lib/orient.mjs';

const BASE = process.env.MODEL_BASE_URL ?? 'https://CHANGE-ME.example.com/models/';
const catPath = 'src/data/catalogue.json';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];

/** Average vertex position inside the bounding box, as a fraction of each extent (-0.5..0.5). Used to tell upright from upside down. */
function centroidFraction(doc, min, max) {
  const sum = [0, 0, 0]; let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'); if (!pos) continue;
    const v = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); sum[0] += v[0]; sum[1] += v[1]; sum[2] += v[2]; n++; }
  }
  return sum.map((t, i) => (n ? (t / n - (min[i] + max[i]) / 2) / ((max[i] - min[i]) || 1) : 0));
}

/**
 * `yawDeg` turns a model that faces the wrong way (our convention: front = +z) before it is measured and scaled.
 * `auto` (used for photo-generated models): first finds which way is up by matching proportions to the listed size, then stretches
 * the model to exactly the listed width / height / depth. If that needs more than a 1.4x stretch on any axis the shape is wrong
 * and the model is reported as REVIEW. With auto, `yawDeg` = 180 flips the front to the other side.
 */
export async function normalise(inFile, outFile, dims, yawDeg = 0, { auto = false } = {}) {
  const doc = await io.read(inFile);
  const scene = doc.getRoot().listScenes()[0];
  const outer = doc.createNode('root'), inner = doc.createNode('orient');
  for (const n of scene.listChildren()) { scene.removeChild(n); inner.addChild(n); }
  outer.addChild(inner); scene.addChild(outer);
  const yawQ = [0, Math.sin((yawDeg * Math.PI) / 360), 0, Math.cos((yawDeg * Math.PI) / 360)];
  let note = '';
  if (auto) {
    const raw = getBounds(scene);
    const ext = [0, 1, 2].map((i) => raw.max[i] - raw.min[i]);
    const pick = pickOrientation(ext, centroidFraction(doc, raw.min, raw.max), dims);
    inner.setRotation(yawDeg ? qMul(yawQ, pick.quat) : pick.quat);
    note = `oriented (fit ${pick.score.toFixed(2)})`;
  } else if (yawDeg) inner.setRotation(yawQ);
  const { min, max } = getBounds(scene); // measured after the turn, so width/depth swap correctly
  const size = { w: max[0] - min[0], h: max[1] - min[1], d: max[2] - min[2] };
  const fit = auto ? fitToDims(size, dims) : null;
  const sc = fit ? fit.scale : [dims.h / 100 / size.h, dims.h / 100 / size.h, dims.h / 100 / size.h];
  outer.setScale(sc).setTranslation([-((min[0] + max[0]) / 2) * sc[0], -min[1] * sc[1], -((min[2] + max[2]) / 2) * sc[2]]);
  // Textures are usually most of a model's weight. Downscale to <=1024 px, keeping the original image format, so no
  // compression extension is needed and any glTF loader (including the AR library's) can read the result.
  const tooBig = doc.getRoot().listTextures().some((t) => (t.getSize() ?? [0, 0]).some((v) => v > 1024)); // re-encoding small textures only makes them bigger
  await doc.transform(dedup(), prune(), ...(tooBig ? [textureCompress({ encoder: sharp, resize: [1024, 1024] })] : []));
  await io.write(outFile, doc);
  const w = size.w * sc[0] * 100, d = size.d * sc[2] * 100;
  const mb = fs.statSync(outFile).size / 1e6;
  const issues = [];
  if (fit && fit.worst > 1.4) issues.push(`shape is ${fit.worst.toFixed(1)}x off the listed proportions (stretched to fit)`);
  if (Math.abs(w - dims.w) / dims.w > 0.1) issues.push(`width ${w.toFixed(0)}cm vs listed ${dims.w}cm`);
  if (Math.abs(d - dims.d) / dims.d > 0.1) issues.push(`depth ${d.toFixed(0)}cm vs listed ${dims.d}cm`);
  if (mb > 8) issues.push(`${mb.toFixed(1)}MB over the 8MB budget`);
  return { w, d, mb, issues, stretch: fit?.worst ?? 1, note };
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
