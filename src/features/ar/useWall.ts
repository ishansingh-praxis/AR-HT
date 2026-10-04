import { useState } from 'react';
import { track } from '../../services/events';
import type { Wall } from '../../utils/wall';
import type { Vec3 } from '../../ar/types';

/** "Mark wall": two floor points where a wall meets the floor, so frames and clocks can hang on it. */
export function useWall() {
  const [points, setPoints] = useState<Vec3[]>([]);
  const [active, setActive] = useState(false);
  const [flip, setFlip] = useState(false);
  const wall: Wall | null = points.length >= 2 ? { a: points[0], b: points[1], flip } : null;

  const start = () => { setPoints([]); setActive(true); };
  const addPoint = (at: Vec3 | null) => {
    if (!at) return;
    const next = [...points, at];
    setPoints(next);
    if (next.length >= 2) { setActive(false); track('wall_marked'); }
  };
  const clear = () => { setPoints([]); setActive(false); };
  return { wall, points, active, start, addPoint, clear, flip: () => setFlip(!flip) };
}
