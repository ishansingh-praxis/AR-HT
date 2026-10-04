// Offline-safe sync engine (no React / RN imports). The app wires it to real stores and the API in services/sync.ts.
//
// Local changes are recorded in an OUTBOX of operations. sync() = push the outbox in order, then pull what changed on the
// server and merge. Rules:
//  - a design edited on this phone and not yet pushed is never overwritten by a pull;
//  - a change someone else made first (HTTP 409) keeps BOTH: the server copy wins the original, the phone's edit becomes
//    "<name> (this phone)";
//  - a design deleted elsewhere is removed here, unless this phone has unsynced edits to it (then it is re-created);
//  - otherwise the newer `updatedAt` wins.
import { ApiError } from './http.ts';
import type { WishItem } from '../utils/wishlist.ts';

export interface LocalDesign {
  id: string;                 // generated on the phone, also sent as the server's clientId
  cloudId?: number;
  name: string;
  roomType?: string;
  frame?: boolean;
  cloudAnchorId?: string;
  createdAt: number;
  updatedAt?: number;
  /** The server's updatedAt when this phone last saw it: the guard sent with edits. */
  serverUpdatedAt?: number;
  thumbnailKey?: string;
  /** Local picture file (not synced as a file; uploaded once and referenced by thumbnailKey). */
  thumbnailUri?: string;
  thumbnailUrl?: string;
  items: unknown[];
}

export interface RemoteDesign {
  id: number; clientId?: string; name: string; roomType?: string; frame?: boolean; cloudAnchorId?: string;
  createdAt: number; updatedAt: number; thumbnailKey?: string; thumbnailUrl?: string; items: unknown[];
}

export type Op =
  | { type: 'design.upsert'; id: string }
  | { type: 'design.delete'; id: string; cloudId?: number }
  | { type: 'wish.add'; productId: string }
  | { type: 'wish.remove'; productId: string };

// ---- outbox helpers (pure; used by the stores when the user changes something) ----
export const queueUpsert = (box: Op[], id: string): Op[] =>
  box.some((o) => o.type === 'design.upsert' && o.id === id) ? box : [...box, { type: 'design.upsert', id }];
/** Deleting cancels pending edits. A design that never reached the server needs no delete at all. */
export const queueDelete = (box: Op[], id: string, cloudId?: number): Op[] => {
  const rest = box.filter((o) => !('id' in o && o.id === id));
  return cloudId ? [...rest, { type: 'design.delete', id, cloudId }] : rest;
};
export const queueWish = (box: Op[], productId: string, add: boolean): Op[] => {
  const rest = box.filter((o) => !((o.type === 'wish.add' || o.type === 'wish.remove') && o.productId === productId));
  return [...rest, add ? { type: 'wish.add', productId } : { type: 'wish.remove', productId }];
};

export interface DesignBody { clientId: string; name: string; roomType?: string; frame?: boolean; cloudAnchorId?: string; thumbnailKey?: string; items: unknown[] }

export interface EngineIO {
  designs(): LocalDesign[];
  setDesigns(d: LocalDesign[]): void;
  outbox(): Op[];
  setOutbox(o: Op[]): void;
  wishlist(): WishItem[];
  setWishlist(w: WishItem[]): void;
  since(): number;
  setSince(n: number): void;
  newId(): string;
  now(): number;
  api: {
    createDesign(d: DesignBody): Promise<RemoteDesign>;
    patchDesign(cloudId: number, d: Omit<DesignBody, 'clientId'> & { updatedAt?: number }): Promise<RemoteDesign>;
    deleteDesign(cloudId: number): Promise<void>;
    listDesigns(since: number): Promise<{ designs: RemoteDesign[]; deleted: number[]; serverTime: number }>;
    wishAdd(productId: string): Promise<void>;
    wishRemove(productId: string): Promise<void>;
    listWishlist(): Promise<WishItem[]>;
  };
  /** Optional: uploads the design's local thumbnail and returns its storage key. Failures are not fatal (the design syncs without a picture). */
  uploadThumbnail?(d: LocalDesign): Promise<string | undefined>;
}

export interface SyncResult { pushed: number; pulled: number; conflicts: number; error?: string }

const body = (d: LocalDesign): Omit<DesignBody, 'clientId'> => ({ name: d.name, roomType: d.roomType, frame: d.frame, cloudAnchorId: d.cloudAnchorId, thumbnailKey: d.thumbnailKey, items: d.items });
const fromRemote = (r: RemoteDesign, id: string, prev?: LocalDesign): LocalDesign => ({
  id, cloudId: r.id, name: r.name, roomType: r.roomType, frame: r.frame, cloudAnchorId: r.cloudAnchorId, createdAt: r.createdAt,
  updatedAt: r.updatedAt, serverUpdatedAt: r.updatedAt, thumbnailKey: r.thumbnailKey, thumbnailUrl: r.thumbnailUrl, thumbnailUri: prev?.thumbnailUri, items: r.items,
});

export async function sync(io: EngineIO): Promise<SyncResult> {
  const res: SyncResult = { pushed: 0, pulled: 0, conflicts: 0 };
  const patch = (id: string, f: (d: LocalDesign) => LocalDesign) => io.setDesigns(io.designs().map((d) => (d.id === id ? f(d) : d)));
  const find = (id: string) => io.designs().find((d) => d.id === id);
  const shift = () => io.setOutbox(io.outbox().slice(1));

  // ---- 1. push, in order ----
  try {
    while (io.outbox().length) {
      const op = io.outbox()[0];
      try {
        if (op.type === 'design.upsert') {
          let d = find(op.id);
          if (d && io.uploadThumbnail && d.thumbnailUri && !d.thumbnailKey) {
            try {
              const key = await io.uploadThumbnail(d);
              if (key) { patch(d.id, (x) => ({ ...x, thumbnailKey: key })); d = find(op.id)!; }
            } catch { /* a missing picture must not block the design */ }
          }
          if (d) {
            if (!d.cloudId) {
              const r = await io.api.createDesign({ clientId: d.id, ...body(d) });
              patch(d.id, (x) => ({ ...x, cloudId: r.id, serverUpdatedAt: r.updatedAt, thumbnailUrl: r.thumbnailUrl ?? x.thumbnailUrl }));
            } else {
              try {
                const r = await io.api.patchDesign(d.cloudId, { ...body(d), updatedAt: d.serverUpdatedAt });
                patch(d.id, (x) => ({ ...x, serverUpdatedAt: r.updatedAt, thumbnailUrl: r.thumbnailUrl ?? x.thumbnailUrl }));
              } catch (e) {
                if (!(e instanceof ApiError)) throw e;
                if (e.status === 409 && e.body?.current) {
                  // Edited somewhere else first: server copy takes the original, this phone's edit lives on as a separate design.
                  const copy: LocalDesign = { ...d, id: io.newId(), cloudId: undefined, serverUpdatedAt: undefined, name: `${d.name} (this phone)`, updatedAt: io.now() };
                  io.setDesigns(io.designs().map((x) => (x.id === d.id ? fromRemote(e.body.current, d.id, x) : x)).concat(copy));
                  io.setOutbox([...io.outbox().slice(1), { type: 'design.upsert', id: copy.id }]);
                  res.conflicts++; res.pushed++;
                  continue;
                }
                if (e.status === 404) { // deleted elsewhere while we had edits: re-create it
                  patch(d.id, (x) => ({ ...x, cloudId: undefined, serverUpdatedAt: undefined }));
                  continue; // same op again, now as a create
                }
                throw e;
              }
            }
            res.pushed++;
          }
        } else if (op.type === 'design.delete') {
          try { await io.api.deleteDesign(op.cloudId!); } catch (e) { if (!(e instanceof ApiError) || e.status !== 404) throw e; }
          res.pushed++;
        } else if (op.type === 'wish.add') { await io.api.wishAdd(op.productId); res.pushed++; }
        else { await io.api.wishRemove(op.productId); res.pushed++; }
      } catch (e) {
        // A rejected (4xx) op would block the queue forever: drop it and carry on. Network/server errors stop the sync, nothing is lost.
        if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 429) { res.error = e.message; shift(); continue; }
        throw e;
      }
      shift();
    }

    // ---- 2. pull designs ----
    const pending = () => new Set(io.outbox().flatMap((o) => (o.type === 'design.upsert' ? [o.id] : [])));
    const list = await io.api.listDesigns(io.since());
    let local = io.designs();
    for (const r of list.designs) {
      const mine = local.find((d) => d.cloudId === r.id) ?? (r.clientId ? local.find((d) => d.id === r.clientId) : undefined);
      if (!mine) { local = [...local, fromRemote(r, r.clientId ?? `cloud-${r.id}`)]; res.pulled++; continue; }
      if (pending().has(mine.id)) continue; // unsynced local edits are never overwritten
      if (!mine.cloudId || r.updatedAt > (mine.serverUpdatedAt ?? 0)) {
        local = local.map((d) => (d.id === mine.id ? fromRemote(r, mine.id, d) : d));
        if (r.updatedAt > (mine.serverUpdatedAt ?? 0)) res.pulled++;
      }
    }
    for (const cloudId of list.deleted) {
      const mine = local.find((d) => d.cloudId === cloudId);
      if (!mine) continue;
      if (pending().has(mine.id)) { // deleted elsewhere but edited here: keep it, as a new design
        local = local.map((d) => (d.id === mine.id ? { ...d, cloudId: undefined, serverUpdatedAt: undefined } : d));
      } else { local = local.filter((d) => d.id !== mine.id); res.pulled++; }
    }
    io.setDesigns(local);

    // ---- 3. pull wishlist (what was added/removed on this phone since the push still wins) ----
    const remote = await io.api.listWishlist();
    const byId = new Map(remote.map((w) => [w.id, w]));
    for (const o of io.outbox()) {
      if (o.type === 'wish.add' && !byId.has(o.productId)) byId.set(o.productId, io.wishlist().find((w) => w.id === o.productId) ?? { id: o.productId, addedAt: io.now() });
      if (o.type === 'wish.remove') byId.delete(o.productId);
    }
    io.setWishlist([...byId.values()].sort((a, b) => b.addedAt - a.addedAt));

    io.setSince(list.serverTime);
  } catch (e) {
    res.error = e instanceof ApiError ? e.message : String((e as Error)?.message ?? e);
  }
  return res;
}
