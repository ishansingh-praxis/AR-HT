import { t } from '../../../i18n';
import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/ui';
import { ProductPicker } from './ProductPicker';
import { SuggestionChips } from './SuggestionChips';
import { ROOMS, roomAreaM2, type CuratedRoom } from '../../../data/rooms';
import { colors } from '../../../theme';
import type { Recommendation } from '../../../recommend/engine';
import type { Product } from '../../../types/furniture';
import type { useScan } from '../useScan';
import type { useWall } from '../useWall';

type Tab = 'Suggested' | 'All' | 'Rooms' | 'Tools';
const TABS: Tab[] = ['Suggested', 'All', 'Rooms', 'Tools'];

export interface SheetProps {
  bottomInset: number;
  products: Product[];
  suggested: Recommendation[];
  productId?: string;
  onPick: (id: string) => void;
  scan: ReturnType<typeof useScan>;
  wall: ReturnType<typeof useWall>;
  hasSurface: boolean;
  onAddCorner: () => void;
  onAddWallPoint: () => void;
  placeLabel: string;
  onPlace: () => void;
  pending: boolean;
  onTurn: () => void;
  onRoom: (r: CuratedRoom) => void;
  tools: { save: () => void; photo: () => void; thinking: boolean; aiLayout?: () => void; pin?: () => void };
  selection?: React.ReactNode;
}

/** The bottom sheet: Suggested · All · Rooms · Tools, a scan/wall mode bar, and the Place button. */
export function BottomSheet(p: SheetProps) {
  const [tab, setTab] = useState<Tab>('Suggested');
  const { scan, wall } = p;
  const mode = scan.scanning ? 'scan' : wall.active ? 'wall' : 'place';
  return (
    <View style={[s.sheet, { paddingBottom: p.bottomInset + 12 }]}>
      {p.selection}
      <View style={s.tabs} accessibilityRole="tablist">
        {TABS.map((name) => (
          <Pressable key={name} accessibilityRole="tab" accessibilityLabel={t(`sheet.tab${name}`)} accessibilityState={{ selected: tab === name }} onPress={() => setTab(name)} style={[s.tab, tab === name && s.tabOn]}>
            <Text style={[s.tabText, tab === name && { color: colors.accentInk }]}>{t(`sheet.tab${name}`)}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ minHeight: 60, marginBottom: 8 }}>
        {tab === 'Suggested' && <SuggestionChips data={p.suggested} productId={p.productId} onPick={p.onPick} />}
        {tab === 'All' && <ProductPicker products={p.products} productId={p.productId} onPick={p.onPick} />}
        {tab === 'Rooms' && (
          <FlatList horizontal showsHorizontalScrollIndicator={false} data={ROOMS} keyExtractor={(r) => r.id}
            renderItem={({ item: r }) => (
              <Pressable accessibilityLabel={t('sheet.placeSampleRoom', { title: r.title })} onPress={() => p.onRoom(r)} style={s.room}>
                <Text style={s.roomTitle} numberOfLines={1}>{r.title}</Text>
                <Text style={s.roomSub}>{roomAreaM2(r).toFixed(0)} m² · {r.pieces.length} pieces</Text>
              </Pressable>
            )} />
        )}
        {tab === 'Tools' && (
          <View>
            <View style={s.row}>
              <Button label={p.scan.box ? t('sheet.rescan') : t('sheet.scanRoom')} variant="outline" onPress={scan.start} style={s.flex} />
              <Button label={t('bottomSheet.markWall')} variant="outline" onPress={wall.start} style={s.flex} />
              <Button label={t('bottomSheet.save')} variant="outline" onPress={p.tools.save} style={s.flex} />
              <Button label={t('bottomSheet.photo')} variant="outline" onPress={p.tools.photo} style={s.flex} />
            </View>
            {(p.tools.aiLayout || p.tools.pin || wall.wall || scan.box) && (
              <View style={s.row}>
                {p.tools.aiLayout && <Button label={p.tools.thinking ? t('sheet.thinking') : t('sheet.aiLayout')} variant="outline" disabled={p.tools.thinking} onPress={p.tools.aiLayout} style={s.flex} />}
                {p.tools.pin && <Button label={p.tools.thinking ? t('sheet.working') : t('sheet.pinToRoom')} variant="outline" disabled={p.tools.thinking} onPress={p.tools.pin} style={s.flex} />}
                {wall.wall && <Button label={t('bottomSheet.flipWallSide')} variant="outline" onPress={wall.flip} style={s.flex} />}
                {wall.points.length > 0 && <Button label={t('bottomSheet.clearWall')} variant="outline" onPress={wall.clear} style={s.flex} />}
                {scan.box && <Button label={t('bottomSheet.clearRoom')} variant="outline" onPress={scan.clear} style={s.flex} />}
              </View>
            )}
          </View>
        )}
      </View>

      {mode === 'scan' && (
        <View>
          <Text style={s.hint}>Stand at each floor corner of the room, aim the dot at it, tap Mark corner. Corners marked: {scan.corners.length}</Text>
          <View style={s.row}>
            <Button label={t('bottomSheet.markCorner')} onPress={p.onAddCorner} disabled={!p.hasSurface} style={s.flex} />
            <Button label={t('plan.undo')} variant="outline" onPress={scan.undoCorner} disabled={!scan.corners.length} style={s.flex} />
            <Button label={t('accountSection.done')} variant="outline" onPress={scan.finish} disabled={scan.corners.length < 3} style={s.flex} />
            <Button label={t('bottomSheet.skip')} variant="outline" onPress={scan.skip} style={s.flex} />
          </View>
        </View>
      )}
      {mode === 'wall' && (
        <View style={s.row}>
          <Button label={t('sheet.addWallPoint', { n: wall.points.length + 1 })} onPress={p.onAddWallPoint} disabled={!p.hasSurface} style={s.flex} />
          <Button label={t('bottomSheet.cancel')} variant="outline" onPress={wall.clear} style={s.flex} />
        </View>
      )}
      {mode === 'place' && (
        <View>
          {p.pending && <Button label={t('bottomSheet.turnLayout90')} variant="outline" onPress={p.onTurn} style={{ marginBottom: 8 }} />}
          <Button label={p.placeLabel} onPress={p.onPlace} disabled={!p.hasSurface} />
          <Text style={s.hint}>{t('bottomSheet.dragToMoveTwist')}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, padding: 14, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  tabs: { flexDirection: 'row', marginBottom: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, marginRight: 6, minHeight: 44, justifyContent: 'center' },
  tabOn: { backgroundColor: colors.accent },
  tabText: { color: colors.ink, fontWeight: '600', fontSize: 13 },
  row: { flexDirection: 'row', marginTop: 6 },
  flex: { flex: 1, marginHorizontal: 3 },
  room: { width: 170, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.line, marginRight: 8 },
  roomTitle: { color: colors.ink, fontWeight: '600' },
  roomSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8, marginBottom: 4 },
});
