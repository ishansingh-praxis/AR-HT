// Builds src/data/catalogue.json from HomeTown's Shopify export. Replaces build_catalogue.py.
// Usage: npm run build:catalogue -- data/HT_Data_dump.csv   (the rules live in shared/importer.mjs; the admin dashboard uses the same code)
import fs from 'node:fs';
import { buildCatalogue } from '../shared/importer.mjs';

const src = process.argv[2];
if (!src) { console.error('Usage: node scripts/import-catalogue.mjs <HT_Data_dump.csv>'); process.exit(1); }
const OUT = 'src/data/catalogue.json';
const { products: out, issues } = buildCatalogue(fs.readFileSync(src, 'utf8'));

// Entries that already have a 3D model are preserved and win over export rows with the same id.
const keep = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).filter((e) => e.model3D) : [];
const have = new Map(keep.map((e) => [e.id, e]));
for (const x of out) if (have.has(x.id)) Object.assign(have.get(x.id), x, { model3D: have.get(x.id).model3D });
const final = [...keep, ...out.filter((x) => !have.has(x.id))];

fs.writeFileSync(OUT, JSON.stringify(final, null, 1));
fs.writeFileSync('scripts/data_issues.json', JSON.stringify(issues, null, 1));
fs.writeFileSync('scripts/size_review.csv', 'id,name,problem\n' + final.filter((x) => x.sizeReview).map((x) => `${x.id},"${x.name.replace(/"/g, '""')}","${x.sizeReview}"`).join('\n') + '\n');
const count = (k) => final.reduce((m, p) => ((m[p[k]] = (m[p[k]] ?? 0) + 1), m), {});
console.log(`${out.length} products -> ${OUT} (+${keep.length} with models kept); ${issues.length} skipped`);
console.log('by category', count('category'), '\nby role', count('role'));
console.log('sizeReview', final.filter((x) => x.sizeReview).length, 'with collection', final.filter((x) => x.collection).length);
