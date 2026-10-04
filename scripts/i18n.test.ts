import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const en = JSON.parse(fs.readFileSync('src/i18n/en.json', 'utf8'));
const hi = JSON.parse(fs.readFileSync('src/i18n/hi.json', 'utf8'));
const flat = (o: Record<string, unknown>, p = ''): [string, string][] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${p}${k}.`) : [[`${p}${k}`, String(v)] as [string, string]]));
const E = new Map(flat(en)), H = new Map(flat(hi).filter(([k]) => !k.startsWith('_meta')));
const vars = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',');

// every string has a Hindi twin with the same placeholders, and nothing is left empty
for (const [k, v] of E) {
  assert.ok(v.trim().length > 0, `empty English string: ${k}`);
  assert.ok(H.has(k), `Hindi is missing: ${k}`);
  assert.equal(vars(H.get(k)!), vars(v), `placeholders differ in ${k}: ${v} / ${H.get(k)}`);
}
for (const k of H.keys()) assert.ok(E.has(k), `Hindi has a key English does not: ${k}`);
assert.ok(hi._meta?.note, 'hi.json says it is machine translated');

// plural forms come in pairs
for (const k of E.keys()) if (k.endsWith('_one')) assert.ok(E.has(k.replace(/_one$/, '_other')), `${k} needs an _other form`);

// every t('key') or t(`prefix${x}`) in the source points at a real key
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []));
let used = 0;
const dynamic: string[] = [];
for (const file of walk('src')) {
  if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\bt\('([A-Za-z0-9_.]+)'/g)) {
    used++;
    const key = m[1];
    assert.ok(E.has(key) || E.has(`${key}_other`), `${file}: t('${key}') is not in en.json`);
  }
  for (const m of src.matchAll(/\bt\(`([^`]+)`/g)) dynamic.push(m[1]);
}
assert.ok(used > 250, `expected 250+ translated strings in use, found ${used}`);
// dynamic keys: every expansion must exist (tabs in the AR sheet)
for (const tab of ['Suggested', 'All', 'Rooms', 'Tools']) assert.ok(E.has(`sheet.tab${tab}`), `sheet.tab${tab}`);
assert.deepEqual(dynamic.filter((d) => !d.startsWith('sheet.tab')), [], 'unexpected dynamic translation keys (extend this test)');

// no broken keys from the file-extension bug: groups never contain ".ts"
for (const k of E.keys()) assert.ok(!/\.tsx?\./.test(k) && !k.endsWith('.ts'), `bad key ${k}`);
console.log(`i18n tests passed (${E.size} strings, ${used} uses)`);
