import { useCallback, useState } from 'react';
import { track } from '../../services/events';
import type { PlacedItem } from '../../types/furniture';

const MAX_UNDO = 30;

/** Placed pieces plus undo/redo. Structural changes use `commit`; drag/pinch use `update` (no history entry). */
export function useLayoutHistory(initial: PlacedItem[] = []) {
  const [items, setItems] = useState<PlacedItem[]>(initial);
  const [past, setPast] = useState<PlacedItem[][]>([]);
  const [future, setFuture] = useState<PlacedItem[][]>([]);

  const commit = (next: PlacedItem[]) => { setPast((p) => [...p.slice(-MAX_UNDO), items]); setFuture([]); setItems(next); };
  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return false;
    track('undo'); setFuture((f) => [items, ...f]); setPast((p) => p.slice(0, -1)); setItems(prev);
    return true;
  };
  const redo = () => {
    const nxt = future[0];
    if (!nxt) return false;
    setPast((p) => [...p, items]); setFuture((f) => f.slice(1)); setItems(nxt);
    return true;
  };
  const update = useCallback((uid: string, patch: Partial<PlacedItem>) =>
    setItems((cur) => cur.map((i) => (i.uid === uid ? { ...i, ...patch } : i))), []);

  /** Replace everything without a history entry (used when a different design is loaded). */
  const reset = (next: PlacedItem[]) => { setItems(next); setPast([]); setFuture([]); };
  return { items, commit, undo, redo, update, reset, canUndo: past.length > 0, canRedo: future.length > 0 };
}
