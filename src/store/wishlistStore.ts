import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateWishlist, toggleWish, type WishItem } from '../utils/wishlist';
import { useSync } from './syncStore';

interface WishlistState { items: WishItem[]; toggle: (id: string) => boolean; replaceAll: (items: WishItem[]) => void }

/** Saved furniture ("Save for later"). `toggle` returns true when the item was added. */
export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (id) => {
        const next = toggleWish(get().items, id, Date.now());
        set({ items: next });
        const added = next.some((w) => w.id === id);
        useSync.getState().wish(id, added);
        return added;
      },
      replaceAll: (items) => set({ items }),
    }),
    { name: 'wishlist', version: 1, storage: createJSONStorage(() => AsyncStorage), migrate: (old: any) => ({ items: migrateWishlist(old?.items ?? old?.ids) }) },
  ),
);
