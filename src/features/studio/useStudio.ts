import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { usePlan } from '../plan/usePlan';
import { getFurniture, usePlaceable, useProducts } from '../../data/furniture';
import { budgetOf, designRoom, getKind, getTheme, placeAnother, type KindId } from '../../studio/studio';
import { track } from '../../services/events';
import { t } from '../../i18n';
import type { Product } from '../../types/furniture';

/** State of the room planner: theme, budget target, the layout (the same editor state as the plan view) and the running total. */
export function useStudio(kindId: KindId) {
  const catalogue = usePlaceable();
  useProducts();
  const kind = getKind(kindId);
  const [themeId, setThemeId] = useState('modern');
  const [budgetText, setBudgetText] = useState('');
  const target = Number(budgetText.replace(/\D/g, '')) || undefined;

  // The first set is chosen once, when the screen opens
  const first = useMemo(() => designRoom(catalogue, kind, getTheme('modern'), kind.room, getFurniture), []); // eslint-disable-line react-hooks/exhaustive-deps
  const plan = usePlan({}, { room: kind.room, pieces: first.pieces });
  const [unplaced, setUnplaced] = useState<string[]>(first.unplaced);
  const budget = useMemo(() => budgetOf(plan.pieces, getFurniture), [plan.pieces]);

  /** Picks a fresh matching set for the theme, room size and budget, and lays it out (one undo step brings the old layout back). */
  const suggest = (theme = themeId, budgetInr = target) => {
    const r = designRoom(catalogue, kind, getTheme(theme), plan.room, getFurniture, { budgetInr });
    plan.loadLayout(r.pieces);
    setUnplaced(r.unplaced);
    track('ai_layout_used', { slots: r.pieces.length });
  };
  const chooseTheme = (id: string) => { setThemeId(id); suggest(id); };

  const addProduct = (p: Product): boolean => {
    const spot = placeAnother(plan.room, plan.pieces, p, getFurniture);
    if (!spot) { Alert.alert(t('studio.noSpaceTitle'), t('studio.noSpaceBody', { name: p.name })); return false; }
    plan.addAt(p.id, spot.x, spot.z, spot.rot);
    setUnplaced((u) => u.filter((id) => id !== p.id));
    return true;
  };
  const removeOne = (productId: string) => {
    const last = [...plan.pieces].reverse().find((pc) => pc.productId === productId);
    if (last) plan.remove(last.uid);
  };

  return { kind, plan, themeId, chooseTheme, budgetText, setBudgetText, target, budget, unplaced, suggest, addProduct, removeOne, catalogue };
}
