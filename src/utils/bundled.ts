import type { Product } from '../types/furniture';

/**
 * Marks the products whose real 3D model ships inside the app (assets/models, listed in src/data/bundledModels.ts).
 * The server owns catalogue facts and knows nothing about bundled files, so this is applied to every catalogue the app loads
 * (bundled copy, cached copy, server update). Returns the same array when nothing changes.
 */
export function applyBundled(products: Product[], ids: ReadonlySet<string>): Product[] {
  if (!ids.size) return products;
  let changed = false;
  const out = products.map((p) => {
    if (!ids.has(p.id) || p.model3D?.bundled) return p;
    changed = true;
    return { ...p, model3D: { url: '', version: 1, unit: 'm' as const, bundled: true } };
  });
  return changed ? out : products;
}
