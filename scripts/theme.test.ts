import assert from 'node:assert/strict';
import { contrast, dark, light, type Palette } from '../src/themePalettes.ts';

assert.ok(Math.abs(contrast('#000000', '#FFFFFF') - 21) < 0.01);
assert.ok(Math.abs(contrast('#777777', '#777777') - 1) < 1e-9);

// text pairs the app actually draws (see theme.ts users): AA needs 4.5:1
const pairs: [keyof Palette, keyof Palette][] = [
  ['ink', 'bg'], ['ink', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['accent', 'bg'], ['accent', 'surface'],
  ['accentInk', 'accent'], ['danger', 'bg'], ['danger', 'surface'],
];
for (const [name, p] of [['light', light], ['dark', dark]] as [string, Palette][]) {
  for (const [fg, bg] of pairs) {
    const c = contrast(p[fg], p[bg]);
    assert.ok(c >= 4.5, `${name}: ${fg} on ${bg} is ${c.toFixed(2)}:1 (needs 4.5)`);
  }
}
assert.deepEqual(Object.keys(light), Object.keys(dark), 'both palettes define the same tokens');
console.log('theme contrast tests passed');
