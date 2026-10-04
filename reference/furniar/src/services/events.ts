import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './api';

export type EventName = 'ar_opened' | 'room_scanned' | 'rec_shown' | 'rec_placed' | 'piece_placed' | 'piece_removed' | 'design_saved' | 'sample_room_placed' | 'photo_taken';

const KEY = 'events:queue';
const CAP = 300;
let queue: { name: EventName; ts: number; props: Record<string, string | number | boolean> }[] | null = null;

async function load() {
  if (queue) return queue;
  try { queue = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]'); } catch { queue = []; }
  return queue!;
}

/** Props must be ids and numbers only. Never put images, camera frames or room geometry in here. */
export async function track(name: EventName, props: Record<string, string | number | boolean> = {}) {
  const q = await load();
  q.push({ name, ts: Date.now(), props });
  if (q.length > CAP) q.splice(0, q.length - CAP);
  AsyncStorage.setItem(KEY, JSON.stringify(q)).catch(() => {});
}

/** Sends queued events when a server is configured. Failures keep the queue for next time. */
export async function flushEvents() {
  if (!API_URL) return;
  const q = await load();
  if (!q.length) return;
  let id = await AsyncStorage.getItem('events:device');
  if (!id) { id = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; await AsyncStorage.setItem('events:device', id); }
  const batch = q.slice(0, 50);
  try {
    const res = await fetch(`${API_URL}/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceId: id, events: batch }) });
    if (res.ok) { q.splice(0, batch.length); await AsyncStorage.setItem(KEY, JSON.stringify(q)); }
  } catch { /* offline: try again later */ }
}
