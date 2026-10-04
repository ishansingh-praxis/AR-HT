// Usage: node scripts/import-hometown.mjs <export.csv> [--out server/data/hometown-products.json]
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { groupByHandle, normalizeProduct } from './hometown/normalize.mjs';

const [, , input, ...rest] = process.argv;
if (!input) { console.error('Usage: node scripts/import-hometown.mjs <export.csv> [--out file.json]'); process.exit(1); }
const outFile = rest[rest.indexOf('--out') + 1] ?? 'server/data/hometown-products.json';

const rows = parse(fs.readFileSync(input), { columns: true, bom: true, relax_column_count: true, skip_empty_lines: true });
const products = [...groupByHandle(rows)].map(([h, r]) => normalizeProduct(h, r));
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(products));

const active = products.filter((p) => p.status === 'active');
const arReady = active.filter((p) => p.role && p.dimensions.status === 'complete' && p.images.length);
const by = (list, f) => list.reduce((m, p) => ((m[f(p)] = (m[f(p)] ?? 0) + 1), m), {});
console.log(`rows ${rows.length} -> products ${products.length}, active ${active.length}`);
console.log(`active with role+complete dims+image (AR-candidates): ${arReady.length}`);
console.log('AR-candidates by role:', by(arReady, (p) => p.role));
console.log('dimension confidence among candidates:', by(arReady, (p) => p.dimensions.confidence));
console.log(`wrote ${outFile}`);
