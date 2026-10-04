import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/ui';
import { PlanCanvas } from '../features/plan/PlanCanvas';
import { PieceList } from '../features/plan/PieceList';
import { useStudio } from '../features/studio/useStudio';
import { BudgetBar } from '../features/studio/BudgetBar';
import { ThemeChips } from '../features/studio/ThemeChips';
import { ItemRow } from '../features/studio/ItemRow';
import { AddPicker } from '../features/studio/AddPicker';
import { getFurniture } from '../data/furniture';
import { collidingUids } from '../utils/geometry';
import { narrowUids } from '../utils/clearance';
import { toPlaced } from '../plan/editor';
import { useSettings } from '../store/settingsStore';
import { colors } from '../theme';
import { t } from '../i18n';
import type { RootStackParamList } from '../navigation/AppNavigator';

/**
 * Design a room: pick a theme, get a matching set of real products laid out to fit, watch the budget, add and remove pieces,
 * drag them around, then save it or see it in your own room.
 */
export default function RoomStudioScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'RoomStudio'>) {
  const { width } = useWindowDimensions();
  const st = useStudio(route.params.kind);
  const { plan } = st;
  const arSupported = useSettings((s) => s.arSupported);
  const [adding, setAdding] = useState(false);
  const [drafts, setDrafts] = useState<{ w?: string; d?: string }>({});
  useLayoutEffect(() => { navigation.setOptions({ title: t('studio.title', { room: t(`kinds.${st.kind.id}`) }) }); }, [navigation, st.kind.id]);

  const placed = useMemo(() => toPlaced(plan.pieces), [plan.pieces]);
  const flagged = useMemo(() => [...new Set([...collidingUids(placed, getFurniture), ...narrowUids(placed, getFurniture)])], [placed]);
  const sizeInput = (label: string, key: 'w' | 'd') => (
    <View style={{ flex: 1, marginRight: 8 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput accessibilityLabel={t('plan.sizeLabel', { label })} keyboardType="number-pad" style={s.input} value={drafts[key] ?? String(Math.round(plan.room[key]))}
        onChangeText={(v) => setDrafts({ ...drafts, [key]: v.replace(/\D/g, '') })} onEndEditing={() => { if (drafts[key]) plan.setRoom({ [key]: +drafts[key]! }); setDrafts({ ...drafts, [key]: undefined }); }} />
    </View>
  );
  const save = () => {
    const id = plan.saveDesign();
    if (id) Alert.alert(t('plan.designSaved'), t('plan.itIsInYour'), [{ text: t('plan.stayHere') }, { text: t('plan.goToSaved'), onPress: () => navigation.navigate('Tabs' as never) }]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text style={s.h}>{t('studio.theme')}</Text>
      <ThemeChips value={st.themeId} onChange={st.chooseTheme} />

      <BudgetBar total={st.budget.total} target={st.target} unpriced={st.budget.unpriced} pieces={plan.pieces.length} budgetText={st.budgetText} onBudgetText={st.setBudgetText} />
      <Button label={t('studio.fitBudget')} variant="outline" disabled={!st.target} onPress={() => st.suggest()} style={{ marginTop: 8 }} />

      <View style={[s.row, { marginTop: 14 }]}>{sizeInput(t('studio.width'), 'w')}{sizeInput(t('studio.depth'), 'd')}</View>
      <Button label={t('studio.suggest')} onPress={() => st.suggest()} style={{ marginTop: 10 }} />
      {st.unplaced.length > 0 ? <Text style={s.warn} accessibilityRole="alert">{t('studio.unplaced', { count: st.unplaced.length })}</Text> : null}

      <View style={{ marginTop: 12 }}>
        <PlanCanvas width={width - 28} room={plan.room} pieces={plan.pieces} selectedId={plan.selectedId} flagged={flagged}
          onSelect={plan.setSelectedId} onDragStart={plan.dragStart} onDragTo={plan.dragTo} onDragEnd={plan.dragEnd} onTwistStart={plan.twistStart} onTwistTo={plan.twistTo} onTwistEnd={plan.twistEnd} />
      </View>
      <Text style={s.hint}>{t('hint.planLine')}</Text>
      <View style={s.row}>
        <Button label={t('plan.undo')} variant="outline" disabled={!plan.canUndo} onPress={plan.undo} style={s.flex} />
        <Button label={t('plan.redo')} variant="outline" disabled={!plan.canRedo} onPress={plan.redo} style={s.flex} />
      </View>

      <Text style={[s.h, { marginTop: 18 }]}>{t('studio.yourItems')}</Text>
      {st.budget.lines.length === 0 ? <Text style={s.hint}>{t('studio.emptyRoom')}</Text> : null}
      {st.budget.lines.map((line) => {
        const p = getFurniture(line.productId);
        return <ItemRow key={line.productId} line={line} onMinus={() => st.removeOne(line.productId)} onPlus={() => p && st.addProduct(p)} />;
      })}
      <Button label={adding ? t('plan.closeList') : t('studio.addFurniture')} variant="outline" onPress={() => setAdding(!adding)} />
      {adding ? <AddPicker kind={st.kind} themeId={st.themeId} catalogue={st.catalogue} onAdd={(p) => { st.addProduct(p); }} /> : null}

      <Text style={[s.h, { marginTop: 18 }]}>{t('plan.pieces')}</Text>
      <PieceList pieces={plan.pieces} room={plan.room} selectedId={plan.selectedId} onSelect={plan.setSelectedId} onMove={plan.move} onRotate={plan.rotate} onDelete={plan.remove} />

      <Button label={t('plan.saveDesign')} onPress={save} style={{ marginTop: 16 }} />
      {arSupported !== false && plan.pieces.length > 0 ? (
        <Button label={t('item.viewInMyRoom')} variant="outline" onPress={() => navigation.navigate('AR', { sharedItems: plan.asItems(), fromPlan: true })} style={{ marginTop: 8 }} />
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h: { fontSize: 17, fontWeight: '800', color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 },
  flex: { flex: 1, marginHorizontal: 3 },
  label: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: 10, color: colors.ink, fontSize: 16, minHeight: 44 },
  hint: { color: colors.muted, fontSize: 12, marginVertical: 8 },
  warn: { color: colors.danger, marginTop: 8, lineHeight: 20 },
});
