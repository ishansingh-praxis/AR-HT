// Turns HomeTown's Shopify export rows into clean product records.
// The export has one row per variant/image, with product-level fields only on the first row of each handle.

const col = (row, prefix) => {
  for (const k of Object.keys(row)) if (k.startsWith(prefix)) return row[k];
  return '';
};
const clean = (s) => (s ?? '').toString().trim();

/** "470 MM" -> 470, "63.5 CM" -> 635, "2290" -> 2290 (bare numbers: >=300 assumed mm, else cm). Returns { mm, ambiguous }. */
export function parseMm(raw) {
  const s = clean(raw);
  if (!s || /lift|up|down|\|/i.test(s)) return null; // adjustable-height strings are not usable
  const m = s.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|inch|in|")?\b/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (!(v > 0)) return null;
  const unit = (m[2] ?? '').toLowerCase();
  if (unit === 'mm') return { mm: v, ambiguous: false };
  if (unit === 'cm') return { mm: v * 10, ambiguous: false };
  if (unit === 'm') return { mm: v * 1000, ambiguous: false };
  if (unit === 'inch' || unit === 'in' || unit === '"') return { mm: v * 25.4, ambiguous: false };
  return v >= 300 ? { mm: v, ambiguous: v < 500 } : { mm: v * 10, ambiguous: v >= 100 };
}

/**
 * Length/width/depth labels are used inconsistently, so the footprint is the two largest horizontal values.
 * status: complete (2+ horizontal + height) | partial | missing.  confidence: high only if no value needed unit guessing.
 */
export function parseDimensions(row) {
  const L = parseMm(col(row, 'product_length')), W = parseMm(col(row, 'product_width')),
        D = parseMm(col(row, 'product_depth')), H = parseMm(col(row, 'product_height'));
  const horiz = [L, W, D].filter(Boolean).sort((a, b) => b.mm - a.mm);
  const ambiguous = [L, W, D, H].some((x) => x?.ambiguous);
  const cm = (x) => Math.round(x.mm / 10);
  if (horiz.length >= 2 && H) {
    return { w: cm(horiz[0]), d: cm(horiz[1]), h: cm(H), status: 'complete', confidence: ambiguous ? 'low' : 'high' };
  }
  if (horiz.length >= 1 || H) {
    return { w: horiz[0] ? cm(horiz[0]) : null, d: horiz[1] ? cm(horiz[1]) : null, h: H ? cm(H) : null, status: 'partial', confidence: 'low' };
  }
  return { w: null, d: null, h: null, status: 'missing', confidence: 'low' };
}

// Order matters: first match wins.
const ROLE_RULES = [
  [/mattress|bedsheet|pillow|cushion|towel|bath rug|curtain/i, null],
  [/dining (set|table)|\d seater dining/i, 'dining-table'],
  [/sofa|recliner|loveseat|settee|couch|diwan|futon/i, 'sofa'],
  [/(king|queen|single|double|storage|poster|kids|bunk|day)?\s*beds?$|^beds?$/i, 'bed'],
  [/center table|centre table|coffee table|nesting table/i, 'coffee-table'],
  [/side & end|side table|end table|bedside|night ?stand|console/i, 'side-table'],
  [/study table|desk|computer table|work ?station/i, 'desk'],
  [/dressing table|dresser/i, 'storage'],
  [/tv unit|tv stand|entertainment/i, 'tv-unit'],
  [/wardrobe|almirah/i, 'wardrobe'],
  [/bookshelf|bookcase|shelf|shelves|cabinet|sideboard|chest|shoe rack|crockery|bar unit|storage/i, 'storage'],
  [/chair|stool|lounger|ottoman|pouffe|pouf|bench|swing/i, 'chair'],
  [/\b(rug|carpet|dhurrie|runner)\b/i, 'rug'],
  [/floor lamp|standing lamp|arc lamp/i, 'lamp'],
];
export function roleFor(segment, subCategory, title) {
  for (const hay of [segment, subCategory, title]) {
    const h = clean(hay);
    if (!h) continue;
    for (const [re, role] of ROLE_RULES) if (re.test(h)) return role;
  }
  return null;
}

const COLOR_HEX = {
  brown: '#7A5230', multicolor: '#999999', grey: '#8A8D91', gray: '#8A8D91', black: '#222222', gold: '#C9A24B',
  white: '#F2F0EB', beige: '#D8C8AC', blue: '#3F66A8', transparent: '#DDE6EA', green: '#4F7A57', silver: '#B8BCC2',
  pink: '#D58BA0', red: '#B03A35', orange: '#D9822B', yellow: '#E0C040', purple: '#6C4A8E', cream: '#EFE4CC',
  tan: '#B58B5E', teal: '#2F7F7A', walnut: '#5A3E2B', oak: '#B58B52',
};
export const hexForColor = (name) => COLOR_HEX[clean(name).toLowerCase().split(/[ /,&-]/)[0]] ?? null;

/** Group raw rows by handle (rows of one product are consecutive in the export, but don't rely on it). */
export function groupByHandle(rows) {
  const map = new Map();
  for (const r of rows) {
    const h = clean(r['Handle']);
    if (!h) continue;
    if (!map.has(h)) map.set(h, []);
    map.get(h).push(r);
  }
  return map;
}

export function normalizeProduct(handle, rows) {
  const head = rows.find((r) => clean(r['Title'])) ?? rows[0];
  const segment = clean(col(head, 'segment ('));
  const subCategory = clean(col(head, 'sub category (')) || clean(col(head, 'product_subcategory'));
  const title = clean(head['Title']);
  const prices = rows.map((r) => parseFloat(r['Variant Price'])).filter((x) => x > 0);
  const compare = rows.map((r) => parseFloat(r['Variant Compare At Price'])).filter((x) => x > 0);
  const images = [...new Set(rows.map((r) => clean(r['Image Src'])).filter(Boolean))].slice(0, 6);
  const colorOpt = [1, 2, 3].flatMap((n) => rows.filter((r) => /colou?r/i.test(clean(r[`Option${n} Name`]))).map((r) => clean(r[`Option${n} Value`]))).filter(Boolean);
  const colorFamily = clean(col(head, 'Color Family ('));
  const grams = parseFloat(head['Variant Grams']);
  const dims = parseDimensions(head);
  return {
    handle,
    sku: clean(rows.find((r) => clean(r['Variant SKU']))?.['Variant SKU']),
    title,
    vendor: clean(head['Vendor']),
    status: clean(head['Status']),
    published: clean(head['Published']).toLowerCase() === 'true',
    category: clean(col(head, 'category (')),
    segment,
    subCategory,
    role: roleFor(segment, subCategory, title),
    material: clean(col(head, 'main_material')),
    colorFamily,
    colors: [...new Set(colorOpt)].slice(0, 8),
    paletteHex: hexForColor(colorFamily) ?? hexForColor(colorOpt[0]) ?? null,
    priceInr: prices.length ? Math.min(...prices) : null,
    compareAtInr: compare.length ? Math.min(...compare) : null,
    seater: clean(col(head, 'Seater (')),
    weightKg: grams > 0 ? Math.round(grams / 100) / 10 : null,
    dimensions: dims,
    images,
    tags: clean(head['Tags']).split(',').map((t) => t.trim()).filter(Boolean),
    linked: clean(col(head, 'Linked Products (')).split(/[,;|\n]/).map((s) => s.trim()).filter(Boolean),
  };
}
