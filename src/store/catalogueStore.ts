import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import bundled from '../data/catalogue.json';
import { API_URL, fetchCatalogue } from '../services/api';
import { applyDelta } from '../sync/catalogue';
import type { Product } from '../types/furniture';

interface CatalogueState {
  products: Product[];
  /** Server catalogue version the products reflect (0 = the bundled copy). */
  version: number;
  source: 'bundled' | 'server' | 'cached';
  /** Load the cached server catalogue from disk (no-op when there is none). */
  hydrate: () => Promise<void>;
  /** Ask the server what changed since `version` and merge it in. */
  refresh: () => Promise<void>;
}

// The server catalogue is ~660 KB: too big for one AsyncStorage value, so it lives in a file. Only {source, version} is persisted.
const cacheFile = () => new File(Paths.document, 'catalogue-cache.json');
const writeCache = (products: Product[]) => {
  try { const f = cacheFile(); if (!f.exists) f.create(); f.write(JSON.stringify(products)); } catch { /* the in-memory copy still works */ }
};

/** Server data is cached on-device, so the catalogue still opens offline. Falls back to the bundled data. */
export const useCatalogue = create<CatalogueState>()(
  persist(
    (set, get) => ({
      products: bundled as unknown as Product[],
      version: 0,
      source: 'bundled',
      hydrate: async () => {
        if (get().source === 'bundled') return;
        try {
          const f = cacheFile();
          if (!f.exists) { set({ source: 'bundled', version: 0 }); return; }
          const items = JSON.parse(await f.text()) as Product[];
          if (Array.isArray(items) && items.length) set({ products: items, source: 'cached' });
        } catch {
          set({ products: bundled as unknown as Product[], source: 'bundled', version: 0 });
        }
      },
      refresh: async () => {
        if (!API_URL) return;
        try {
          const delta = await fetchCatalogue(get().version);
          if (!delta) return; // 304: nothing changed
          const products = applyDelta(get().products, delta);
          set({ products, version: delta.version, source: 'server' });
          writeCache(products);
        } catch {
          set((s) => ({ source: s.source === 'bundled' ? 'bundled' : 'cached' })); // offline: keep what we have
        }
      },
    }),
    {
      name: 'catalogue',
      // Bump when the bundled catalogue changes, so installed apps don't keep serving an old cached copy.
      version: 6,
      migrate: () => ({ source: 'bundled' as const, version: 0 }),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ source: s.source, version: s.version }),
    },
  ),
);
