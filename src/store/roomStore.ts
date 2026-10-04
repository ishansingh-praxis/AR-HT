import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedDesign } from '../types/furniture';
import { newId } from '../utils/id';
import { useSync } from './syncStore';

interface RoomState {
  designs: SavedDesign[];
  roomType: string;
  setRoomType: (r: string) => void;
  /** Returns the new design's id. */
  save: (d: Pick<SavedDesign, 'items' | 'frame' | 'cloudAnchorId' | 'thumbnailUri'> & { name?: string }) => string;
  rename: (id: string, name: string) => void;
  /** Replace a design's pieces (plan editor). */
  updateItems: (id: string, items: SavedDesign['items']) => void;
  setThumbnail: (id: string, uri: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** Used by sync: replace the whole list with the merged one. */
  replaceAll: (designs: SavedDesign[]) => void;
  /** Sign-out: designs stay on the phone but forget the account they were synced to. */
  detachFromCloud: () => void;
}

/**
 * Saved designs. Every change also records an operation in the sync outbox (only when signed in), so the sync engine
 * knows what to send. Ids are generated here (also used as the server's clientId) so a design created offline is never duplicated.
 */
export const useRooms = create<RoomState>()(
  persist(
    (set, get) => ({
      designs: [],
      roomType: 'Living room',
      setRoomType: (roomType) => set({ roomType }),
      save: (d) => {
        const id = newId(), now = Date.now();
        set({ designs: [{ ...d, id, createdAt: now, updatedAt: now, roomType: get().roomType, name: d.name ?? `${get().roomType} ${get().designs.length + 1}` }, ...get().designs] });
        useSync.getState().upsertDesign(id);
        return id;
      },
      rename: (id, name) => {
        set((s) => ({ designs: s.designs.map((d) => (d.id === id ? { ...d, name: name.trim() || d.name, updatedAt: Date.now() } : d)) }));
        useSync.getState().upsertDesign(id);
      },
      updateItems: (id, items) => {
        set((s) => ({ designs: s.designs.map((d) => (d.id === id ? { ...d, items, updatedAt: Date.now() } : d)) }));
        useSync.getState().upsertDesign(id);
      },
      setThumbnail: (id, thumbnailUri) => {
        set((s) => ({ designs: s.designs.map((d) => (d.id === id ? { ...d, thumbnailUri, thumbnailKey: undefined } : d)) }));
        useSync.getState().upsertDesign(id); // the picture arrives after the design was saved: send it too
      },
      remove: (id) => {
        const cloudId = get().designs.find((d) => d.id === id)?.cloudId;
        set((s) => ({ designs: s.designs.filter((d) => d.id !== id) }));
        useSync.getState().deleteDesign(id, cloudId);
      },
      clear: () => set({ designs: [] }),
      replaceAll: (designs) => set({ designs: [...designs].sort((a, b) => b.createdAt - a.createdAt) }),
      detachFromCloud: () => set((s) => ({ designs: s.designs.map(({ cloudId: _c, serverUpdatedAt: _s, thumbnailKey: _t, ...rest }) => rest) })),
    }),
    {
      name: 'designs', version: 2, storage: createJSONStorage(() => AsyncStorage),
      // v1 kept a pendingOps queue (replaced by the sync outbox) and numeric-looking ids; both are fine to carry over.
      migrate: (old: any) => ({ designs: old?.designs ?? [], roomType: old?.roomType ?? 'Living room' }),
    },
  ),
);
