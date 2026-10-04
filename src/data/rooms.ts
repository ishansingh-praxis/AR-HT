import rooms from './rooms.json';
import { rotateLayout } from '../utils/geometry';
import type { PlacedItem, Product, RoomType, SampleRoom, SavedDesign } from '../types/furniture';

export type CuratedRoom = SampleRoom & { door?: { wall: 'top' | 'bottom' | 'left' | 'right'; at: number } };

export const ROOMS = rooms as unknown as CuratedRoom[];
export const getRoom = (id: string) => ROOMS.find((r) => r.id === id);
export const ROOM_ID_PREFIX = 'room-';

/** Room type used in the app's UI ("Living room", "Office"...) -> curated room type. */
export const toRoomType = (label: string): RoomType =>
  /bed/i.test(label) ? 'bedroom' : /din/i.test(label) ? 'dining' : /office|study/i.test(label) ? 'study' : /living/i.test(label) ? 'living' : 'other';

export const roomAreaM2 = (r: SampleRoom) => (r.roomCm.w * r.roomCm.d) / 1e4;

/** The anchor piece's offsets: a curated room as a layout that can be placed around the dot the user aims at. */
export function roomToDesign(room: SampleRoom): SavedDesign {
  const a = room.pieces.find((p) => p.anchor) ?? room.pieces[0];
  return {
    id: ROOM_ID_PREFIX + room.id,
    name: room.title,
    roomType: room.roomType,
    createdAt: 0,
    items: room.pieces.map((p) => ({
      productId: p.productId,
      offset: [(p.x - a.x) / 100, 0, (p.z - a.z) / 100] as [number, number, number],
      rotationY: p.rot,
      scale: 1,
    })),
  };
}

/** Turn a layout (offsets from its first piece) by 90° steps, e.g. to line it up with a different wall. */
export function turnOffsets(items: SavedDesign['items'], deg: number): SavedDesign['items'] {
  const placed: PlacedItem[] = items.map((d, i) => ({ uid: String(i), productId: d.productId, position: d.offset, rotationY: d.rotationY, scale: d.scale }));
  return rotateLayout(placed, [0, 0], deg).map((p, i) => ({ ...items[i], offset: p.position, rotationY: p.rotationY }));
}

export interface PieceCount { product: Product; pieces: number; sets?: number }

/** Products of a room with counts. One AR piece is one item of a set: 6 chairs sold in 2s = 3 sets. */
export function roomProducts(room: SampleRoom, find: (id: string) => Product | undefined): PieceCount[] {
  const count = new Map<string, number>();
  for (const p of room.pieces) count.set(p.productId, (count.get(p.productId) ?? 0) + 1);
  return [...count].flatMap(([id, pieces]) => {
    const product = find(id);
    return product ? [{ product, pieces, sets: product.setSize ? Math.ceil(pieces / product.setSize) : undefined }] : [];
  });
}

/** True when the layout fits inside the scanned room (any quarter-turn is allowed by the caller choosing `k`). */
export const fitsScanned = (room: SampleRoom, scan: { widthCm: number; depthCm: number } | null | undefined) =>
  !!scan && ((room.roomCm.w <= scan.widthCm && room.roomCm.d <= scan.depthCm) || (room.roomCm.d <= scan.widthCm && room.roomCm.w <= scan.depthCm));
