import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/ui';
import { PlanCanvas } from '../features/plan/PlanCanvas';
import { PieceList } from '../features/plan/PieceList';
import { GestureHint } from '../components/GestureHint';
import { usePlan } from '../features/plan/usePlan';
import { ProductPicker } from '../features/ar/components/ProductPicker';
import { SuggestionChips } from '../features/ar/components/SuggestionChips';
import { getFurniture, sizeLabel, usePlaceable } from '../data/furniture';
import { toRoomType } from '../data/rooms';
import { recommend } from '../recommend/engine';
import { collidingUids } from '../utils/geometry';
import { narrowUids } from '../utils/clearance';
import { describePiece, toPlaced, wallDistances } from '../plan/editor';
import { useRooms } from '../store/roomStore';
import { useSettings } from '../store/settingsStore';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { t } from '../i18n';

/** 2D top-down editor: the same designs as AR, no camera needed. Drag to move (5 cm), two fingers to pan and zoom. */
export default function PlanScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Plan'>) {
  const FURN = usePlaceable();
  const { width } = useWindowDimensions();
  const roomType = useRooms((r) => r.roomType);
  const arSupported = useSettings((st) => st.arSupported);
  const p = usePlan(route.params ?? {});
  const hintSeen = useSettings((st) => st.hintsSeen.plan);
  const markHint = useSettings((st) => st.markHint);
  const [hint, setHint] = useState(false);
  const [adding, setAdding] = useState(false);
  // Teach the gestures the first time, and from the ? button in the header any time
  useEffect(() => { if (!hintSeen) { const id = setTimeout(() => setHint(true), 600); return () => clearTimeout(id); } }, [hintSeen]);
  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel={t('hint.help')} onPress={() => setHint(true)} hitSlop={10} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22, color: colors.accent, fontWeight: '800' }}>?</Text></Pressable> });
  }, [navigation]);
  const [drafts, setDrafts] = useState<{ w?: string; d?: string }>({});

  const placed = useMemo(() => toPlaced(p.pieces), [p.pieces]);
  const colliding = useMemo(() => [...collidingUids(placed, getFurniture)], [placed]);
  const narrow = useMemo(() => [...narrowUids(placed, getFurniture)], [placed]);
  const flagged = useMemo(() => [...new Set([...colliding, ...narrow])], [colliding, narrow]);
  const suggested = useMemo(
    () => recommend(FURN, { roomType: toRoomType(roomType), areaM2: (p.room.w * p.room.d) / 1e4, placed: p.items.flatMap((item) => { const product = getFurniture(item.productId); return product ? [{ product, item }] : []; }), maxResults: 8 }),
     
    [FURN, roomType, p.room.w, p.room.d, p.items],
  );
  const sel = p.selected, selProduct = sel ? getFurniture(sel.productId) : undefined;
  const walls = sel && selProduct ? wallDistances(sel, selProduct.dimensionsCm, p.room) : null;
  const status = colliding.length ? t('ar.statusOverlap') : narrow.length ? t('plan.statusNarrow') : p.pieces.length ? t('plan.statusGood') : t('plan.statusEmpty');

  const done = () => {
    const id = p.saveDesign();
    if (id) Alert.alert(t('plan.designSaved'), t('plan.itIsInYour'), [{ text: t('plan.stayHere') }, { text: t('plan.goToSaved'), onPress: () => navigation.navigate('Tabs' as never) }]);
  };
  const sizeInput = (label: string, key: 'w' | 'd') => (
    <View style={{ flex: 1, marginRight: 8 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput accessibilityLabel={`${label} in centimetres`} keyboardType="number-pad" style={s.input} value={drafts[key] ?? String(Math.round(p.room[key]))}
        onChangeText={(t) => setDrafts({ ...drafts, [key]: t.replace(/\D/g, '') })} onEndEditing={() => { if (drafts[key]) p.setRoom({ [key]: +drafts[key]! }); setDrafts({ ...drafts, [key]: undefined }); }} />
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
      <View style={s.row}>{sizeInput('Room width (cm)', 'w')}{sizeInput('Room depth (cm)', 'd')}</View>
      <Text style={s.hint}>{p.scanned ? 'Starting from your scanned room. ' : ''}Type the real size to resize the room.</Text>
      <PlanCanvas width={width - 28} room={p.room} pieces={p.pieces} selectedId={p.selectedId} flagged={flagged}
        onSelect={p.setSelectedId} onDragStart={p.dragStart} onDragTo={p.dragTo} onDragEnd={p.dragEnd}
        onTwistStart={p.twistStart} onTwistTo={p.twistTo} onTwistEnd={p.twistEnd} />
      <Text style={s.hint}>{t('hint.planLine')}</Text>
      <Text accessibilityLiveRegion="polite" style={[s.status, (colliding.length || narrow.length) ? { color: colors.danger } : null]}>{status}</Text>

      <View style={s.row}>
        <Button label={t('plan.undo')} variant="outline" disabled={!p.canUndo} onPress={p.undo} style={s.flex} />
        <Button label={t('plan.redo')} variant="outline" disabled={!p.canRedo} onPress={p.redo} style={s.flex} />
        <Button label={adding ? t('plan.closeList') : t('plan.addPiece')} onPress={() => setAdding(!adding)} style={s.flex} />
      </View>
      {adding && (
        <View style={s.card}>
          <Text style={s.h}>{t('plan.suggested')}</Text>
          <SuggestionChips data={suggested} productId={undefined} onPick={(id) => { p.add(id); setAdding(false); }} />
          <Text style={[s.h, { marginTop: 10 }]}>{t('plan.allFurniture')}</Text>
          <ProductPicker products={FURN} productId={undefined} onPick={(id) => { p.add(id); setAdding(false); }} />
        </View>
      )}

      {sel && selProduct && walls ? (
        <View style={s.card}>
          <Text style={s.h}>{selProduct.name}</Text>
          <Text style={s.meta}>{sizeLabel(selProduct)} · {walls.nearestCm < 0 ? `${Math.round(-walls.nearestCm)} cm outside the ${walls.nearest} wall` : `${Math.round(walls.nearestCm)} cm from the ${walls.nearest} wall`}</Text>
          <View style={s.row}>
            <Button label={t('plan.copy')} variant="outline" onPress={() => p.duplicate(sel.uid)} style={s.flex} />
            <Button label={t('designs.delete')} variant="danger" onPress={() => p.remove(sel.uid)} style={s.flex} />
          </View>
        </View>
      ) : null}

      <Text style={[s.h, { marginTop: 14 }]}>{t('plan.pieces')}</Text>
      <PieceList pieces={p.pieces} room={p.room} selectedId={p.selectedId} onSelect={p.setSelectedId} onMove={p.move} onRotate={p.rotate} onDelete={p.remove} />

      <Button label={t('plan.saveDesign')} onPress={done} style={{ marginTop: 14 }} />
      {arSupported !== false && p.pieces.length > 0 ? (
        <Button label={t('plan.openInAr')} variant="outline" onPress={() => navigation.navigate('AR', { sharedItems: p.asItems(), fromPlan: true })} style={{ marginTop: 8 }} />
      ) : null}
      <GestureHint visible={hint} steps={['drag', 'twist', 'pinch', 'slide']} onClose={() => { setHint(false); markHint('plan'); }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', marginTop: 8, alignItems: 'flex-end' },
  flex: { flex: 1, marginHorizontal: 3 },
  label: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: 10, color: colors.ink, fontSize: 16, minHeight: 44 },
  hint: { color: colors.muted, fontSize: 12, marginVertical: 8 },
  status: { color: colors.muted, marginTop: 8, minHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginTop: 10 },
  h: { fontSize: 16, fontWeight: '700', color: colors.ink },
  meta: { color: colors.muted, marginTop: 2 },
});
