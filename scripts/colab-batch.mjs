// Prepares and imports the Google Colab 3D batch (free GPU, no key, nothing installed on this laptop).
//
//   node scripts/colab-batch.mjs export --next 20      writes models/colab/products.json (the best products to model first)
//   -> upload that file in colab/triposr_batch.ipynb, run it, download models.zip
//   node scripts/colab-batch.mjs import models.zip     unpacks the GLBs into models/raw/ (never overwrites)
//   node scripts/image-to-3d.mjs --normalise           scales to the listed size, stands them on the floor, checks, publishes
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { photoFor, pickProducts } from './lib/image3d.mjs';

const [cmd, arg] = process.argv.slice(2);
const opt = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const RAW = 'models/raw';

if (cmd === 'export') {
  const catalogue = JSON.parse(fs.readFileSync('src/data/catalogue.json', 'utf8'));
  const rooms = JSON.parse(fs.readFileSync('src/data/rooms.json', 'utf8'));
  fs.mkdirSync(RAW, { recursive: true });
  const have = new Set(fs.readdirSync(RAW).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)));
  const list = pickProducts(catalogue, rooms, Number(opt('next', 20)), have)
    .map((p) => ({ id: p.id, name: p.name, photo: photoFor(p), dimensionsCm: p.dimensionsCm, dominantHex: p.dominantHex }));
  fs.mkdirSync('models/colab', { recursive: true });
  fs.writeFileSync('models/colab/products.json', JSON.stringify(list, null, 1));
  console.log(`models/colab/products.json: ${list.length} products. Upload it in colab/triposr_batch.ipynb.`);
} else if (cmd === 'import' && arg) {
  fs.mkdirSync(RAW, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(process.env.TEMP ?? '.', 'colab-'));
  // `tar` ships with Windows 10+, macOS and Linux and reads zip files.
  execFileSync('tar', ['-xf', arg, '-C', tmp]);
  let n = 0;
  for (const f of fs.readdirSync(tmp).filter((x) => x.endsWith('.glb'))) {
    const dest = path.join(RAW, f);
    if (fs.existsSync(dest)) { console.log('skip (exists)', f); continue; }
    fs.copyFileSync(path.join(tmp, f), dest); n++;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${n} models copied to ${RAW}. Next: node scripts/image-to-3d.mjs --normalise`);
} else {
  console.log('Usage: node scripts/colab-batch.mjs export --next 20 | import models.zip');
  process.exit(1);
}
