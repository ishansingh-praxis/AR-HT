import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { queueDelete, queueUpsert, queueWish, type Op } from '../sync/engine';
import { useAuth } from './authStore';

interface SyncState {
  /** Changes made on this phone that the server has not seen yet. Persisted, so nothing is lost if the app closes. */
  outbox: Op[];
  /** Server time of the last successful pull. */
  since: number;
  lastSyncedAt: number | null;
  syncing: boolean;
  error: string | null;
  setOutbox: (o: Op[]) => void;
  setSince: (n: number) => void;
  setStatus: (p: Partial<Pick<SyncState, 'syncing' | 'error' | 'lastSyncedAt'>>) => void;
  upsertDesign: (id: string) => void;
  deleteDesign: (id: string, cloudId?: number) => void;
  wish: (productId: string, add: boolean) => void;
  /** Sign-in / sign-out: forget the server state. */
  reset: () => void;
}

// Only signed-in users have anything to sync: a guest's changes stay local, and sign-in queues everything (services/sync.ts).
const signedIn = () => !!useAuth.getState().token;

export const useSync = create<SyncState>()(
  persist(
    (set, get) => ({
      outbox: [], since: 0, lastSyncedAt: null, syncing: false, error: null,
      setOutbox: (outbox) => set({ outbox }),
      setSince: (since) => set({ since }),
      setStatus: (p) => set(p),
      upsertDesign: (id) => { if (signedIn()) set({ outbox: queueUpsert(get().outbox, id) }); },
      deleteDesign: (id, cloudId) => { if (signedIn()) set({ outbox: queueDelete(get().outbox, id, cloudId) }); },
      wish: (productId, add) => { if (signedIn()) set({ outbox: queueWish(get().outbox, productId, add) }); },
      reset: () => set({ outbox: [], since: 0, lastSyncedAt: null, error: null, syncing: false }),
    }),
    { name: 'sync', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ outbox: s.outbox, since: s.since, lastSyncedAt: s.lastSyncedAt }) },
  ),
);
