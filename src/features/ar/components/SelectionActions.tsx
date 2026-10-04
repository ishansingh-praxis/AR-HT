import { t } from '../../../i18n';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/ui';
import { variantLabel } from '../../../data/furniture';
import { colors } from '../../../theme';
import type { Product } from '../../../types/furniture';

/** Option / Pairs-with / Swap chips and copy / delete for the selected piece. Moving, turning and resizing are done with the fingers (see GestureHint). */
export function SelectionActions({ selected, variants, pairs, swaps, onSwap, onPick, onCopy, onDelete }: {
  selected: Product; variants: Product[]; pairs: Product[]; swaps: Product[];
  onSwap: (id: string) => void; onPick: (id: string) => void; onCopy: () => void; onDelete: () => void;
}) {
  return (
    <View>
      {(pairs.length > 0 || swaps.length > 0 || variants.length > 0) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
          {variants.map((p) => <Chip key={'v' + p.id} label={t('selection.option', { name: variantLabel(p, selected) })} onPress={() => onSwap(p.id)} />)}
          {pairs.map((p) => <Chip key={'p' + p.id} label={t('selection.pairsWith', { name: p.name })} onPress={() => onPick(p.id)} />)}
          {swaps.map((p) => <Chip key={'s' + p.id} label={t('selection.swap', { name: p.name })} onPress={() => onSwap(p.id)} />)}
        </ScrollView>
      )}
      <View style={s.row}>
        <Button label={t('plan.copy')} variant="outline" onPress={onCopy} style={s.flex} />
        <Button label={t('designs.delete')} variant="danger" onPress={onDelete} style={s.flex} />
      </View>
    </View>
  );
}

const Chip = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable accessibilityLabel={label} onPress={onPress} style={s.chip}><Text style={s.chipText}>{label}</Text></Pressable>
);

const s = StyleSheet.create({
  row: { flexDirection: 'row', marginTop: 4 },
  flex: { flex: 1, marginHorizontal: 3 },
  chip: { minHeight: 44, justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.line, marginRight: 8 },
  chipText: { color: colors.ink, fontSize: 13 },
});
