import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { useSettings } from '../store/settingsStore';
import { createEvents, type EventName, type Props } from '../sync/events';

const events = createEvents({
  storage: { get: (k) => AsyncStorage.getItem(k), set: (k, v) => AsyncStorage.setItem(k, v) },
  enabled: () => useSettings.getState().shareUsage,
  send: API_URL
    ? async (payload) => {
        const res = await fetch(`${API_URL}/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        return res.ok;
      }
    : undefined,
});

/** Props must be ids and numbers only. Never put images, camera frames or room geometry in here. */
export const track = (name: EventName, props?: Props) => events.track(name, props).catch(() => {});
export const flushEvents = () => events.flush().catch(() => 0);
export const clearEvents = () => events.clear().catch(() => {});
export type { EventName };
