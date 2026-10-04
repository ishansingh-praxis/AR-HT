import { useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useLayoutHistory } from '../ar/useLayoutHistory';
import { getFurniture, usePlaceable } from '../../data/furniture';
import { getRoom, ROOM_ID_PREFIX, roomToDesign } from '../../data/rooms';
import { useRooms } from '../../store/roomStore';
import { useSettings } from '../../store/settingsStore';
import { track } from '../../services/events';
import {
  clampInside, clampRoom, defaultRoom, fitRoomToItems, fromPlaced, itemsToPlan, nudge, planToItems, snapCm, toPlaced, turnDeg, type RoomSize, type Wall,
} from '../../plan/editor';
import type { PlacedItem } from '../../types/furniture';
import { t } from '../../i18n';

const dimsOf = (productId: string) => getFurniture(productId)?.dimensionsCm ?? { w: 50, d: 50, h: 50 };
let counter = 0;
const uid = () => `pl${Date.now().toString(36)}${counter++}`;

/** State and actions of the plan editor. Pieces are PlacedItems in metres so undo/redo is the same hook the AR screen uses. */
export function usePlan(params: { designId?: string; productId?: string }) {
  usePlaceable();
  const scan = useSettings((s) => s.scanned);
  const preset = useSettings((s) => s.preset);
  const saved = useRooms((s) => s.designs.find((d) => d.id === params.designId));
  const save = useRooms((s) => s.save);
  const updateItems = useRooms((s) => s.updateItems);

  // First render decides the starting room and pieces: a saved design or curated room, else an empty room (plus the product the user came from).
  const start = useMemo(() => {
    const design = saved ?? (params.designId?.startsWith(ROOM_ID_PREFIX) ? (() => { const r = getRoom(params.designId!.slice(ROOM_ID_PREFIX.length)); return r ? roomToDesign(r) : undefined; })() : undefined);
    if (design) {
      const { room, origin } = fitRoomToItems(design.items, getFurniture, scan);
      return { room, items: toPlaced(itemsToPlan(design.items, origin, uid())) };
    }
    const room = defaultRoom(scan, preset);
    const first: PlacedItem[] = params.productId && getFurniture(params.productId)
      ? [{ uid: uid(), productId: params.productId, position: [room.w / 200, 0, room.d / 200], rotationY: 0, scale: 1 }] : [];
    return { room, items: first };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const history = useLayoutHistory(start.items);
  const [room, setRoomState] = useState<RoomSize>(start.room);
  const [selectedId, setSelectedId] = useState<string | null>(start.items[0]?.uid ?? null);
  const [savedId, setSavedId] = useState<string | undefined>(saved?.id);
  const dragging = useRef(false);

  const pieces = useMemo(() => fromPlaced(history.items), [history.items]);
  const selected = pieces.find((p) => p.uid === selectedId) ?? null;
  const setRoom = (r: Partial<RoomSize>) => setRoomState((cur) => ({ w: clampRoom(r.w ?? cur.w), d: clampRoom(r.d ?? cur.d) }));

  const edit = (id: string, f: (x: number, z: number, rot: number) => { x?: number; z?: number; rot?: number }) => {
    const it = history.items.find((i) => i.uid === id);
    if (!it) return;
    const n = f(it.position[0] * 100, it.position[2] * 100, it.rotationY);
    const rot = n.rot ?? it.rotationY;
    const inside = clampInside({ x: n.x ?? it.position[0] * 100, z: n.z ?? it.position[2] * 100, rot }, dimsOf(it.productId), room);
    history.commit(history.items.map((i) => (i.uid === id ? { ...i, position: [inside.x / 100, 0, inside.z / 100] as [number, number, number], rotationY: rot } : i)));
  };

  return {
    room, setRoom, pieces, items: history.items, selected, selectedId, setSelectedId, canUndo: history.canUndo, canRedo: history.canRedo,
    undo: () => { if (history.undo()) setSelectedId(null); }, redo: () => { if (history.redo()) setSelectedId(null); },
    add: (productId: string) => {
      const id = uid();
      history.commit([...history.items, { uid: id, productId, position: [room.w / 200, 0, room.d / 200], rotationY: 0, scale: 1 }]);
      setSelectedId(id); track('piece_placed', { id: productId });
    },
    remove: (id: string) => { history.commit(history.items.filter((i) => i.uid !== id)); setSelectedId(null); track('piece_removed'); },
    duplicate: (id: string) => {
      const it = history.items.find((i) => i.uid === id);
      if (!it) return;
      const copy = { ...it, uid: uid(), position: [it.position[0] + 0.3, 0, it.position[2] + 0.3] as [number, number, number] };
      history.commit([...history.items, copy]); setSelectedId(copy.uid);
    },
    rotate: (id: string, by: number) => edit(id, (_x, _z, rot) => ({ rot: turnDeg(rot, by) })),
    move: (id: string, dir: Wall, step = 25) => edit(id, (x, z) => nudge({ x, z }, dir, step)),
    /** Drag: one history entry for the whole gesture (taken at the start), then free updates. */
    dragStart: (id: string) => { if (dragging.current) return; dragging.current = true; history.commit(history.items); setSelectedId(id); },
    dragTo: (id: string, x: number, z: number) => {
      const it = history.items.find((i) => i.uid === id);
      if (!it) return;
      const p = clampInside({ x: snapCm(x), z: snapCm(z), rot: it.rotationY }, dimsOf(it.productId), room);
      history.update(id, { position: [p.x / 100, 0, p.z / 100] });
    },
    dragEnd: () => { dragging.current = false; },
    /** Saves as a new design, or updates the one that was opened. Same `items[]` as AR, so it opens in either. */
    saveDesign: () => {
      if (!pieces.length) { Alert.alert(t('useDesignIO.nothingToSave'), t('usePlan.addAtLeastOne')); return undefined; }
      const items = planToItems(pieces);
      track('design_saved', { pieces: pieces.length, plan: 1 });
      if (savedId) { updateItems(savedId, items); return savedId; }
      const id = save({ items, frame: false });
      setSavedId(id);
      return id;
    },
    asItems: () => planToItems(pieces),
    scanned: scan,
  };
}
