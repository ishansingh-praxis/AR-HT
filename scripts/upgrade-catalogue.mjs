// Adds the unified-model fields (role, roomTypes, colors, dimsConfidence, collection) to the existing catalogue.json.
// Usage: node scripts/upgrade-catalogue.mjs
import fs from 'node:fs';
import { roleFor, roomTypesFor, colorsFor, collections, setSizeFor } from './lib/catalogue-rules.mjs';

const FILE = 'src/data/catalogue.json';
const cat = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const coll = collections(cat.filter((p) => !p.demo).map((p) => p.name));
const BY_CATEGORY = { Sofa: 'sofa', Bed: 'bed', Wardrobe: 'wardrobe', Chair: 'chair', Table: 'side-table', Storage: 'storage' };
for (const p of cat) {
  const wall = p.category === 'Wall';
  p.role = wall ? 'wall-art' : (roleFor(p.subcategory, p.name) ?? BY_CATEGORY[p.category] ?? 'decor');
  p.roomTypes = roomTypesFor(p.role);
  if (!p.colors?.length) p.colors = colorsFor(p.colorFamily);
  p.dimsConfidence = p.sizeReview ? 'low' : 'high';
  const ss = setSizeFor(p.name);
  if (ss) p.setSize = ss;
  const c = coll.get(p.name);
  if (c) p.collection = c;
}
fs.writeFileSync(FILE, JSON.stringify(cat, null, 1));
const by = (k) => cat.reduce((m, p) => ((m[p[k]] = (m[p[k]] ?? 0) + 1), m), {});
console.log('by category', by('category'));
console.log('by role', by('role'));
console.log('placeable', cat.filter((p) => !p.sizeReview).length, 'sizeReview', cat.filter((p) => p.sizeReview).length, 'with collection', cat.filter((p) => p.collection).length);
