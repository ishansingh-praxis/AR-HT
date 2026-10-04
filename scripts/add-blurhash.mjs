// Adds two small things to every product in src/data/catalogue.json from its FIRST photo (needs network; re-runnable, only fills what is missing):
//   blurhash     ~30 characters: the placeholder shown while the real photo loads (expo-image)
//   dominantHex  the product's main colour (centre of the photo, white studio background ignored): used to colour its 3D shape
//   npm run build:blurhash
import fs from 'node:fs';
import sharp from 'sharp';
import { encode } from 'blurhash';

const FILE = 'src/data/catalogue.json';
const catalogue = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const todo = catalogue.filter((p) => (!p.blurhash || !p.dominantHex) && p.images?.[0]);
const small = (url) => (url.includes('cdn.shopify.com') ? url + (url.includes('?') ? '&' : '?') + 'width=96' : url); // Shopify resizes on request: a 5 KB download instead of 300 KB

/** Main colour of a product photo: the middle 60 % of the picture, skipping near-white / near-grey backdrop and transparent pixels. */
export function dominantColour(rgba, width, height) {
  const x0 = Math.floor(width * 0.2), x1 = Math.ceil(width * 0.8), y0 = Math.floor(height * 0.2), y1 = Math.ceil(height * 0.8);
  const pick = (skipBackdrop) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4, R = rgba[i], G = rgba[i + 1], B = rgba[i + 2], A = rgba[i + 3];
      if (A < 200) continue;
      const max = Math.max(R, G, B), min = Math.min(R, G, B);
      if (skipBackdrop && max > 225 && max - min < 18) continue; // white or very light grey studio background
      r += R; g += G; b += B; n++;
    }
    return n >= 12 ? [r / n, g / n, b / n] : null;
  };
  const c = pick(true) ?? pick(false) ?? [168, 159, 148];
  return '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

async function analyse(url) {
  const res = await fetch(small(url), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).resize(32, 32, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { blurhash: encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3), dominantHex: dominantColour(data, info.width, info.height) };
}

if (process.argv[1]?.endsWith('add-blurhash.mjs')) {
  let done = 0, failed = 0;
  const queue = [...todo];
  const worker = async () => {
    while (queue.length) {
      const p = queue.shift();
      try { Object.assign(p, await analyse(p.images[0])); done++; } catch (e) { failed++; console.warn(`skip ${p.id}: ${e.message}`); }
      if ((done + failed) % 50 === 0) { fs.writeFileSync(FILE, JSON.stringify(catalogue, null, 1)); console.log(`${done + failed}/${todo.length}`); }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  fs.writeFileSync(FILE, JSON.stringify(catalogue, null, 1));
  console.log(`analysed ${done} products, ${failed} failed; ${catalogue.filter((p) => p.blurhash && p.dominantHex).length}/${catalogue.length} complete`);
}
