import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedDesign } from '../types/furniture';

interface RoomState {
  designs: SavedDesign[];
  save: (d: Pick<SavedDesign, 'items'>) => void;
  remove: (id: string) => void;
}

export const useRooms = create<RoomState>()(
  persist(
    (set, get) => ({
      designs: [],
      save: (d) =>
        set({
          designs: [
            { ...d, id: String(Date.now()), createdAt: Date.now(), name: `Design ${get().designs.length + 1}` },
            ...get().designs,
          ],
        }),
      remove: (id) => set((s) => ({ designs: s.designs.filter((d) => d.id !== id) })),
    }),
    { name: 'designs', storage: createJSONStorage(() => AsyncStorage) }
  )
);
