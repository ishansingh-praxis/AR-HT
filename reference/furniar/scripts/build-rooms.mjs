// Usage: node --experimental-strip-types scripts/build-rooms.mjs [products.json]
// Builds src/data/catalogue.json (curated HomeTown products + demo GLB models) and src/data/rooms.json.
import fs from 'node:fs';
import { ROOMS } from './rooms/curation.mjs';

const input = process.argv[2] ?? 'server/data/hometown-products.json';
const all = JSON.parse(fs.readFileSync(input, 'utf8'));
const byHandle = new Map(all.map((p) => [p.handle, p]));
const demo = JSON.parse(fs.readFileSync('scripts/rooms/demo-catalogue.json', 'utf8'));

// A "family" is a collection name (Nova, Oren...) shared by 3+ active furniture products.
const first = (t) => t.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
const famCount = {};
for (const p of all) if (p.status === 'active' && p.role) famCount[first(p.title)] = (famCount[first(p.title)] ?? 0) + 1;
const familyOf = (p) => (famCount[first(p.title)] >= 3 ? first(p.title) : null);

/** Canonical orientation: front faces +z. Beds run head-to-foot along z; everything else is widest along x. */
const canonical = (role, d) => (role === 'bed' ? { w: Math.min(d.w, d.d), d: Math.max(d.w, d.d), h: d.h } : { w: d.w, d: d.d, h: d.h });
const setSize = (t) => Number((t.match(/set of (\d)|s\/(\d)/i) ?? [])[1] ?? (t.match(/set of (\d)|s\/(\d)/i) ?? [])[2]) || undefined;

const products = new Map();
const rooms = [];
for (const r of ROOMS) {
  const pieces = [];
  for (const pc of r.pieces) {
    const raw = byHandle.get(pc.h);
    if (!raw) throw new Error(`${r.id}: product not found in export: ${pc.h}`);
    if (raw.dimensions.status !== 'complete') throw new Error(`${r.id}: ${pc.h} has incomplete dimensions`);
    if (!products.has(raw.handle)) {
      products.set(raw.handle, {
        id: raw.handle, sku: raw.sku, name: raw.title, category: raw.category || 'Furniture', role: raw.role,
        subcategory: raw.segment, brand: raw.vendor, material: raw.material,
        description: [raw.title, raw.material && `Material: ${raw.material}`].filter(Boolean).join('. '),
        priceInr: raw.priceInr ?? undefined, compareAtInr: raw.compareAtInr ?? undefined,
        images: raw.images, modelStatus: 'proxy',
        dimensionsCm: canonical(raw.role, raw.dimensions), dimsConfidence: raw.dimensions.confidence,
        weightKg: raw.weightKg ?? undefined,
        colors: raw.paletteHex ? [{ name: raw.colorFamily || 'Default', hex: raw.paletteHex }] : [],
        styles: r.style, roomTypes: [r.roomType], setSize: setSize(raw.title), family: familyOf(raw) ?? undefined,
        ar: { placements: ['floor'] }, source: 'hometown',
      });
    } else {
      const p = products.get(raw.handle);
      p.styles = [...new Set([...p.styles, ...r.style])];
      p.roomTypes = [...new Set([...p.roomTypes, r.roomType])];
    }
    pieces.push({ productId: raw.handle, x: pc.x, z: pc.z, rot: pc.rot, anchor: !!pc.anchor });
  }
  rooms.push({ id: r.id, title: r.title, roomType: r.roomType, style: r.style, blurb: r.blurb, notes: r.notes, roomCm: r.room, pieces });
}

const demoProducts = demo.map((d) => ({ ...d, role: d.category === 'Sofa' ? 'sofa' : 'chair', modelStatus: 'ready', source: 'demo', styles: [], roomTypes: ['living'], dimsConfidence: 'high' }));
fs.writeFileSync('src/data/catalogue.json', JSON.stringify([...products.values(), ...demoProducts], null, 1));
fs.writeFileSync('src/data/rooms.json', JSON.stringify(rooms, null, 1));
console.log(`catalogue: ${products.size} HomeTown products + ${demoProducts.length} demo GLB models; rooms: ${rooms.length}`);
