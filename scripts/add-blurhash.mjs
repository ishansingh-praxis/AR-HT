// Adds `blurhash` (a ~30 character placeholder for the first photo) to every product in src/data/catalogue.json.
// The app shows it while the real photo loads (expo-image). Needs network. Only products without a blurhash are fetched, so it can be re-run.
//   npm run build:blurhash
import fs from 'node:fs';
import sharp from 'sharp';
import { encode } from 'blurhash';

const FILE = 'src/data/catalogue.json';
const catalogue = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const todo = catalogue.filter((p) => !p.blurhash && p.images?.[0]);
const small = (url) => (url.includes('cdn.shopify.com') ? url + (url.includes('?') ? '&' : '?') + 'width=96' : url); // Shopify resizes on request: a 5 KB download instead of 300 KB

async function hashOf(url) {
  const res = await fetch(small(url), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).resize(32, 32, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
}

let done = 0, failed = 0;
const queue = [...todo];
async function worker() {
  while (queue.length) {
    const p = queue.shift();
    try { p.blurhash = await hashOf(p.images[0]); done++; } catch (e) { failed++; console.warn(`skip ${p.id}: ${e.message}`); }
    if ((done + failed) % 50 === 0) { fs.writeFileSync(FILE, JSON.stringify(catalogue, null, 1)); console.log(`${done + failed}/${todo.length}`); }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
fs.writeFileSync(FILE, JSON.stringify(catalogue, null, 1));
console.log(`blurhash added to ${done} products, ${failed} failed, ${catalogue.filter((p) => p.blurhash).length}/${catalogue.length} have one`);
