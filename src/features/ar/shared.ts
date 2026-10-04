import type { Vec3 } from '../../ar/types';

export type { Vec3 };
export const SNAP_M = 0.05;
export const snap = (v: number) => Math.round(v / SNAP_M) * SNAP_M;
export const isWallOnly = (p?: { ar?: { placements: string[] } }) => !!p?.ar?.placements.includes('wall') && !p.ar.placements.includes('floor');
