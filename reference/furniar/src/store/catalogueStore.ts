import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import bundled from '../data/catalogue.json';
import { API_URL, fetchProducts } from '../services/api';
import type { Product } from '../types/furniture';

interface CatalogueState {
  products: Product[];
  source: 'bundled' | 'server' | 'cached';
  refresh: () => Promise<void>;
}

/** Server data is cached on-device, so the catalogue still opens offline. Falls back to the bundled demo data. */
export const useCatalogue = create<CatalogueState>()(
  persist(
    (set) => ({
      products: bundled as Product[],
      source: 'bundled',
      refresh: async () => {
        if (!API_URL) return;
        try {
          const items = await fetchProducts();
          if (items.length) set({ products: items, source: 'server' });
        } catch {
          set((s) => ({ source: s.source === 'bundled' ? 'bundled' : 'cached' }));
        }
      },
    }),
    { name: 'catalogue', storage: createJSONStorage(() => AsyncStorage), // Only cache what came from the server. Persisting the bundled list would pin users to an old catalogue after an app update.
      partialize: (s) => (s.source === 'bundled' ? {} : { products: s.products, source: s.source }) }
  )
);
