import { useMemo } from 'react';
import { useCatalogue } from '../store/catalogueStore';
import type { Product } from '../types/furniture';
import { formatNumber } from '../i18n';
import { SHOW_DEMO } from '../config';

export const ROOM_TYPES = ['Living room', 'Bedroom', 'Dining room', 'Office'] as const;

/** Reactive list for screens. */
export const useProducts = () => useCatalogue((s) => s.products);
const visible = (p: Product) => SHOW_DEMO || !p.demo;
/** Items that can be placed in AR: a photo-real model or the simplified true-scale shape. */
export const usePlaceable = () => {
  const p = useProducts();
  // Real HomeTown products first; the demo test models go last.
  return useMemo(() => p.filter((x) => visible(x) && (!!x.model3D || !!x.proxy)).sort((a, b) => Number(!!a.demo) - Number(!!b.demo)), [p]);
};
/** What distinguishes a variant from `base`: the words in its name that the base lacks (e.g. "Lh", "Grey"). */
export const variantLabel = (v: { name: string }, base: { name: string }) => {
  const have = new Set(base.name.toLowerCase().split(/\s+/));
  const diff = v.name.split(/\s+/).filter((w) => !have.has(w.toLowerCase()));
  return diff.join(' ') || v.name;
};
export const useCategories = () => {
  const p = useProducts();
  return useMemo(() => [...new Set(p.map((x) => x.category))], [p]);
};
// id -> product, rebuilt only when the catalogue array changes: lookups are O(1) (they were a linear scan over ~700 products, called per piece per frame).
let index: { src: Product[]; map: Map<string, Product> } | null = null;
/** Non-reactive lookup. Call useProducts() in the screen too so it re-renders on catalogue updates. */
export const getFurniture = (id: string): Product | undefined => {
  const products = useCatalogue.getState().products;
  if (!index || index.src !== products) index = { src: products, map: new Map(products.map((p) => [p.id, p])) };
  return index.map.get(id);
};
export const sizeLabel = (p: { dimensionsCm: { w: number; d: number; h: number } }) =>
  `${formatNumber(p.dimensionsCm.w)} × ${formatNumber(p.dimensionsCm.d)} × ${formatNumber(p.dimensionsCm.h)} cm`;
