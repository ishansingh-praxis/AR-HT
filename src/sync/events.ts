// Pure analytics queue (no React / RN imports). Props must be ids and numbers only: never images, camera frames or room geometry.

export type EventName =
  | 'app_opened' | 'onboarding_done' | 'ar_opened' | 'room_scanned' | 'rec_shown' | 'rec_placed' | 'piece_placed' | 'piece_removed'
  | 'undo' | 'wall_marked' | 'wall_piece_hung' | 'design_saved' | 'design_reopened' | 'sample_room_placed' | 'ai_layout_used'
  | 'photo_taken' | 'video_recorded' | 'wishlist_added' | 'item_viewed' | 'retailer_link_opened';

export type Props = Record<string, string | number | boolean>;
export interface QueuedEvent { name: EventName; ts: number; props: Props }

export interface KeyValue { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> }

export const QUEUE_CAP = 300;
export const BATCH_SIZE = 50;
const QUEUE_KEY = 'events:queue';
const DEVICE_KEY = 'events:device';

export interface EventsDeps {
  storage: KeyValue;
  /** POST a batch; resolves true when the server accepted it. Absent = no server configured (events stay queued). */
  send?: (payload: { deviceId: string; events: QueuedEvent[] }) => Promise<boolean>;
  enabled: () => boolean;
  now?: () => number;
  random?: () => string;
}

export function createEvents(deps: EventsDeps) {
  const now = deps.now ?? Date.now;
  let queue: QueuedEvent[] | null = null;

  const load = async () => {
    if (queue) return queue;
    try { queue = JSON.parse((await deps.storage.get(QUEUE_KEY)) ?? '[]'); } catch { queue = []; }
    return queue!;
  };
  const save = async (q: QueuedEvent[]) => { try { await deps.storage.set(QUEUE_KEY, JSON.stringify(q)); } catch { /* ignore */ } };

  return {
    /** Add an event. Does nothing when the user opted out. Oldest events are dropped beyond the cap. */
    async track(name: EventName, props: Props = {}) {
      if (!deps.enabled()) return;
      const q = await load();
      q.push({ name, ts: now(), props });
      if (q.length > QUEUE_CAP) q.splice(0, q.length - QUEUE_CAP);
      await save(q);
    },
    /** Send queued events in batches of 50. A failed batch keeps everything for next time. Returns how many were sent. */
    async flush(): Promise<number> {
      if (!deps.send || !deps.enabled()) return 0;
      const q = await load();
      if (!q.length) return 0;
      let deviceId = await deps.storage.get(DEVICE_KEY);
      if (!deviceId) { deviceId = deps.random?.() ?? `d${now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; await deps.storage.set(DEVICE_KEY, deviceId); }
      let sent = 0;
      while (q.length) {
        const batch = q.slice(0, BATCH_SIZE);
        let ok = false;
        try { ok = await deps.send({ deviceId, events: batch }); } catch { ok = false; }
        if (!ok) break;
        q.splice(0, batch.length);
        sent += batch.length;
        await save(q);
      }
      return sent;
    },
    /** Opt-out: forget everything queued. */
    async clear() { queue = []; await save([]); },
    async size() { return (await load()).length; },
  };
}
