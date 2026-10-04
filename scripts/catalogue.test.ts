import assert from 'node:assert/strict';
import { setSizeFor, parseMm, floorSize, sizeFlag, roleFor, hexForColor, categoryFor, wallSize, collections, roomTypesFor } from './lib/catalogue-rules.mjs';

// unit parsing
assert.deepEqual(parseMm('470 MM'), { mm: 470, ambiguous: false });
assert.equal(parseMm('63.5 CM')!.mm, 635);
assert.deepEqual(parseMm('2290'), { mm: 2290, ambiguous: false });
assert.equal(parseMm('Lift Up 1050 | Lift Down 940'), null);
assert.ok(Math.abs(parseMm('24 in')!.mm - 609.6) < 1e-6);
assert.equal(parseMm('90')!.mm, 900);
assert.equal(parseMm('')!, null);

// category
assert.equal(categoryFor('Mattress', 'x'), null);
assert.equal(categoryFor('3 Seater Sofas', ''), 'Sofa');
assert.equal(categoryFor('', 'King Size Bed'), 'Bed');

// floor size: labels swapped, height echoed in length
const sofa = floorSize('Sofa', { length: '900 MM', width: '1905 MM', depth: '', height: '770 MM' })!;
assert.deepEqual([sofa.w, sofa.d, sofa.h, sofa.confidence], [190.5, 90, 77, 'high']);
const echoed = floorSize('Chair', { length: '450 MM', width: '500 MM', depth: '900 MM', height: '900 MM' })!;
assert.deepEqual([echoed.w, echoed.d, echoed.h], [50, 45, 90]);
// bed fix: headboard height stored in the length column
const bed = floorSize('Bed', { length: '1200', width: '2065', depth: '1895', height: '1895' })!;
assert.equal(bed.h, 120); assert.equal(bed.w, 189.5); assert.equal(bed.d, 206.5);
assert.equal(floorSize('Sofa', { length: '900', width: '', depth: '', height: '800' }), null);
assert.equal(floorSize('Sofa', { length: '90', width: '190', depth: '80', height: '80' })!.confidence, 'low'); // bare numbers need guessing

// plausibility rules
assert.match(sizeFlag('Sofa', 'Siam Sofa', 190, 90, 150)!, /height/);
assert.match(sizeFlag('Sofa', 'Siam Sofa', 190, 180, 80)!, /deep/);
assert.equal(sizeFlag('Sofa', 'Corner Sofa Set', 300, 180, 80), null);
assert.match(sizeFlag('Sofa', 'Slim', 50, 80, 80)!, /narrow/);
assert.match(sizeFlag('Wardrobe', 'Nova Wardrobe', 100, 90, 200)!, /deep/);
assert.match(sizeFlag('Wardrobe', 'Nova Wardrobe', 40, 55, 200)!, /narrow/);
assert.match(sizeFlag('Bed', 'Diago King Bed', 80, 200, 90)!, /small/);
assert.equal(sizeFlag('Bed', 'Kids Bed', 80, 190, 90), null);
assert.match(sizeFlag('Chair', 'Chair', 50, 120, 90)!, /deep/);
assert.match(sizeFlag('Storage', 'Cabinet', 80, 90, 120)!, /deep/);
assert.match(sizeFlag('Table', 'Antwerp Night Stand', 209.3, 194.6, 115)!, /copy-paste/);
assert.match(sizeFlag('Table', 'Oak Dresser', 100, 90, 140)!, /dresser/);
assert.equal(sizeFlag('Sofa', 'Siam Sofa', 190.5, 90, 77), null);

// wall pieces
assert.deepEqual(wallSize('Wall Clocks', { length: '48 CM', width: '10 CM', height: '48 CM' }), { w: 48, d: 10, h: 48 });
assert.equal(wallSize('Painting & Frames', { length: '30 CM', width: '10 CM', height: '40 CM' }), null);
assert.equal(wallSize('Wall Decor', { length: '10 CM', width: '2 CM', height: '10 CM' }), null);

// roles: real product names
const roles: [string, string][] = [
  ['Siam 3 Seater Sofa', 'sofa'], ['Diago King Size Bed', 'bed'], ['Hopton Solid Wood Bench', 'chair'],
  ['Nova Center Table', 'coffee-table'], ['Antwerp Night Stand', 'side-table'], ['Orion Study Table', 'desk'],
  ['Zara Dressing Table', 'storage'], ['Lumos TV Unit', 'tv-unit'], ['Alto 3 Door Wardrobe', 'wardrobe'],
  ['Cube Shoe Rack', 'storage'], ['Metro Dining Table Set', 'dining-table'], ['Viva Accent Chair', 'chair'],
  ['Persian Rug', 'rug'], ['Arc Floor Lamp', 'lamp'], ['Gold Wall Clock', 'wall-art'], ['Bar Stool', 'chair'], ['Crockery Unit', 'storage'],
];
for (const [name, role] of roles) assert.equal(roleFor(name), role, name);
assert.equal(roleFor('Memory Foam Mattress'), null);

// colours
assert.equal(hexForColor('Brown'), '#7A5230');
assert.equal(hexForColor('Walnut / Oak'), '#5A3E2B');
assert.equal(hexForColor('Unknown'), null);

// collections + room types
const c = collections(['Nova Sofa', 'Nova Bed', 'Nova Table', 'Solo Chair']);
assert.equal(c.get('Nova Sofa'), 'nova'); assert.equal(c.has('Solo Chair'), false);
assert.deepEqual(roomTypesFor('sofa'), ['living']);
assert.ok(roomTypesFor('storage', 'Bedroom Furniture').includes('bedroom'));

assert.equal(setSizeFor('Oren Dinning Chair Set of 2 Beige'), 2); assert.equal(setSizeFor('Sofa'), undefined);
console.log('catalogue tests passed');
