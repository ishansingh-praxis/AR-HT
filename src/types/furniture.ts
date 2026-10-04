export type Placement = 'floor' | 'wall';
export type Role =
  | 'sofa' | 'bed' | 'chair' | 'coffee-table' | 'side-table' | 'dining-table' | 'desk'
  | 'tv-unit' | 'wardrobe' | 'storage' | 'rug' | 'lamp' | 'decor' | 'wall-art';
export type RoomType = 'living' | 'bedroom' | 'dining' | 'study' | 'other';

export const ROLE_LABEL: Record<Role, string> = {
  sofa: 'Sofa', bed: 'Bed', chair: 'Chair', 'coffee-table': 'Coffee table', 'side-table': 'Side table', 'dining-table': 'Dining table',
  desk: 'Desk', 'tv-unit': 'TV unit', wardrobe: 'Wardrobe', storage: 'Storage', rug: 'Rug', lamp: 'Lamp', decor: 'Decor', 'wall-art': 'Wall art',
};
export const ROOM_LABEL: Record<RoomType, string> = { living: 'Living room', bedroom: 'Bedroom', dining: 'Dining room', study: 'Study', other: 'Other' };

export interface Model3D {
  /** Remote .glb, authored in metres, origin at the centre of the floor footprint, base on y=0. */
  url: string;
  version: number;
  unit: 'm';
}

/** A catalogue item. No price, stock or delivery data: this app is a room designer, not a shop. */
export interface Product {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  description?: string;
  images: string[];
  /** Absent until a reviewed 3D model exists. Such items are browsable but cannot be placed in AR yet. */
  model3D?: Model3D;
  /** Simplified true-scale stand-in shape (bundled), used until a photo-real model exists. Scaled to dimensionsCm in AR. */
  proxy?: { template: string; color: string };
  /** Set when the export's size looks wrong; such items are not placeable until a human checks them. */
  sizeReview?: string;
  brand?: string;
  /** True for the bundled test models, which are not HomeTown products. */
  demo?: boolean;
  /** HomeTown's own linked products (colour / configuration variants) and related products, as ids. */
  linked?: string[];
  related?: string[];
  /** Real-world size. The GLB bounding box must match this (`npm run validate:models`). */
  dimensionsCm: { w: number; d: number; h: number };
  role: Role;
  roomTypes: RoomType[];
  styles?: string[];
  /** 'low' means a value needed unit guessing in the source data: verify before trusting. */
  /** Placeholder for the first photo while it loads (scripts/add-blurhash.mjs). */
  blurhash?: string;
  dimsConfidence: 'high' | 'low';
  setSize?: number;
  weightKg?: number;
  sku?: string;
  priceInr?: number;
  compareAtInr?: number;
  /** Collection name (first word shared by 3+ products). Pieces of one collection are designed to match. */
  collection?: string;
  material?: string;
  colorFamily?: string;
  /** Products sharing a family are colour/size variants of each other. */
  family?: string;
  colors: { name: string; hex: string }[];
  /** Optional "view on retailer" link. */
  retailerUrl?: string;
  ar: { placements: Placement[] };
}
export type Furniture = Product;

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
  roomType?: string;
  createdAt: number;
  /** Last local edit; bumped on save/rename. */
  updatedAt?: number;
  /** Set once uploaded to the cloud. */
  cloudId?: number;
  /** The server's updatedAt when this phone last saw the design (the guard sent with edits). */
  serverUpdatedAt?: number;
  /** Local file or server key of the thumbnail picture. */
  thumbnailUri?: string;
  thumbnailKey?: string;
  thumbnailUrl?: string;
  /** Offsets are relative to two reference floor points (see utils/frame.ts) instead of the first piece. */
  frame?: boolean;
  /** ReactVision/ARCore cloud anchor the offsets are relative to (see ARScreen "Pin to room"). */
  cloudAnchorId?: string;
  /** Offsets from the first item: world coordinates don't survive a new AR session. */
  items: { productId: string; offset: [number, number, number]; rotationY: number; scale: number }[];
}
