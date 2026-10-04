import { Product, SampleRoom } from '../types/furniture';
import { useCatalogue } from '../store/catalogueStore';
import rooms from './rooms.json';

export const SAMPLE_ROOMS = rooms as SampleRoom[];
export const getRoom = (id: string) => SAMPLE_ROOMS.find((r) => r.id === id);

/** Reactive list for screens. */
export const useProducts = () => useCatalogue((s) => s.products);
/** Non-reactive lookup. Call useProducts() in the screen too so it re-renders when the catalogue updates. */
export const getFurniture = (id: string) => useCatalogue.getState().products.find((f) => f.id === id);

export const cm = (p: Product) => `${p.dimensionsCm.w} × ${p.dimensionsCm.d} × ${p.dimensionsCm.h} cm`;
