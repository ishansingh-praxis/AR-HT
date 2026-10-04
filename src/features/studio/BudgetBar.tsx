import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { rupees } from '../../studio/studio';
import { colors } from '../../theme';
import { t } from '../../i18n';

/** The running total for the room, and (when the user types a budget) how much is left or over. */
export function BudgetBar({ total, target, unpriced, pieces, budgetText, onBudgetText }: {
  total: number; target?: number; unpriced: number; pieces: number; budgetText: string; onBudgetText: (v: string) => void;
}) {
  const over = target ? total > target : false;
  const pct = target ? Math.min(1, total / target) : 0;
  const diff = target ? Math.abs(target - total) : 0;
  return (
    <View style={s.card} accessibilityLabel={t('studio.budgetLabel', { total: rupees(total), count: pieces })}>
      <Text style={s.label}>{t('studio.estimatedTotal')}</Text>
      <Text style={[s.total, over && { color: colors.danger }]} accessibilityLiveRegion="polite">{rupees(total)}</Text>
      <Text style={s.small}>{t('studio.pieceCount', { count: pieces })} · {t('studio.fromPrices')}</Text>
      <View style={s.inputRow}>
        <Text style={s.rupee}>₹</Text>
        <TextInput accessibilityLabel={t('studio.myBudget')} placeholder={t('studio.myBudget')} placeholderTextColor={colors.muted} keyboardType="number-pad" style={s.input}
          value={budgetText ? Number(budgetText.replace(/\D/g, '')).toLocaleString('en-IN') : ''} onChangeText={(v) => onBudgetText(v.replace(/\D/g, ''))} />
      </View>
      {target ? (
        <>
          <View style={s.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: over ? colors.danger : colors.accent }]} /></View>
          <Text style={[s.small, { color: over ? colors.danger : colors.accent, fontWeight: '700' }]} accessibilityLiveRegion="polite">
            {over ? t('studio.over', { amount: rupees(diff) }) : t('studio.left', { amount: rupees(diff) })}
          </Text>
        </>
      ) : null}
      {unpriced > 0 ? <Text style={s.small}>{t('studio.unpriced', { count: unpriced })}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginTop: 12 },
  label: { color: colors.muted, fontSize: 12 },
  total: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: 2 },
  small: { color: colors.muted, fontSize: 12, marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 10, marginTop: 10, paddingHorizontal: 12 },
  rupee: { color: colors.muted, fontSize: 16, marginRight: 6 },
  input: { flex: 1, color: colors.ink, fontSize: 16, minHeight: 44 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.line, marginTop: 12, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
