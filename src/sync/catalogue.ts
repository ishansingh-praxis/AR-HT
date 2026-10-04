// Pure logic (no React / RN imports).

export interface Page<T> { total: number; items: T[] }

/**
 * Fetch every page of a paged list. Returns null unless the complete set arrived, so callers never replace
 * a full bundled catalogue with a partial server copy.
 */
export async function fetchAllPages<T>(page: (offset: number) => Promise<Page<T>>, maxPages = 200): Promise<T[] | null> {
  const all: T[] = [];
  let total = Infinity;
  for (let i = 0; i < maxPages && all.length < total; i++) {
    const r = await page(all.length);
    total = r.total;
    if (!r.items.length) break;
    all.push(...r.items);
  }
  return all.length === total ? all : null;
}

export interface CatalogueDelta<T extends { id: string } = { id: string }> { version: number; products: T[]; removed: string[] }

/**
 * Applies a delta from GET /v1/catalogue?since=: changed products replace (or are appended to) the list, removed ids drop out.
 * Order of existing products is kept, new ones go at the end.
 */
export function applyDelta<T extends { id: string }>(current: T[], delta: { products: T[]; removed: string[] }): T[] {
  const changed = new Map(delta.products.map((p) => [p.id, p]));
  const removed = new Set(delta.removed);
  const kept = current.filter((p) => !removed.has(p.id)).map((p) => changed.get(p.id) ?? p);
  const have = new Set(kept.map((p) => p.id));
  return [...kept, ...delta.products.filter((p) => !have.has(p.id) && !removed.has(p.id))];
}
