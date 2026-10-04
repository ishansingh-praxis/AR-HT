// Adds `import { t } from '<rel>/i18n'` to every source file that calls t('...') without importing it.
import fs from 'node:fs';
import path from 'node:path';
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts') ? [path.join(d, e.name)] : []));
let n = 0;
for (const file of walk('src')) {
  if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
  let src = fs.readFileSync(file, 'utf8');
  if (!/\bt\((?:'|`)/.test(src) || /from '(\.\.?\/)+i18n'/.test(src)) continue;
  const rel = path.relative(path.dirname(file), path.resolve('src/i18n')).split(path.sep).join('/');
  const imp = `import { t } from '${rel.startsWith('.') ? rel : './' + rel}';\n`;
  const last = [...src.matchAll(/^import [\s\S]*?from '[^']+';\n/gm)].at(-1);
  src = last ? src.slice(0, last.index + last[0].length) + imp + src.slice(last.index + last[0].length) : imp + src;
  fs.writeFileSync(file, src); n++; console.log('import added:', file);
}
console.log(n, 'files');
