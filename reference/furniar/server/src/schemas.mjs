import { z } from 'zod';

const dim = z.number().positive().max(2000);
export const ROLES = ['sofa', 'bed', 'chair', 'coffee-table', 'side-table', 'dining-table', 'desk', 'tv-unit', 'wardrobe', 'storage', 'rug', 'lamp', 'decor'];
export const ROOM_TYPES = ['living', 'bedroom', 'dining', 'study', 'other'];
export const productInput = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,120}$/, 'lowercase letters, digits and dashes only'),
  sku: z.string().max(60).optional(),
  name: z.string().min(2).max(160),
  category: z.string().max(60).default('Furniture'),
  role: z.enum(ROLES),
  subcategory: z.string().max(80).default(''),
  brand: z.string().max(60).default(''),
  description: z.string().max(4000).default(''),
  material: z.string().max(160).default(''),
  priceInr: z.number().int().positive().optional(),
  images: z.array(z.url()).max(10).default([]),
  /** Canonical orientation: w along x, d along z, front faces +z. */
  dimensionsCm: z.object({ w: dim, d: dim, h: dim }),
  dimsConfidence: z.enum(['high', 'low']).default('high'),
  weightKg: z.number().nonnegative().optional(),
  colors: z.array(z.object({ name: z.string(), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).default([]),
  styles: z.array(z.string().max(30)).max(10).default([]),
  roomTypes: z.array(z.enum(ROOM_TYPES)).default([]),
  family: z.string().max(40).optional(),
  setSize: z.number().int().min(1).max(12).optional(),
  ar: z.object({ placements: z.array(z.enum(['floor', 'wall'])).min(1) }).default({ placements: ['floor'] }),
});

export const registerInput = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80).optional(),
});
export const loginInput = z.object({ email: z.email().transform((e) => e.toLowerCase()), password: z.string().max(128) });

export const designInput = z.object({
  name: z.string().min(1).max(80).optional(),
  items: z.array(z.object({
    productId: z.string(),
    offset: z.tuple([z.number(), z.number(), z.number()]),
    rotationY: z.number(),
    scale: z.number().min(0.1).max(5),
  })).min(1).max(200),
});

const prop = z.union([z.string().max(80), z.number(), z.boolean()]);
/** Anonymous usage events. Ids and numbers only: no images, no room geometry. */
export const eventsInput = z.object({
  deviceId: z.string().min(8).max(64),
  events: z.array(z.object({
    name: z.enum(['ar_opened', 'room_scanned', 'rec_shown', 'rec_placed', 'piece_placed', 'piece_removed', 'design_saved', 'sample_room_placed', 'photo_taken']),
    ts: z.number().int(),
    props: z.record(z.string().max(30), prop).default({}),
  })).min(1).max(50),
});
