// One-off helper used to move plain, static UI strings out of the screens into src/i18n/en.json and replace them with t('key').
// It only touches strings it can move safely: JSX text without {}, label/placeholder/accessibilityLabel/title attributes with plain
// quotes, and Alert.alert('title', 'message') with plain quotes. Anything with ${...} or JSX expressions is left for a human.
//   node scripts/extract-strings.mjs            (writes the files)    node scripts/extract-strings.mjs --dry   (only reports)
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const ROOTS = ['src/screens', 'src/components', 'src/features', 'src/services'];
const EN = path.resolve('src/i18n/en.json');
const en = fs.existsSync(EN) ? JSON.parse(fs.readFileSync(EN, 'utf8')) : {};
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
const byText = new Map(flat(en).map(([k, v]) => [v, k]));

const files = ROOTS.flatMap((r) => (function walk(d) { return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts') ? [path.join(d, e.name)] : [])); })(r));
const groupOf = (f) => path.basename(f).replace(/\.tsx?$/, '').replace(/Screen$/, '').replace(/^./, (c) => c.toLowerCase());
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 4).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join('') || 'text';

let moved = 0;
for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  const group = groupOf(file);
  const keyFor = (text) => {
    if (byText.has(text)) return byText.get(text);
    let key = `${group}.${slug(text)}`, n = 2;
    while (flat(en).some(([k]) => k === key)) key = `${group}.${slug(text)}${n++}`;
    const [g, k] = key.split('.');
    (en[g] ??= {})[k] = text;
    byText.set(text, key);
    return key;
  };
  const human = (s) => /[A-Za-z]{2}/.test(s) && !/^[a-z0-9_.:/-]+$/.test(s) && !s.includes('${') && !/^#[0-9a-f]{3,8}$/i.test(s);
  const before = src;
  // JSX text: only inside a matching <Tag ...>text</Tag> pair (so TypeScript generics like useState<string | null>(...) are never touched)
  src = src.replace(/(<([A-Z][A-Za-z.]*)\b[^<>]*?(?<!=)>)([^<>{}]*?)(<\/\2>)/g, (m, open, tag, text, close) => {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (!human(trimmed) || /&(apos|quot|amp|lt|gt);/.test(trimmed)) return m;
    const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0];
    return `${open}${lead}{t('${keyFor(trimmed)}')}${trail}${close}`;
  });
  // attributes with plain double-quoted strings
  src = src.replace(/\b(label|placeholder|accessibilityLabel|title)="([^"{}$]+)"/g, (m, attr, text) => (human(text) ? `${attr}={t('${keyFor(text)}')}` : m));
  // Alert.alert('A', 'B' ...) with plain single-quoted args
  src = src.replace(/Alert\.alert\(\s*'([^'$\\]+)'(?:\s*,\s*'([^'$\\]+)')?/g, (m, a, b) => `Alert.alert(t('${keyFor(a)}')${b ? `, t('${keyFor(b)}')` : ''}`);
  if (src !== before) {
    if (!/from '\.\.\/(\.\.\/)*i18n'/.test(src)) {
      const rel = path.relative(path.dirname(file), path.resolve('src/i18n')).split(path.sep).join('/');
      const imp = `import { t } from '${rel.startsWith('.') ? rel : './' + rel}';\n`;
      const lastImport = [...src.matchAll(/^import .*;\n/gm)].pop();
      src = lastImport ? src.slice(0, lastImport.index + lastImport[0].length) + imp + src.slice(lastImport.index + lastImport[0].length) : imp + src;
    }
    if (!DRY) fs.writeFileSync(file, src);
    moved++;
    console.log('updated', file);
  }
}
if (!DRY) { fs.mkdirSync(path.dirname(EN), { recursive: true }); fs.writeFileSync(EN, JSON.stringify(en, null, 2) + '\n'); }
console.log(`${moved} files, ${flat(en).length} strings in en.json`);
