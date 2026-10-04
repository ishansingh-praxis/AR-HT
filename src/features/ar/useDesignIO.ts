import { t } from '../../i18n';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { fromFrame, fromFrameYaw, toFrame, toFrameYaw } from '../../utils/frame';
import { layoutFits, placeLayout, placeOffsets, type RoomBox } from '../../utils/room';
import { buildStarter, layoutFromSlots } from '../../recommend/helpers';
import { getRoom, ROOM_ID_PREFIX, roomToDesign, turnOffsets, type CuratedRoom } from '../../data/rooms';
import { useRooms } from '../../store/roomStore';
import { suggestLayout } from '../../services/api';
import { track } from '../../services/events';
import { captureThumbnail } from '../../services/thumbnails';
import { isWallOnly, type Vec3 } from './shared';
import type { ARSessionHandle } from '../../ar/types';
import type { PlacedItem, Product, SavedDesign } from '../../types/furniture';

type LayoutItems = SavedDesign['items'];

interface Args {
  params: { designId?: string; productId?: string; starter?: boolean; sharedItems?: LayoutItems; fromPlan?: boolean };
  catalogue: Product[];
  items: PlacedItem[];
  commit: (next: PlacedItem[]) => void;
  session: { current: ARSessionHandle | null };
  hit: { current: Vec3 | null };
  scan: { corners: Vec3[]; box: RoomBox | null };
  planes: { current: Map<string, any> };
  token: string | null;
  anchorProduct?: Product;
  room?: { area: number; maxSpan: number } | null;
  /** Called after a design was saved, with how many designs the user now has (used for the "Back up your designs?" prompt). */
  onSaved?: (count: number) => void;
}

/** Saving, reopening, sample rooms, AI layouts and cloud pinning: everything that turns a layout into placed pieces and back. */
export function useDesignIO(a: Args) {
  const saveDesign = useRooms((s) => s.save);
  const roomType = useRooms((s) => s.roomType);
  const saved = useRooms((s) => s.designs.find((d) => d.id === a.params.designId));
  const initialRoom = a.params.designId?.startsWith(ROOM_ID_PREFIX) ? getRoom(a.params.designId.slice(ROOM_ID_PREFIX.length)) : undefined;
  const design = saved ?? (initialRoom ? roomToDesign(initialRoom) : undefined);

  const initial = useMemo(
    () => design?.items ?? a.params.sharedItems ?? (a.params.starter ? buildStarter(roomType, a.catalogue, a.params.productId ? a.catalogue.find((p) => p.id === a.params.productId) : undefined) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [layoutItems, setLayoutItems] = useState<LayoutItems | null>(initial);
  const [pending, setPending] = useState(!!initial);
  const [isFrame, setIsFrame] = useState(!!design?.frame);
  const [curated, setCurated] = useState<CuratedRoom | undefined>(initialRoom);
  const [turns, setTurns] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [active, setActive] = useState(design);

  /** Load a curated sample room from the sheet's Rooms tab; it is placed with the Place button. */
  const loadRoom = (r: CuratedRoom) => {
    const d = roomToDesign(r);
    setActive(d);
    setCurated(r); setLayoutItems(d.items); setIsFrame(false); setTurns(0); setPending(true);
  };
  const turn = () => {
    if (curated && a.scan.box) setTurns((k) => k + 1);
    else if (layoutItems) setLayoutItems(turnOffsets(layoutItems, 90));
  };

  const commitLayout = (made: PlacedItem[]) => {
    a.commit(made); setPending(false);
    track(curated ? 'sample_room_placed' : 'design_reopened', { id: curated?.id ?? active?.id ?? '', pieces: made.length });
  };

  /** Places the pending layout. Returns true when it was handled (even if it asked the user something). */
  const placePending = async (): Promise<boolean> => {
    const at = a.hit.current;
    if (!pending || !layoutItems || !at) return false;
    const stamp = Date.now();
    const d0 = active;
    if (isFrame && d0?.cloudAnchorId) {
      // Pinned to the room with a cloud anchor: find it again, then everything lands where it was.
      if (!a.session.current) { Alert.alert(t('useDesignIO.cloudAnchorsUnavailable'), t('useDesignIO.thisBuildHasNo')); return true; }
      setThinking(true);
      try {
        const r = await a.session.current.resolveCloudAnchor(d0.cloudAnchorId);
        if (!r?.success || !r.anchor) { Alert.alert(t('useDesignIO.couldNotFindYour'), t('useDesignIO.lookSlowlyAroundThe')); return true; }
        const yaw = r.anchor.rotation?.[1] ?? 0;
        commitLayout(layoutItems.map((d, n) => { const w = fromFrameYaw(r.anchor!.position, yaw, { offset: d.offset as Vec3, rotationY: d.rotationY }); return { uid: `${stamp}-${n}`, productId: d.productId, position: w.position, rotationY: w.rotationY, scale: d.scale }; }));
      } catch { Alert.alert(t('useDesignIO.couldNotReachThe'), t('common.checkConnection')); } finally { setThinking(false); }
      return true;
    }
    if (isFrame) {
      // Saved with two reference points: the first two scanned corners are the same two points.
      if (a.scan.corners.length < 2) { Alert.alert(t('useDesignIO.scanTheRoomFirst'), t('useDesignIO.tapScanThenMark')); return true; }
      const [c0, c1] = a.scan.corners;
      commitLayout(layoutItems.map((d, n) => { const w = fromFrame(c0, c1, { offset: d.offset as Vec3, rotationY: d.rotationY }); return { uid: `${stamp}-${n}`, productId: d.productId, position: w.position, rotationY: w.rotationY, scale: d.scale }; }));
      return true;
    }
    if (curated && a.scan.box) {
      // Sample room in a scanned room: centred and aligned to its walls.
      const box = a.scan.box;
      const go = () => commitLayout(placeLayout(curated, box, turns, `${stamp}-`).map((p) => ({ ...p, position: [p.position[0], at[1], p.position[2]] as Vec3 })));
      if (layoutFits(curated.roomCm, box, turns)) go();
      else Alert.alert(t('useDesignIO.biggerThanYourRoom'), t('useDesignIO.thisSampleRoomIs'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('designIO.placeAnyway'), onPress: go }]);
      return true;
    }
    if (a.params.fromPlan && a.scan.box) {
      // A plan drawn in the 2D editor, opened after a room scan: centred in the room and turned to its walls.
      commitLayout(placeOffsets(layoutItems, a.scan.box, `${stamp}-`).map((p) => ({ ...p, position: [p.position[0], at[1], p.position[2]] as Vec3 })));
      return true;
    }
    commitLayout(layoutItems.map((d, n) => ({ uid: `${stamp}-${n}`, productId: d.productId, position: [at[0] + d.offset[0], at[1] + d.offset[1], at[2] + d.offset[2]] as Vec3, rotationY: d.rotationY, scale: d.scale })));
    return true;
  };

  const save = () => {
    if (a.items.length === 0) return Alert.alert(t('useDesignIO.nothingToSave'), t('useDesignIO.placeAtLeastOne'));
    track('design_saved', { pieces: a.items.length });
    if (a.scan.corners.length >= 2) {
      const [p, q] = a.scan.corners;
      const id = saveDesign({ frame: true, items: a.items.map((i) => { const f = toFrame(p, q, i); return { productId: i.productId, offset: f.offset, rotationY: f.rotationY, scale: i.scale }; }) });
      captureThumbnail(a.session, id);
      a.onSaved?.(useRooms.getState().designs.length);
      return Alert.alert(t('useDesignIO.designSavedWithReference'), t('useDesignIO.toBringItBack'));
    }
    const o = a.items[0].position;
    const id = saveDesign({ items: a.items.map((i) => ({ productId: i.productId, offset: [i.position[0] - o[0], i.position[1] - o[1], i.position[2] - o[2]] as Vec3, rotationY: i.rotationY, scale: i.scale })) });
    captureThumbnail(a.session, id);
    a.onSaved?.(useRooms.getState().designs.length);
    Alert.alert(t('plan.designSaved'), t('useDesignIO.findItUnderSaved'));
  };

  const aiLayout = async () => {
    const anchor = a.anchorProduct;
    if (!a.token || !anchor) return;
    setThinking(true);
    try {
      const { slots } = await suggestLayout(a.token, { roomType, anchorId: anchor.id, room: a.room ?? undefined });
      track('ai_layout_used', { slots: slots.length });
      const made = layoutFromSlots(anchor, slots, a.catalogue);
      if (made.length < 2) throw new Error(t('designIO.noSuggestions'));
      setCurated(undefined); setLayoutItems(made); setIsFrame(false); setPending(true);
      Alert.alert(t('useDesignIO.layoutReady'), t('designIO.layoutReadyBody', { count: made.length, name: anchor.name }));
    } catch (e: any) {
      Alert.alert(t('useDesignIO.couldNotSuggestA'), String(e?.message ?? e));
    } finally { setThinking(false); }
  };

  const pin = async () => {
    const floor = a.items.find((i) => !isWallOnly(a.catalogue.find((p) => p.id === i.productId)));
    if (!floor) return Alert.alert(t('useDesignIO.nothingToPin'), t('useDesignIO.placeAtLeastOne2'));
    let best: any = null, bd = Infinity;
    for (const pl of a.planes.current.values()) {
      if (!pl.position) continue;
      const d = Math.hypot(pl.position[0] - floor.position[0], pl.position[2] - floor.position[2]);
      if (d < bd) { bd = d; best = pl; }
    }
    if (!best || !a.session.current) return Alert.alert(t('useDesignIO.notReadyToPin'), t('useDesignIO.scanTheFloorAround'));
    setThinking(true);
    try {
      const r = await a.session.current.hostCloudAnchor(best.anchorId, 30);
      if (!r?.success || !r.cloudAnchorId) {
        const why: Record<string, string> = { ErrorNotAuthorized: t('designIO.anchorNotAuthorized'), ErrorHostingDatasetProcessingFailed: t('designIO.anchorMoveMore'), ErrorResourceExhausted: t('designIO.anchorQuota') };
        throw new Error(why[r?.state ?? ''] ?? r?.error ?? t('designIO.hostingFailed'));
      }
      const yaw = best.rotation?.[1] ?? 0;
      saveDesign({ frame: true, cloudAnchorId: r.cloudAnchorId, items: a.items.map((i) => { const f = toFrameYaw(best.position, yaw, i); return { productId: i.productId, offset: f.offset, rotationY: f.rotationY, scale: i.scale }; }) });
      Alert.alert(t('useDesignIO.pinnedToThisRoom'), t('useDesignIO.openItFromSaved'));
    } catch (e: any) { Alert.alert(t('useDesignIO.couldNotPinThe'), String(e?.message ?? e)); } finally { setThinking(false); }
  };

  const placeLabel = isFrame ? (active?.cloudAnchorId ? t('designIO.findRoomPlace') : t('designIO.placeAtReference')) : curated ? t('designIO.placeRoom', { title: curated.title }) : t('designIO.placeLayout');
  return { pending, layoutItems, thinking, placeLabel, curated, placePending, loadRoom, turn, save, aiLayout, pin };
}
