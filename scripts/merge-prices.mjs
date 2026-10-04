// Adds `priceInr` (the lowest variant price in the Shopify export) to products in src/data/catalogue.json that do not have one yet.
// Unlike a full re-import it touches nothing else (blurhash, colours, shapes, models stay as they are).
//   npm run merge:prices -- "HT Data dump.csv"        (add --force to overwrite existing prices)
import fs from 'node:fs';
import { parse } from 'csv-parse/sync';

const src = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'HT Data dump.csv';
const force = process.argv.includes('--force');
const FILE = 'src/data/catalogue.json';

const rows = parse(fs.readFileSync(src, 'utf8'), { columns: (h) => h.map((c) => (c.includes('(product') ? c.split('(product.metafields.')[0].trim() : c.trim())), skip_empty_lines: true, relax_column_count: true, bom: true });
const lowest = new Map();
for (const r of rows) {
  const price = parseFloat(r['Variant Price']);
  if (price > 0) lowest.set(r.Handle, Math.min(lowest.get(r.Handle) ?? Infinity, Math.round(price)));
}
const catalogue = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let added = 0, missing = 0;
for (const p of catalogue) {
  const price = lowest.get(p.id);
  if (!price) { if (!p.priceInr) missing++; continue; }
  if (force || !p.priceInr) { if (p.priceInr !== price) added++; p.priceInr = price; }
}
fs.writeFileSync(FILE, JSON.stringify(catalogue, null, 1));
console.log(`prices set on ${added} products; ${catalogue.filter((p) => p.priceInr).length}/${catalogue.length} have one; ${missing} without a price in the export`);
