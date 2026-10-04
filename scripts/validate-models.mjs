// Fails (exit 1) if a product's GLB doesn't match its listed dimensions.
// Usage: npm run validate:models [-- --tolerance 0.05]
import fs from 'node:fs';
import path from 'node:path';
import { glbSizeMetres } from './glb-bounds.mjs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';

const tolArg = process.argv.indexOf('--tolerance');
const TOL = tolArg > 0 ? Number(process.argv[tolArg + 1]) : 0.05; // 5%
const ORIGIN_TOL_M = 0.05;
const MAX_MB = 8;
const products = JSON.parse(fs.readFileSync('src/data/catalogue.json', 'utf8'));
fs.mkdirSync('.cache', { recursive: true });

let failed = false;
for (const p of products) {
  if (!p.model3D) continue; // no 3D model yet (see npm run publish:models)
  const file = path.join('.cache', `${p.id}-v${p.model3D.version}.glb`);
  if (!fs.existsSync(file)) {
    const res = await fetch(p.model3D.url);
    if (!res.ok) { console.log(`FAIL ${p.id}: download ${res.status}`); failed = true; continue; }
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const issues = [];
  const warns = [];
  const s = await glbSizeMetres(file);
  const want = { w: p.dimensionsCm.w / 100, d: p.dimensionsCm.d / 100, h: p.dimensionsCm.h / 100 };
  for (const k of ['w', 'd', 'h']) {
    const err = Math.abs(s[k] - want[k]) / want[k];
    if (err > TOL) issues.push(`${k}: model ${(s[k] * 100).toFixed(0)}cm vs listed ${p.dimensionsCm[k]}cm (${(err * 100).toFixed(0)}% off)`);
  }
  // Origin: collision and floor placement assume origin at the centre of the footprint, base on y=0.
  const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
  const { min, max } = getBounds(doc.getRoot().listScenes()[0]);
  const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2;
  if (Math.abs(min[1]) > ORIGIN_TOL_M) warns.push(`base is ${(min[1] * 100).toFixed(0)}cm off the floor (y min)`);
  if (Math.abs(cx) > ORIGIN_TOL_M || Math.abs(cz) > ORIGIN_TOL_M) warns.push(`origin is ${(cx * 100).toFixed(0)}cm / ${(cz * 100).toFixed(0)}cm from footprint centre`);
  const mb = fs.statSync(file).size / 1e6;
  if (mb > MAX_MB) warns.push(`file is ${mb.toFixed(1)}MB (budget ${MAX_MB}MB)`);

  console.log(`${issues.length ? 'FAIL' : 'ok  '} ${p.id}`);
  issues.forEach((m) => console.log(`       ✗ ${m}`));
  warns.forEach((m) => console.log(`       ! ${m}`));
  if (issues.length) failed = true;
}
process.exit(failed ? 1 : 0);
