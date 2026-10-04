// Shared catalogue rules used by import-catalogue.mjs and upgrade-catalogue.mjs. Pure functions, no I/O.
const clean = (s) => (s ?? '').toString().trim();

/** "470 MM" -> 470, "63.5 CM" -> 635, "2290" -> 2290 (bare: >=300 assumed mm, else cm). Returns { mm, ambiguous } or null. */
export function parseMm(raw) {
  const s = clean(raw);
  if (!s || /lift|up|down|\|/i.test(s)) return null; // adjustable-height strings are not usable
  const m = s.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|inch|in|")?(?![a-z])/i);
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
const toCm = (x) => (x ? Math.round(x.mm) / 10 : null);

/** Category from HomeTown's segment (or title). Mattresses are excluded (null). */
export function categoryFor(segment, title) {
  const s = (clean(segment) || clean(title)).toLowerCase();
  if (s.includes('mattress')) return null;
  const rules = [
    ['Sofa', /sofa|lounger|recliner/],
    ['Wardrobe', /wardrobe/],
    ['Bed', /\bbeds?\b/],
    ['Chair', /chair|stool|bench/],
    ['Storage', /shoe rack|chest|cabinet|tv unit|sideboard|trolley|book ?shelf/],
    ['Table', /table|dining set/],
  ];
  for (const [cat, rx] of rules) if (rx.test(s)) return cat;
  return null;
}

/**
 * Floor footprint + height from the export's length/width/depth/height strings.
 * Labels are inconsistent: drop floor values equal to the height, use the two largest as w >= d.
 * Beds: the plausible headboard height (70-150 cm) is the height; the other two values are the floor size.
 * Returns { w, d, h, confidence } or null when unusable.
 */
export function floorSize(category, { length, width, depth, height }) {
  const P = [parseMm(length), parseMm(width), parseMm(depth)];
  const Hp = parseMm(height);
  const vals = P.filter(Boolean).map(toCm);
  let H = toCm(Hp);
  const ambiguous = [...P, Hp].some((x) => x?.ambiguous);
  const nh = H ? vals.filter((x) => Math.abs(x - H) / H > 0.015) : vals;
  const plan = [...(nh.length >= 2 ? nh : vals)].sort((a, b) => b - a);
  if (!H || plan.length < 2) return null;
  let [w, d] = plan;
  if (category === 'Bed' && vals.length >= 2) {
    const three = [...new Set([...vals, H])].sort((a, b) => a - b);
    const hs = three.filter((x) => x >= 70 && x <= 150);
    if (hs.length) {
      H = hs[0];
      const fl = three.filter((x) => x !== H).sort((a, b) => b - a).slice(0, 2);
      if (fl.length === 2) [d, w] = fl; // beds run head-to-foot along depth: d = longer, w = shorter
    }
  }
  return { w, d, h: H, confidence: ambiguous ? 'low' : 'high' };
}

export const plausible = (w, d, h) => w >= 25 && w <= 450 && d >= 15 && d <= 300 && h >= 15 && h <= 260;

/** Typical-range checks per category. A non-null result means "send to human review": the item is not placeable. */
export function sizeFlag(c, title, w, d, h) {
  const t = title.toLowerCase();
  const big = /corner|sectional|l[- ]?shape|lounger|chaise|set|recliner/.test(t);
  const n = (v) => Math.round(v);
  if (c === 'Sofa' && !(h >= 60 && h <= 130)) return `sofa height ${n(h)}cm is unusual`;
  if (c === 'Wardrobe' && !(h >= 100 && h <= 250)) return `wardrobe height ${n(h)}cm is unusual`;
  if (c === 'Bed' && !(h >= 70 && h <= 150)) return `bed height ${n(h)}cm is unusual`;
  if (c === 'Sofa' && d > (big ? 230 : 130)) return `sofa depth ${n(d)}cm is unusually deep`;
  if (c === 'Sofa' && w < 70) return `sofa width ${n(w)}cm is unusually narrow`;
  if (c === 'Wardrobe' && d > 80) return `wardrobe depth ${n(d)}cm is unusually deep`;
  if (c === 'Wardrobe' && w < 60) return `wardrobe width ${n(w)}cm is unusually narrow`;
  if (c === 'Bed' && (w < 90 || d < 90) && !/kid|single/.test(t)) return `bed footprint ${n(w)}x${n(d)}cm is unusually small`;
  if (c === 'Chair' && d > 100) return `chair depth ${n(d)}cm is unusually deep`;
  if (c === 'Storage' && d > 80 && !t.includes('trolley')) return `storage depth ${n(d)}cm is unusually deep`;
  if (c === 'Table' && /night ?stand|bedside|side table|end table|coffee|center table|centre table/.test(t) && (w > 140 || d > 110))
    return `small table listed as ${n(w)}x${n(d)}cm: likely a copy-paste error in the source data`;
  if (c === 'Table' && /dresser|dressing/.test(t) && (d > 70 || w > 180)) return `dresser listed as ${n(w)}x${n(d)}cm: likely wrong in the source data`;
  if (c === 'Table' && d > 140 && !big && !t.includes('dining')) return `table depth ${n(d)}cm is unusually deep`;
  return null;
}

/** Wall pieces: width = length, depth = thickness (capped 15 cm), tiny/huge items skipped, deep "frames" are tabletop. */
export function wallSize(segment, { length, width, height }) {
  const L = toCm(parseMm(length)), T = toCm(parseMm(width)), H = toCm(parseMm(height));
  if (!L || !H || L < 20 || H < 20 || L > 250 || H > 250) return null;
  if (segment === 'Painting & Frames' && T && T > 6) return null;
  return { w: L, d: Math.round(Math.min(T || 3, 15) * 10) / 10, h: H };
}

// Order matters: first match wins.
const ROLE_RULES = [
  [/mattress|bedsheet|pillow|cushion|towel|bath rug|curtain/i, null],
  [/frame|wall clock|wall art|wall decor|painting|mirror/i, 'wall-art'],
  [/dining (set|table)|\d seater dining/i, 'dining-table'],
  [/sofa|recliner|loveseat|settee|couch|diwan|futon|lounger/i, 'sofa'],
  [/(king|queen|single|double|storage|poster|kids|bunk|day)?\s*beds?\b/i, 'bed'],
  [/center table|centre table|coffee table|nesting table/i, 'coffee-table'],
  [/side & end|side table|end table|bedside|night ?stand|console/i, 'side-table'],
  [/study table|desk|computer table|work ?station/i, 'desk'],
  [/dressing table|dresser/i, 'storage'],
  [/tv unit|tv stand|entertainment/i, 'tv-unit'],
  [/wardrobe|almirah/i, 'wardrobe'],
  [/bookshelf|bookcase|shelf|shelves|cabinet|sideboard|chest|shoe rack|crockery|bar unit|storage|trolley/i, 'storage'],
  [/chair|stool|ottoman|pouffe|pouf|bench|swing/i, 'chair'],
  [/\b(rug|carpet|dhurrie|runner)\b/i, 'rug'],
  [/floor lamp|standing lamp|arc lamp/i, 'lamp'],
  [/table/i, 'side-table'],
];
export function roleFor(...hays) {
  for (const hay of hays) {
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

export const colorsFor = (colorFamily) => {
  const hex = hexForColor(colorFamily);
  return hex ? [{ name: clean(colorFamily), hex }] : [];
};

const ROOMS_BY_ROLE = {
  sofa: ['living'],
  'coffee-table': ['living'],
  'tv-unit': ['living'],
  bed: ['bedroom'],
  wardrobe: ['bedroom'],
  'dining-table': ['dining'],
  desk: ['study'],
  chair: ['living', 'dining', 'study', 'bedroom'],
  'side-table': ['living', 'bedroom'],
  storage: ['living', 'bedroom', 'dining', 'study'],
  rug: ['living', 'bedroom'],
  lamp: ['living', 'bedroom', 'study'],
  decor: ['living', 'bedroom', 'dining', 'study'],
  'wall-art': ['living', 'bedroom', 'dining', 'study'],
};
export function roomTypesFor(role, hometownCategory = '') {
  const set = new Set(ROOMS_BY_ROLE[role] ?? ['other']);
  const c = hometownCategory.toLowerCase();
  if (/living/.test(c)) set.add('living');
  if (/bedroom/.test(c)) set.add('bedroom');
  if (/dining/.test(c)) set.add('dining');
  if (/office|study/.test(c)) set.add('study');
  return [...set];
}

export const ROLES = ['sofa', 'bed', 'chair', 'coffee-table', 'side-table', 'dining-table', 'desk', 'tv-unit', 'wardrobe', 'storage', 'rug', 'lamp', 'decor', 'wall-art'];

/** "Collection" = first word of the name when 3+ products share it. Input: array of names. Returns Map name -> collection. */
export function collections(names) {
  const first = (n) => clean(n).split(/[\s|]+/)[0].toLowerCase();
  const count = new Map();
  for (const n of names) count.set(first(n), (count.get(first(n)) ?? 0) + 1);
  const out = new Map();
  for (const n of names) if (first(n).length > 2 && count.get(first(n)) >= 3) out.set(n, first(n));
  return out;
}

/** Keep links only when the target exists in the catalogue. */
export function pruneLinks(list, ids, self) {
  return (list ?? []).filter((h) => ids.has(h) && h !== self);
}

/** "Set of 2" / "S/2" in a product name: how many items one purchase contains. */
export function setSizeFor(name) {
  const m = clean(name).match(/set of (\d)|s\/(\d)/i);
  const n = Number(m?.[1] ?? m?.[2]);
  return n >= 2 ? n : undefined;
}
