// Every shape must fill the unit cube: the app stretches it to the product's real W x H x D, so a shape that is smaller than the cube would make the piece smaller than listed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';
import { build, COLORS, nearestColour, TEMPLATES } from './make-proxy-models.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'proxy-'));
for (const t of Object.keys(TEMPLATES)) {
  const f = path.join(tmp, `${t}.glb`);
  await build(t, 'walnut', f);
  const doc = await new NodeIO().read(f);
  const { min, max } = getBounds(doc.getRoot().listScenes()[0]);
  const near = (a, b, what) => assert.ok(Math.abs(a - b) <= 0.02, `${t}: ${what} is ${a.toFixed(3)}, expected ${b}`);
  near(min[1], 0, 'base'); near(max[1], 1, 'top'); near(min[0], -0.5, 'left'); near(max[0], 0.5, 'right'); near(min[2], -0.5, 'back'); near(max[2], 0.5, 'front');
  assert.ok(doc.getRoot().listMeshes()[0].listPrimitives().every((p) => p.getAttribute('TEXCOORD_0')), `${t}: has UVs for the photo wrap`);
  assert.ok(fs.statSync(f).size < 20_000, `${t}: stays small`);
}
// photo colour -> nearest palette name
assert.equal(nearestColour('#5B4033'), 'walnut');
assert.equal(nearestColour('#2B3A56'), 'navy');
assert.equal(nearestColour('#EDEAE2'), 'white');
assert.equal(nearestColour('#8C8F92'), 'grey');
assert.ok(nearestColour('#00ff00') in COLORS);
console.log('proxy shape tests passed');
