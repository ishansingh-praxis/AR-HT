import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';

/**
 * Checks an uploaded GLB against the product's listed dimensions.
 * Same rules as scripts/validate-models.mjs: size within tolerance is a hard failure;
 * origin, base-on-floor and file size are warnings.
 */
export async function checkGlb(buffer, dimsCm, { tolerance = 0.05, maxMb = 8, originTolM = 0.05 } = {}) {
  const issues = [];
  const warnings = [];
  let doc;
  try {
    doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).readBinary(new Uint8Array(buffer));
  } catch (e) {
    return { ok: false, issues: [`Not a readable GLB: ${e.message}`], warnings, sizeCm: null };
  }
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (!scene) return { ok: false, issues: ['GLB has no scene'], warnings, sizeCm: null };
  const { min, max } = getBounds(scene);
  const size = { w: max[0] - min[0], h: max[1] - min[1], d: max[2] - min[2] };
  for (const k of ['w', 'd', 'h']) {
    const want = dimsCm[k] / 100;
    const err = Math.abs(size[k] - want) / want;
    if (err > tolerance) issues.push(`${k}: model is ${(size[k] * 100).toFixed(0)} cm but listed as ${dimsCm[k]} cm (${(err * 100).toFixed(0)}% off)`);
  }
  const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2;
  if (Math.abs(min[1]) > originTolM) warnings.push(`base is ${(min[1] * 100).toFixed(0)} cm off the floor`);
  if (Math.abs(cx) > originTolM || Math.abs(cz) > originTolM) warnings.push('origin is not at the centre of the footprint');
  if (buffer.length / 1e6 > maxMb) warnings.push(`file is ${(buffer.length / 1e6).toFixed(1)} MB (budget ${maxMb} MB)`);
  // What a reviewer wants to see next to the photos: triangle count, texture sizes, file size.
  let triangles = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const idx = prim.getIndices(), pos = prim.getAttribute('POSITION');
    triangles += Math.floor((idx ? idx.getCount() : (pos?.getCount() ?? 0)) / 3);
  }
  const textures = doc.getRoot().listTextures().map((t) => ({ name: t.getName() || t.getURI() || 'texture', mime: t.getMimeType(), size: t.getSize() }));
  if (triangles > 50_000) warnings.push(`${triangles.toLocaleString()} triangles (budget 50,000)`);
  for (const t of textures) if (t.size && Math.max(...t.size) > 1024) warnings.push(`texture ${t.name} is ${t.size[0]}x${t.size[1]} (budget 1024 px)`);
  const sizeCm = { w: size.w * 100, d: size.d * 100, h: size.h * 100 };
  return {
    ok: issues.length === 0, issues, warnings, sizeCm, triangles, textures, fileMb: Math.round(buffer.length / 1e4) / 100,
    origin: { x: Math.round(cx * 1000) / 10, z: Math.round(cz * 1000) / 10, baseY: Math.round(min[1] * 1000) / 10 }, // cm
  };
}
