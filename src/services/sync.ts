import { AppState } from 'react-native';
import { API_URL } from '../config';
import { syncApi } from './api';
import { uploadThumbnail } from './thumbnails';
import { useAuth, authStatus } from '../store/authStore';
import { useRooms } from '../store/roomStore';
import { useSync } from '../store/syncStore';
import { useWishlist } from '../store/wishlistStore';
import { sync, type EngineIO, type SyncResult } from '../sync/engine';
import { newId } from '../utils/id';

const DEBOUNCE_MS = 3000;
let running: Promise<SyncResult | null> | null = null;

const io = (): EngineIO => ({
  designs: () => useRooms.getState().designs as never,
  setDesigns: (d) => useRooms.getState().replaceAll(d as never),
  outbox: () => useSync.getState().outbox,
  setOutbox: (o) => useSync.getState().setOutbox(o),
  wishlist: () => useWishlist.getState().items,
  setWishlist: (w) => useWishlist.getState().replaceAll(w),
  since: () => useSync.getState().since,
  setSince: (n) => useSync.getState().setSince(n),
  newId, now: Date.now, api: syncApi, uploadThumbnail,
});

/** Can this phone sync right now? Needs a server, a signed-in and email-verified account. */
export const canSync = () => !!API_URL && authStatus(useAuth.getState()) === 'signedIn';

/** Push local changes, pull the server's, merge. Safe to call often: one run at a time. */
export function runSync(): Promise<SyncResult | null> {
  if (!canSync()) return Promise.resolve(null);
  running ??= (async () => {
    useSync.getState().setStatus({ syncing: true });
    try {
      const r = await sync(io());
      useSync.getState().setStatus({ syncing: false, error: r.error ?? null, ...(r.error ? {} : { lastSyncedAt: Date.now() }) });
      return r;
    } finally { running = null; }
  })();
  return running;
}

/** After sign-in: everything already on this phone is queued for upload. The server ignores repeats (same clientId). */
export function queueEverything() {
  const s = useSync.getState();
  for (const d of useRooms.getState().designs) s.upsertDesign(d.id);
  for (const w of useWishlist.getState().items) s.wish(w.id, true);
}

/** Sync on app foreground, 3 s after any change, and whenever the signed-in account changes. Returns a cleanup function. */
export function startSyncTriggers(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const later = () => { clearTimeout(timer); timer = setTimeout(() => { runSync(); }, DEBOUNCE_MS); };
  const unsubOutbox = useSync.subscribe((s, prev) => { if (s.outbox !== prev.outbox && s.outbox.length > 0) later(); });
  const unsubAuth = useAuth.subscribe((s, prev) => { if (s.token && s.token !== prev.token && !prev.token) runSync(); if (s.user?.emailVerified && !prev.user?.emailVerified) runSync(); });
  const app = AppState.addEventListener('change', (st) => { if (st === 'active') runSync(); });
  runSync();
  return () => { clearTimeout(timer); unsubOutbox(); unsubAuth(); app.remove(); };
}
