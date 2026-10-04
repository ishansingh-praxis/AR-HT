export type Placement = 'floor' | 'wall';
export type Role =
  | 'sofa' | 'bed' | 'chair' | 'coffee-table' | 'side-table' | 'dining-table' | 'desk'
  | 'tv-unit' | 'wardrobe' | 'storage' | 'rug' | 'lamp' | 'decor';
export type RoomType = 'living' | 'bedroom' | 'dining' | 'study' | 'other';

export interface Model3D {
  /** Remote .glb. Must be authored in metres with the origin at the centre of the floor footprint, front facing +z. */
  url: string;
  version: number;
  unit: 'm';
}

export interface Product {
  id: string; // Shopify handle for HomeTown products
  sku?: string;
  name: string;
  category: string;
  role: Role;
  subcategory: string;
  brand: string;
  description: string;
  material: string;
  priceInr?: number; // reference price only: this app has no checkout
  compareAtInr?: number;
  images: string[];
  /** Absent until a real GLB exists. AR then shows a to-scale box so layout and fit can still be judged. */
  model3D?: Model3D;
  modelStatus: 'ready' | 'proxy';
  /** Canonical orientation: w along x, d along z, front faces +z. Beds run head-to-foot along z. */
  dimensionsCm: { w: number; d: number; h: number };
  /** 'low' means a value needed unit guessing in the source data: verify before trusting. */
  dimsConfidence: 'high' | 'low';
  weightKg?: number;
  colors: { name: string; hex: string }[];
  styles: string[];
  roomTypes: RoomType[];
  /** Collection name (e.g. "nova"). Pieces of one family are designed to match. */
  family?: string;
  /** Sold as a set (e.g. 2 dining chairs). One AR piece = one item of the set. */
  setSize?: number;
  ar: { placements: Placement[] };
  source: 'hometown' | 'demo';
}

export interface RoomPiece { productId: string; x: number; z: number; rot: number; anchor: boolean }
export interface SampleRoom {
  id: string; title: string; roomType: RoomType; style: string[]; blurb: string; notes?: string;
  roomCm: { w: number; d: number };
  pieces: RoomPiece[];
}

export interface PlacedItem {
  uid: string;
  productId: string;
  position: [number, number, number];
  rotationY: number; // degrees
  scale: number;
}

export interface SavedDesign {
  id: string;
  name: string;
  createdAt: number;
  /** Offsets from the first item: world coordinates don't survive a new AR session. */
  items: { productId: string; offset: [number, number, number]; rotationY: number; scale: number }[];
}
