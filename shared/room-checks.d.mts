export interface CheckPiece { productId: string; x: number; z: number; rot: number; anchor: boolean }
export interface CheckRoomInput { roomCm: { w: number; d: number }; pieces: CheckPiece[]; door?: { wall: 'top' | 'bottom' | 'left' | 'right'; at: number } }
export interface CheckProduct { name: string; dimensionsCm: { w: number; d: number; h: number }; sizeReview?: string; proxy?: unknown; model3D?: unknown }
export function corners(piece: { x: number; z: number; rot: number }, product: { dimensionsCm: { w: number; d: number } }): [number, number][];
export function checkRoom(room: CheckRoomInput, find: (id: string) => CheckProduct | undefined): { problems: string[]; pieceProblems: Record<number, string[]> };
