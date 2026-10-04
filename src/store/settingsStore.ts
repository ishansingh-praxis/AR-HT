import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SizePreset } from '../utils/area';

export interface ScannedRoom { widthCm: number; depthCm: number; areaM2: number; rectangularity: number; at: number }

/** standard: no shadows/occlusion (safest on older phones). high: shadows + depth occlusion where supported. */
interface SettingsState {
  quality: 'standard' | 'high';
  /** false until the first launch picked a quality from the phone's class, or the user chose one. */
  qualityChosen: boolean;
  /** True while the current quality is the automatic pick (shown in Settings). */
  qualityAuto: boolean;
  setQualityAuto: (v: boolean) => void;
  setQuality: (q: 'standard' | 'high', byUser?: boolean) => void;
  /** Last room the user scanned with corner marking (null until they scan one). */
  scanned: ScannedRoom | null;
  setScanned: (r: ScannedRoom | null) => void;
  /** null until checked at startup. false = no ARCore/ARKit: the app offers the plan editor instead of AR. */
  arSupported: boolean | null;
  setArSupported: (v: boolean) => void;
  /** Onboarding done (room type is kept in the rooms store). */
  onboarded: boolean;
  preset: SizePreset;
  finish: (preset: SizePreset) => void;
  /** "Share anonymous usage": ids and numbers only. Off = nothing is tracked or sent. */
  shareUsage: boolean;
  setShareUsage: (on: boolean) => void;
  /** Upload the picture of a saved design (a screenshot of the AR view, which includes the room) when syncing. Off by default: a photo is also uploaded when the user shares that design. */
  /** The "how to" gesture demo is shown once per screen, then from the ? button. */
  hintsSeen: { ar?: boolean; plan?: boolean };
  markHint: (k: 'ar' | 'plan') => void;
  backupPhotos: boolean;
  setBackupPhotos: (on: boolean) => void;
}
export const useSettings = create<SettingsState>()(
  persist((set) => ({
    quality: 'standard', qualityChosen: false, setQuality: (quality, byUser = true) => set({ quality, qualityChosen: true, ...(byUser ? { qualityAuto: false } : {}) }),
    qualityAuto: false, setQualityAuto: (qualityAuto) => set({ qualityAuto }),
    arSupported: null, setArSupported: (arSupported) => set({ arSupported }),
    scanned: null, setScanned: (scanned) => set({ scanned }),
    onboarded: false, preset: 'unknown', finish: (preset) => set({ onboarded: true, preset }),
    shareUsage: true, setShareUsage: (shareUsage) => set({ shareUsage }),
    hintsSeen: {}, markHint: (k) => set((s) => ({ hintsSeen: { ...s.hintsSeen, [k]: true } })),
    backupPhotos: false, setBackupPhotos: (backupPhotos) => set({ backupPhotos }),
  }), {
    name: 'settings',
    storage: createJSONStorage(() => AsyncStorage),
    partialize: ({ arSupported: _a, setArSupported: _s, ...rest }) => rest as never, // AR support is checked again at every start
  })
);
