export interface PlanPiece { x: number; z: number; rot: number; w: number; d: number; fill?: string; label?: string }
export interface Plan { roomCm: { w: number; d: number }; pieces: PlanPiece[] }
export const PLAN_COLORS: { ink: string; muted: string; accent: string; floor: string; fallback: string };
/** `flagged` = piece indexes drawn with a red outline (used by the admin room editor for pieces that fail a check). */
export function planSvg(plan: Plan & { width?: number; highlight?: number; flagged?: number[]; title?: string }): string;
export function designPlan(
  items: { productId: string; offset: [number, number, number]; rotationY: number; scale: number }[],
  find: (id: string) => { dimensionsCm: { w: number; d: number }; role?: string; colors?: { hex: string }[] } | undefined,
  scanCm?: { w: number; d: number },
): Plan;
