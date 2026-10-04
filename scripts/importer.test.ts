import assert from 'node:assert/strict';
import { buildCatalogue, diffCatalogue } from '../shared/importer.mjs';

const csv = [
  'Handle,Title,Status,Vendor,category (product.metafields.custom.category),segment,product_length,product_width,product_depth,product_height,Image Src,Image Position,Variant Price,Variant SKU,Color Family,main_material,family_name',
  'sofa-a,Trio 3 Seater Sofa | Fabric,active,HomeTown,Living Room Furniture,3 Seater Sofas,2100 MM,900 MM,,850 MM,https://cdn.test/a1.jpg,1,29999,SKU-A,Grey,Fabric,Trio',
  'sofa-a,,,,,,,,,,https://cdn.test/a2.jpg,2,,,,,',
  'sofa-b,Giant Sofa,active,HomeTown,Living Room Furniture,3 Seater Sofas,9000 MM,3000 MM,,850 MM,https://cdn.test/b1.jpg,1,1,SKU-B,Grey,Fabric,Giant',
  'sofa-c,No Photo Sofa,active,HomeTown,Living Room Furniture,3 Seater Sofas,2000 MM,900 MM,,850 MM,,,1,SKU-C,Grey,Fabric,NoPhoto',
  'sofa-d,Retired Sofa,archived,HomeTown,Living Room Furniture,3 Seater Sofas,2000 MM,900 MM,,850 MM,https://cdn.test/d1.jpg,1,1,SKU-D,Grey,Fabric,Retired',
].join('\n');

const { products, issues } = buildCatalogue(csv);
assert.deepEqual(products.map((p) => p.id), ['sofa-a'], 'only the active, plausible, photographed sofa is imported');
const a = products[0];
assert.deepEqual(a.dimensionsCm, { w: 210, d: 90, h: 85 });
assert.equal(a.category, 'Sofa');
assert.equal(a.role, 'sofa');
assert.equal(a.images.length, 2);
assert.equal(a.retailerUrl, 'https://www.hometown.in/products/sofa-a');
assert.deepEqual(issues.map((i) => `${i.id}:${i.problem}`).sort(), ['sofa-b:implausible size', 'sofa-c:no photo']);
assert.equal(buildCatalogue('Handle,Title\n').products.length, 0, 'an empty export is fine');

// ---- diff against the live catalogue ----
const live = [
  { id: 'sofa-a', name: 'Trio 3 Seater Sofa', dimensionsCm: { w: 200, d: 90, h: 85 } },                   // size changed
  { id: 'gone', name: 'Old', dimensionsCm: { w: 1, d: 1, h: 1 } },                                          // not in the export -> removed
  { id: 'hand-made', name: 'Has model', model3D: { key: 'models/x.glb' }, dimensionsCm: { w: 1, d: 1, h: 1 } }, // has a model -> kept
];
const d = diffCatalogue(live, [a, { ...a, id: 'new-one', sizeReview: 'check it' }]);
assert.deepEqual(d.added, ['new-one']);
assert.deepEqual(d.changed, ['sofa-a']);
assert.deepEqual(d.removed, ['gone']);
assert.deepEqual(d.flagged, ['new-one']);
// fields owned by the 3D pipeline never count as changes
const same = diffCatalogue([{ ...a, model3D: { key: 'k' }, modelStatus: 'ready', proxy: { template: 'Sofa', color: 'grey' } }], [a]);
assert.deepEqual(same.changed, []);

console.log('importer tests passed');
