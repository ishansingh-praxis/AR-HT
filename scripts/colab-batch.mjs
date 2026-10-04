// Prepares and imports the Google Colab 3D batch (free GPU, no key, nothing installed on this laptop).
//
//   node scripts/colab-batch.mjs export --next 20      writes models/colab/products.json (the best products to model first)
//   -> upload that file in colab/triposr_batch.ipynb, run it, download models.zip
//   node scripts/colab-batch.mjs import models.zip     unpacks the GLBs into models/raw/ (never overwrites unless --replace; the old file is kept as <id>.old.glb)
//   node scripts/colab-batch.mjs export --all [--redo]     every placeable product with all its photos (multi-photo notebook)
//   node scripts/colab-batch.mjs export --next 20 --redo   the same best products again, e.g. with a better model
//   node scripts/image-to-3d.mjs --normalise           scales to the listed size, stands them on the floor, checks, publishes
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { photoFor, pickProducts } from './lib/image3d.mjs';

const big = (u) => (u.includes('cdn.shopify.com') ? u + (u.includes('?') ? '&' : '?') + 'width=1024' : u);

const [cmd, arg] = process.argv.slice(2);
const opt = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const RAW = 'models/raw';

if (cmd === 'export') {
  const catalogue = JSON.parse(fs.readFileSync('src/data/catalogue.json', 'utf8'));
  const rooms = JSON.parse(fs.readFileSync('src/data/rooms.json', 'utf8'));
  fs.mkdirSync(RAW, { recursive: true });
  const have = new Set(process.argv.includes('--redo') ? [] : fs.readdirSync(RAW).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4))); // --redo: model the same products again with a better model
  // --all: every placeable product (about 500), with ALL of its photos, for the multi-photo notebook (colab/multiview_batch.ipynb)
  const all = process.argv.includes('--all');
  const chosen = all
    ? catalogue.filter((p) => !p.sizeReview && !p.demo && p.category !== 'Wall' && p.images?.length && !have.has(p.id))
    : pickProducts(catalogue, rooms, Number(opt('next', 20)), have);
  const list = chosen.map((p) => ({ id: p.id, name: p.name, photo: photoFor(p), photos: p.images.slice(0, 6).map(big), dimensionsCm: p.dimensionsCm, dominantHex: p.dominantHex }));
  fs.mkdirSync('models/colab', { recursive: true });
  fs.writeFileSync('models/colab/products.json', JSON.stringify(list, null, 1));
  console.log(`models/colab/products.json: ${list.length} products. Upload it in the Colab notebook (colab/multiview_batch.ipynb for --all).`);
} else if (cmd === 'import' && arg) {
  fs.mkdirSync(RAW, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(process.env.TEMP ?? '.', 'colab-'));
  // `tar` ships with Windows 10+, macOS and Linux and reads zip files.
  execFileSync('tar', ['-xf', arg, '-C', tmp]);
  let n = 0;
  for (const f of fs.readdirSync(tmp).filter((x) => x.endsWith('.glb'))) {
    const dest = path.join(RAW, f);
    if (fs.existsSync(dest) && !process.argv.includes('--replace')) { console.log('skip (exists, use --replace to overwrite)', f); continue; }
    if (fs.existsSync(dest)) fs.copyFileSync(dest, dest.replace(/\.glb$/, '.old.glb')); // keep the previous version
    fs.copyFileSync(path.join(tmp, f), dest); n++;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${n} models copied to ${RAW}. Next: node scripts/image-to-3d.mjs --normalise`);
} else {
  console.log('Usage: node scripts/colab-batch.mjs export --next 20 | import models.zip');
  process.exit(1);
}
