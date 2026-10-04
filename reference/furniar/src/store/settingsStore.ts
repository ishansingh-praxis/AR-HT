import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RoomType } from '../types/furniture';

export type SizePreset = 'small' | 'medium' | 'large' | 'unknown';
export const PRESET_AREA: Record<SizePreset, number | undefined> = { small: 9, medium: 16, large: 28, unknown: undefined };

export interface ScannedRoom { widthCm: number; depthCm: number; areaM2: number; rectangularity: number; at: number }

interface SettingsState {
  onboarded: boolean;
  roomType: RoomType;
  preset: SizePreset;
  scanned: ScannedRoom | null;
  finish: (roomType: RoomType, preset: SizePreset) => void;
  setScanned: (r: ScannedRoom | null) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      onboarded: false, roomType: 'living', preset: 'unknown', scanned: null,
      finish: (roomType, preset) => set({ onboarded: true, roomType, preset }),
      setScanned: (scanned) => set({ scanned }),
    }),
    { name: 'settings', storage: createJSONStorage(() => AsyncStorage) }
  )
);

/** Usable floor area: a scan wins over the size the user picked. */
export const areaOf = (s: Pick<SettingsState, 'scanned' | 'preset'>) => s.scanned?.areaM2 ?? PRESET_AREA[s.preset];
