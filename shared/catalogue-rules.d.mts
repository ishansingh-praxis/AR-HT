export function parseMm(raw: unknown): { mm: number; ambiguous: boolean } | null;
export function categoryFor(segment: string | undefined, title: string): string | null;
export function floorSize(category: string, v: { length?: string; width?: string; depth?: string; height?: string }): { w: number; d: number; h: number; confidence: 'high' | 'low' } | null;
export const plausible: (w: number, d: number, h: number) => boolean;
export function sizeFlag(category: string, title: string, w: number, d: number, h: number): string | null | undefined;
export function roleFor(...hays: (string | undefined)[]): string | null;
export const ROLES: string[];
