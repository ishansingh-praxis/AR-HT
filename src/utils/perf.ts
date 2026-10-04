// Pure performance rules for the AR scene (no React / RN / Viro imports).
import type { PlacedItem, Product } from '../types/furniture';

export const MAX_PIECES = 30;     // more than this and phones overheat; the user is told instead of the app slowing down
export const LOD_GLB_LIMIT = 15;  // beyond this many real GLB models the rest are drawn as simple shapes
export const LOW_FPS = 20;        // JS frame rate under which High quality drops to Standard

/** uids that should be drawn as the simplified shape instead of their real model (the first LOD_GLB_LIMIT real models keep theirs). */
export function proxyUids(items: PlacedItem[], find: (id: string) => Product | undefined): string[] {
  const out: string[] = [];
  let real = 0;
  for (const it of items) {
    const p = find(it.productId);
    if (!p?.model3D) continue;
    if (real < LOD_GLB_LIMIT) real++;
    else if (p.proxy) out.push(it.uid); // only when there is a shape to fall back to
  }
  return out;
}

export type Quality = 'standard' | 'high';
export interface DeviceInfo { os: 'android' | 'ios' | string; ramBytes?: number | null; apiLevel?: number | null; modelId?: string | null }

/**
 * First-run quality: High (shadows + depth occlusion) only on phones that can carry it.
 * Android: 6 GB RAM and Android 11+ (API 30). iPhone: model 13,x or newer (iPhone 12 and later). Anything unknown -> Standard.
 */
export function pickQuality(d: DeviceInfo): Quality {
  if (d.os === 'android') return (d.ramBytes ?? 0) >= 5.5 * 1024 ** 3 && (d.apiLevel ?? 0) >= 30 ? 'high' : 'standard';
  if (d.os === 'ios') {
    const m = /^iPhone(\d+),/.exec(d.modelId ?? '');
    return m && Number(m[1]) >= 13 ? 'high' : 'standard';
  }
  return 'standard';
}

/** Should High quality drop to Standard? Needs a few seconds of samples, several pieces placed, and a clearly low frame rate. */
export function shouldDropQuality(current: Quality, avgFps: number, pieces: number): boolean {
  return current === 'high' && pieces >= 10 && avgFps > 0 && avgFps < LOW_FPS;
}

/** File name for a cached model: id and version, so a new model version is a new file and old ones can be deleted. */
export const modelCacheName = (id: string, version: number) => `${id.replace(/[^a-z0-9-]/gi, '_')}-v${version}.glb`;
