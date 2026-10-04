import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { roomFromCorners, type RoomBox } from '../../utils/room';
import { useSettings } from '../../store/settingsStore';
import { track } from '../../services/events';
import type { Vec3 } from '../../ar/types';
import { t } from '../../i18n';

export const MIN_ROOM_M2 = 1.5;
export const MIN_RECTANGULARITY = 0.9;

/**
 * Room scan: the user marks the floor corners of the room (>= 3). The result is the room's size and angle.
 * The first two corners double as the two-point reference frame used when saving a design, so starting the
 * scan from the same corner next time brings a saved design back to the same place.
 */
export function useScan(startScanning: boolean) {
  const setScanned = useSettings((s) => s.setScanned);
  const [scanning, setScanning] = useState(startScanning);
  const [corners, setCorners] = useState<Vec3[]>([]);
  const [box, setBox] = useState<RoomBox | null>(null);

  const start = () => { setCorners([]); setBox(null); setScanning(true); };
  const mark = (at: Vec3 | null) => { if (at) setCorners((c) => [...c, at]); };
  const undoCorner = () => setCorners((c) => c.slice(0, -1));
  const skip = () => { setCorners([]); setScanning(false); };
  const clear = () => { setCorners([]); setBox(null); setScanning(false); };

  const finish = () => {
    const b = roomFromCorners(corners.map((c) => [c[0], c[2]] as [number, number]));
    if (!b) return Alert.alert(t('useScan.markAtLeast3'), t('useScan.standAtTheRoom'));
    if (b.areaM2 < MIN_ROOM_M2) return Alert.alert(t('useScan.thatRoomLooksToo'), t('scan.tooSmallBody', { area: MIN_ROOM_M2 }));
    setBox(b); setScanning(false);
    setScanned({ widthCm: Math.round(b.widthCm), depthCm: Math.round(b.depthCm), areaM2: Math.round(b.areaM2 * 10) / 10, rectangularity: Math.round(b.rectangularity * 100) / 100, at: Date.now() });
    track('room_scanned', { corners: b.corners, areaM2: Math.round(b.areaM2) });
    Alert.alert(t('useScan.roomScanned'),
      t('scan.scannedBody', { w: (b.widthCm / 100).toFixed(1), d: (b.depthCm / 100).toFixed(1), area: b.areaM2.toFixed(1) }) +
      (b.rectangularity < MIN_RECTANGULARITY ? '\n' + t('scan.notRectangle') : '') +
      '\n' + t('scan.tip'),
    );
  };

  /** Room polygon used for floor outlines in the scene. */
  const outline = useMemo(() => (box ? [...corners, corners[0]] : corners), [box, corners]);
  return { scanning, corners, box, outline, start, mark, undoCorner, skip, finish, clear };
}
