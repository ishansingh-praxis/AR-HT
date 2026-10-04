// Pure helpers for the user's room size (no React / RN imports).
export type SizePreset = 'small' | 'medium' | 'large' | 'unknown';
export const PRESET_AREA: Record<SizePreset, number | undefined> = { small: 9, medium: 16, large: 28, unknown: undefined };

/** Usable floor area in m²: a camera scan wins over the size the user picked. */
export const areaOf = (s: { scanned?: { areaM2: number } | null; preset: SizePreset }) => s.scanned?.areaM2 ?? PRESET_AREA[s.preset];
