// Makes 3D models from product photos with an image-to-3D service, then scales them to the real size and checks them.
//
//   MESHY_API_KEY=... node scripts/image-to-3d.mjs --next 5            show the plan (nothing is spent)
//   MESHY_API_KEY=... node scripts/image-to-3d.mjs --next 5 --yes      generate 5 models (costs credits: about 1 task per product)
//   MESHY_API_KEY=... node scripts/image-to-3d.mjs --ids sofa-a,bed-b --yes [--yaw 90]
//   node scripts/image-to-3d.mjs --normalise                           re-check every models/raw/*.glb (no network)
//
// For each product: photo -> service -> models/raw/<id>.glb -> scaled to the listed height, stood on the floor, centred, textures <= 1024 px
// -> models/published/<id>.glb, and a report line: OK (width and depth within 10 % of the listed size) or REVIEW.
// A generated model is a guess from ONE photo: the back and sides are invented, and proportions can be off. REVIEW ones should be fixed or rejected.
// Review every OK model next to its photos in the admin dashboard (3D models, upload for review) before it reaches customers.
//
// Safety: nothing is generated without --yes; task ids are saved in models/raw/.image3d-tasks.json so an interrupted run resumes without paying twice;
// existing files are never overwritten. Facing: our convention is front = +z. If a model faces the wrong way use --yaw 90 / 180 / -90 and re-run --normalise.
import fs from 'node:fs';
import path from 'node:path';
import { PROVIDERS, photoFor, pickProducts, waitForModel } from './lib/image3d.mjs';
import { normalise } from './publish-models.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };

const CAT = 'src/data/catalogue.json', RAW = 'models/raw', OUT = 'models/published', TASKS = path.join(RAW, '.image3d-tasks.json');
const catalogue = JSON.parse(fs.readFileSync(CAT, 'utf8'));
const rooms = JSON.parse(fs.readFileSync('src/data/rooms.json', 'utf8'));
const byId = new Map(catalogue.map((p) => [p.id, p]));
const tasks = fs.existsSync(TASKS) ? JSON.parse(fs.readFileSync(TASKS, 'utf8')) : {};
const save = () => fs.writeFileSync(TASKS, JSON.stringify(tasks, null, 1));
const yaw = Number(opt('yaw', 0));
fs.mkdirSync(RAW, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });

async function check(p) {
  const r = await normalise(path.join(RAW, `${p.id}.glb`), path.join(OUT, `${p.id}.glb`), p.dimensionsCm, yaw);
  console.log(`${r.issues.length ? 'REVIEW' : 'OK    '} ${p.id}  ${r.w.toFixed(0)}x${r.d.toFixed(0)}cm vs ${p.dimensionsCm.w}x${p.dimensionsCm.d}  ${r.mb.toFixed(1)}MB  ${r.issues.join('; ')}`);
  return r;
}

if (flag('normalise')) {
  for (const f of fs.readdirSync(RAW).filter((x) => x.endsWith('.glb') && !x.startsWith('_'))) { const p = byId.get(f.replace(/\.glb$/, '')); if (p) await check(p); }
  process.exit(0);
}

const ids = opt('ids', '');
const picked = ids ? ids.split(',').map((i) => byId.get(i.trim())).filter(Boolean) : pickProducts(catalogue, rooms, Number(opt('next', 5)), new Set(Object.keys(tasks).filter((k) => fs.existsSync(path.join(RAW, `${k}.glb`)))));
if (!picked.length) { console.log('Nothing to do (no matching products without a model).'); process.exit(0); }
console.log(`Plan: ${picked.length} product(s) -> ${picked.length} image-to-3D task(s) on ${opt('provider', 'meshy')}`);
for (const p of picked) console.log(`  ${p.id}  ${p.name}  ${p.dimensionsCm.w}x${p.dimensionsCm.d}x${p.dimensionsCm.h}cm${fs.existsSync(path.join(RAW, `${p.id}.glb`)) ? '  (file exists: will only re-check)' : ''}`);
if (!flag('yes')) { console.log('\nDry run. Add --yes to generate (this uses your service credits).'); process.exit(0); }

const apiKey = process.env.MESHY_API_KEY;
const make = PROVIDERS[opt('provider', 'meshy')];
if (!make) { console.error(`Unknown provider. Available: ${Object.keys(PROVIDERS).join(', ')}`); process.exit(1); }
if (!apiKey) { console.error('Set MESHY_API_KEY (your key from the service dashboard).'); process.exit(1); }
const provider = make({ apiKey });

let ok = 0, review = 0, failed = 0;
for (const p of picked) {
  const file = path.join(RAW, `${p.id}.glb`);
  try {
    if (!fs.existsSync(file)) {
      const t = (tasks[p.id] ??= {});
      if (!t.taskId) { t.taskId = await provider.create(photoFor(p)); t.provider = provider.name; t.createdAt = Date.now(); save(); console.log(`started ${p.id} (task ${t.taskId})`); }
      const url = await waitForModel(provider, t.taskId, { onProgress: (s) => process.stdout.write(`\r  ${p.id}: ${s.status}${s.progress != null ? ` ${s.progress}%` : ''}   `) });
      const res = await fetch(url);
      if (!res.ok) throw new Error(`download failed (${res.status})`);
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      console.log(`\n  saved ${file}`);
    }
    (await check(p)).issues.length ? review++ : ok++;
  } catch (e) { failed++; console.error(`\nFAILED ${p.id}: ${e.message}`); }
}
console.log(`\n${ok} OK, ${review} need review, ${failed} failed. Normalised files are in ${OUT}/.`);
console.log('Next: upload each OK model for review in the admin dashboard (3D models page), approve it, and apps pick it up on their next catalogue refresh.');
