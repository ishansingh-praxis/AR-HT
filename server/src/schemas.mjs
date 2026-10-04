import { z } from 'zod';

const dim = z.number().positive().max(2000);
export const ROLES = ['sofa', 'bed', 'chair', 'coffee-table', 'side-table', 'dining-table', 'desk', 'tv-unit', 'wardrobe', 'storage', 'rug', 'lamp', 'decor', 'wall-art'];
export const ROOM_TYPES = ['living', 'bedroom', 'dining', 'study', 'other'];

export const productInput = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,120}$/, 'lowercase letters, digits and dashes only'),
  sku: z.string().max(60).optional(),
  name: z.string().min(2).max(160),
  category: z.string().min(2).max(40),
  role: z.enum(ROLES).default('decor'),
  subcategory: z.string().max(80).optional(),
  brand: z.string().max(60).optional(),
  description: z.string().max(4000).optional(),
  images: z.array(z.url()).max(10).default([]),
  /** Canonical orientation: w along x, d along z, front faces +z. */
  dimensionsCm: z.object({ w: dim, d: dim, h: dim }),
  dimsConfidence: z.enum(['high', 'low']).optional(),
  material: z.string().max(160).optional(),
  colorFamily: z.string().max(40).optional(),
  colors: z.array(z.object({ name: z.string(), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).optional(),
  styles: z.array(z.string().max(30)).max(10).optional(),
  roomTypes: z.array(z.enum(ROOM_TYPES)).optional(),
  priceInr: z.number().int().positive().optional(),
  weightKg: z.number().nonnegative().optional(),
  setSize: z.number().int().min(1).max(12).optional(),
  /** Products sharing a family are colour/size variants of each other. */
  family: z.string().max(100).optional(),
  collection: z.string().max(60).optional(),
  retailerUrl: z.url().optional(),
  ar: z.object({ placements: z.array(z.enum(['floor', 'wall'])).min(1) }).default({ placements: ['floor'] }),
});

export const registerInput = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80).optional(),
});
export const loginInput = z.object({ email: z.email().transform((e) => e.toLowerCase()), password: z.string().max(128) });

const designItems = z.array(z.object({
  productId: z.string(),
  offset: z.tuple([z.number(), z.number(), z.number()]),
  rotationY: z.number(),
  scale: z.number().min(0.1).max(5),
})).min(1).max(200);

const designFields = {
  roomType: z.string().max(40).optional(),
  frame: z.boolean().optional(),
  cloudAnchorId: z.string().max(200).optional(),
  scan: z.object({ widthCm: z.number().positive().max(5000), depthCm: z.number().positive().max(5000), areaM2: z.number().positive().max(500) }).optional(),
  thumbnailKey: z.string().max(200).optional(),
};
/** Generated on the phone. Creating twice with the same clientId returns the first design instead of a duplicate. */
const clientId = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/).optional();
export const designInput = z.object({ name: z.string().min(1).max(80).optional(), clientId, items: designItems, ...designFields });
/** Rename and/or replace the contents. `updatedAt` is the version the client last saw: a stale one gets 409. */
export const designPatch = z.object({ name: z.string().min(1).max(80).optional(), items: designItems.optional(), updatedAt: z.number().int().optional(), ...designFields })
  .refine((d) => d.name !== undefined || d.items !== undefined, 'Send a name or items');

export const layoutRequest = z.object({
  roomType: z.string().min(2).max(40),
  anchorId: z.string().min(1).max(120),
  room: z.object({ area: z.number().positive().max(500), maxSpan: z.number().positive().max(50) }).optional(),
});

export const EVENT_NAMES = [
  'app_opened', 'onboarding_done', 'ar_opened', 'room_scanned', 'rec_shown', 'rec_placed', 'piece_placed', 'piece_removed',
  'undo', 'wall_marked', 'wall_piece_hung', 'design_saved', 'design_reopened', 'sample_room_placed', 'ai_layout_used',
  'photo_taken', 'video_recorded', 'wishlist_added', 'item_viewed', 'retailer_link_opened',
];
const prop = z.union([z.string().max(80), z.number(), z.boolean()]);
/** Anonymous usage events. Ids and numbers only: no images, no room geometry. */
export const eventsInput = z.object({
  deviceId: z.string().min(8).max(64),
  events: z.array(z.object({
    name: z.enum(EVENT_NAMES),
    ts: z.number().int(),
    props: z.record(z.string().max(30), prop).default({}),
  })).min(1).max(50),
});
