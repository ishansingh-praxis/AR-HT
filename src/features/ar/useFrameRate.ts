import { useEffect, useRef } from 'react';

const WINDOW_MS = 5000;

/**
 * Measures the app's frame rate (requestAnimationFrame) over 5 second windows while `enabled`, and calls `onLow` once when a window
 * averages under `limit`. This is the JS/UI frame rate, which drops when the phone is overloaded; it is a signal to lower quality,
 * not an exact AR render fps (Viro does not report one), so real fps still has to be checked on a device.
 */
export function useFrameRate(enabled: boolean, limit: number, onLow: (avgFps: number) => void) {
  const cb = useRef(onLow);
  useEffect(() => { cb.current = onLow; });
  useEffect(() => {
    if (!enabled) return;
    let raf = 0, start = 0, frames = 0, fired = false;
    const tick = (t: number) => {
      if (!start) start = t;
      frames++;
      if (t - start >= WINDOW_MS) {
        const fps = (frames * 1000) / (t - start);
        if (!fired && fps < limit) { fired = true; cb.current(fps); return; }
        start = t; frames = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, limit]);
}
