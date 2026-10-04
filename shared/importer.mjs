// Turns HomeTown's Shopify export (CSV text) into catalogue products. Pure: no file access, so the CLI and the server's admin import share it.
import { parse } from 'csv-parse/sync';
import { categoryFor, floorSize, plausible, sizeFlag, wallSize, roleFor, roomTypesFor, colorsFor, collections, pruneLinks, setSizeFor } from './catalogue-rules.mjs';

const FURN = new Set(['Furniture', 'Living Room Furniture', 'Bedroom Furniture', 'Dining Room Furniture', 'Office Furniture', 'Bar Furniture', 'Kids Furniture']);
const WALL = new Set(['Wall Decor', 'Wall Clocks', 'Painting & Frames']);
const str = (v) => (v == null || String(v).trim() === '' ? undefined : String(v).trim());
const handles = (...vals) => [...new Set(vals.flatMap((v) => (typeof v === 'string' ? v.split(/[;,]/).map((h) => h.trim()).filter(Boolean) : [])))];

/** @returns {{ products: object[], issues: object[] }} */
export function buildCatalogue(csvText) {
  // Header "category (product.metafields.x)" -> "category".
  const rows = parse(csvText, { columns: (h) => h.map((c) => (c.includes('(product') ? c.split('(product.metafields.')[0].trim() : c.trim())), skip_empty_lines: true, relax_column_count: true, bom: true });
  const imgs = new Map();
  const priceBy = new Map();
  for (const r of rows) {
    const h = r.Handle;
    if (r['Image Src']) (imgs.get(h) ?? imgs.set(h, []).get(h)).push([Number(r['Image Position']) || 99, r['Image Src']]);
    const p = parseFloat(r['Variant Price']);
    if (p > 0) priceBy.set(h, Math.min(priceBy.get(h) ?? Infinity, p));
  }
  const photos = (h) => (imgs.get(h) ?? []).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const heads = rows.filter((r) => r.Title && r.Status === 'active');

  const out = [];
  const issues = [];
  for (const r of heads.filter((r) => FURN.has(r.category))) {
    const h = r.Handle, title = r.Title;
    const category = categoryFor(r.segment, title);
    if (!category) continue;
    const size = floorSize(category, { length: r.product_length, width: r.product_width, depth: r.product_depth, height: r.product_height });
    if (!size) continue;
    const { w, d, h: H } = size;
    if (!plausible(w, d, H)) { issues.push({ id: h, name: title, problem: 'implausible size', cm: [w, d, H] }); continue; }
    if (!photos(h).length) { issues.push({ id: h, name: title, problem: 'no photo' }); continue; }
    const name = title.split('|')[0].trim();
    const role = roleFor(r.segment, title) ?? 'decor';
    const e = {
      id: h, name, category, subcategory: str(r.segment), brand: str(r.Vendor), images: photos(h).slice(0, 4),
      dimensionsCm: { w, d, h: H }, material: str(r.main_material), colorFamily: str(r['Color Family']), family: str(r.family_name),
      role, roomTypes: roomTypesFor(role, r.category), colors: colorsFor(r['Color Family']), dimsConfidence: size.confidence,
      sku: str(r['Variant SKU']), priceInr: priceBy.get(h), setSize: setSizeFor(name), linked: handles(r['Linked Products']),
      related: handles(r['Related products'], r.related_products, r['Complementary products']),
      retailerUrl: `https://www.hometown.in/products/${h}`, ar: { placements: ['floor'] },
    };
    const why = sizeFlag(category, title, w, d, H);
    if (why) { e.sizeReview = why; e.dimsConfidence = 'low'; }
    out.push(e);
  }

  // Wall decor: width = length, depth = thickness.
  for (const r of heads.filter((r) => WALL.has(r.segment))) {
    const h = r.Handle;
    if (out.some((x) => x.id === h) || !photos(h).length) continue;
    const sz = wallSize(r.segment, { length: r.product_length, width: r.product_width, height: r.product_height });
    if (!sz) continue;
    out.push({
      id: h, name: r.Title.split('|')[0].trim(), category: 'Wall', subcategory: str(r.segment), brand: str(r.Vendor), images: photos(h).slice(0, 4),
      dimensionsCm: sz, material: str(r.main_material), colorFamily: str(r['Color Family']), family: str(r.family_name),
      role: 'wall-art', roomTypes: roomTypesFor('wall-art'), colors: colorsFor(r['Color Family']), dimsConfidence: 'high',
      sku: str(r['Variant SKU']), priceInr: priceBy.get(h), linked: [], related: [],
      retailerUrl: `https://www.hometown.in/products/${h}`, ar: { placements: ['wall'] },
    });
  }

  const ids = new Set(out.map((x) => x.id));
  const coll = collections(out.map((x) => x.name));
  for (const x of out) {
    x.linked = pruneLinks(x.linked, ids, x.id);
    x.related = pruneLinks(x.related, ids, x.id);
    if (coll.has(x.name)) x.collection = coll.get(x.name);
    for (const k of Object.keys(x)) if (x[k] === undefined || x[k] === '' || (Array.isArray(x[k]) && !x[k].length && k !== 'colors')) delete x[k];
  }
  return { products: out, issues };
}

/** Compares freshly imported products with the live catalogue. Fields owned by the 3D pipeline (model, proxy, status) are ignored. */
export function diffCatalogue(current, incoming) {
  const SKIP = new Set(['model3D', 'modelStatus', 'proxy', 'demo']);
  const clean = (p) => JSON.stringify(Object.fromEntries(Object.entries(p).filter(([k]) => !SKIP.has(k)).sort(([a], [b]) => (a < b ? -1 : 1))));
  const cur = new Map(current.map((p) => [p.id, p]));
  const inc = new Map(incoming.map((p) => [p.id, p]));
  const added = incoming.filter((p) => !cur.has(p.id)).map((p) => p.id);
  const changed = incoming.filter((p) => cur.has(p.id) && clean(cur.get(p.id)) !== clean(p)).map((p) => p.id);
  // Products that carry a model are never removed by an import (they were put there by hand).
  const removed = current.filter((p) => !inc.has(p.id) && !p.model3D).map((p) => p.id);
  const flagged = incoming.filter((p) => p.sizeReview).map((p) => p.id);
  return { added, changed, removed, flagged };
}
