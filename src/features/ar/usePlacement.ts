import { t } from '../../i18n';
import { Alert } from 'react-native';
import { hangOnWall, type Wall } from '../../utils/wall';
import { track } from '../../services/events';
import { MAX_PIECES } from '../../utils/perf';
import { isWallOnly, snap, type Vec3 } from './shared';
import type { PlacedItem, Product } from '../../types/furniture';

interface Args {
  hit: { current: Vec3 | null };
  items: PlacedItem[];
  commit: (next: PlacedItem[]) => void;
  product?: Product;
  wall: Wall | null;
  selected: PlacedItem | null;
  setSelectedId: (uid: string | null) => void;
  isSuggested: (id: string) => boolean;
}

/** Placing one piece at the aim dot (floor or wall), and the actions on the selected piece. */
export function usePlacement({ hit, items, commit, product, wall, selected, setSelectedId, isSuggested }: Args) {
  /** Returns true when a piece was placed. */
  const placePiece = (): boolean => {
    const at = hit.current;
    if (!at || !product) return false;
    if (items.length >= MAX_PIECES) { Alert.alert(t('usePlacement.thatIsALot'), t('placement.limitBody', { max: MAX_PIECES })); return false; }
    const stamp = String(Date.now());
    if (isWallOnly(product)) {
      if (!wall) { Alert.alert(t('usePlacement.markTheWallFirst'), t('usePlacement.openToolsTapMark')); return false; }
      const h = hangOnWall(wall, at, product.dimensionsCm);
      commit([...items, { uid: stamp, productId: product.id, position: h.position, rotationY: h.rotationY, scale: 1 }]);
      setSelectedId(stamp); track('wall_piece_hung', { id: product.id });
      return true;
    }
    commit([...items, { uid: stamp, productId: product.id, position: [snap(at[0]), at[1], snap(at[2])], rotationY: 0, scale: 1 }]);
    setSelectedId(stamp);
    track('piece_placed', { id: product.id });
    if (isSuggested(product.id)) track('rec_placed', { id: product.id });
    return true;
  };
  const duplicate = () => {
    if (!selected) return;
    if (items.length >= MAX_PIECES) { Alert.alert(t('usePlacement.thatIsALot'), t('placement.limitShort', { max: MAX_PIECES })); return; }
    const copy: PlacedItem = { ...selected, uid: String(Date.now()), position: [selected.position[0] + 0.3, selected.position[1], selected.position[2] + 0.3] };
    commit([...items, copy]); setSelectedId(copy.uid);
  };
  const remove = () => { if (!selected) return; track('piece_removed', { id: selected.productId }); commit(items.filter((i) => i.uid !== selected.uid)); setSelectedId(null); };
  const rotate = (deg: number) => selected && commit(items.map((i) => (i.uid === selected.uid ? { ...i, rotationY: i.rotationY + deg } : i)));
  const swap = (id: string) => selected && commit(items.map((i) => (i.uid === selected.uid ? { ...i, productId: id, scale: 1 } : i)));
  return { placePiece, duplicate, remove, rotate, swap };
}
