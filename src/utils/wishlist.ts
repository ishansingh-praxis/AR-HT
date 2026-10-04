// Pure wishlist list operations (no React / RN imports).
export interface WishItem { id: string; addedAt: number }

export const isSaved = (list: WishItem[], id: string) => list.some((w) => w.id === id);

/** Add when missing, remove when present. Newest first. */
export function toggleWish(list: WishItem[], id: string, now: number): WishItem[] {
  return isSaved(list, id) ? list.filter((w) => w.id !== id) : [{ id, addedAt: now }, ...list];
}

/** Older builds stored plain id strings: keep them, oldest at the bottom. */
export function migrateWishlist(old: unknown): WishItem[] {
  if (!Array.isArray(old)) return [];
  return old.flatMap((x, i) => (typeof x === 'string' ? [{ id: x, addedAt: i }] : x && typeof (x as WishItem).id === 'string' ? [x as WishItem] : [])).reverse();
}
