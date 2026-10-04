import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProductImage } from '../../components/ProductImage';
import { getFurniture } from '../../data/furniture';
import { rupees, type BudgetLine } from '../../studio/studio';
import { colors } from '../../theme';
import { t } from '../../i18n';

/** One product in the room: photo, name, how many, what it costs, and buttons to remove one or add one more. */
export function ItemRow({ line, onMinus, onPlus }: { line: BudgetLine; onMinus: () => void; onPlus: () => void }) {
  const p = getFurniture(line.productId);
  if (!p) return null;
  const sets = p.setSize && p.setSize > 1;
  return (
    <View style={s.row} accessible accessibilityLabel={t('studio.rowLabel', { name: p.name, count: line.pieces, price: line.unit ? rupees(line.subtotal) : t('studio.noPrice') })}>
      <ProductImage uri={p.images[0]} blurhash={p.blurhash} style={s.img} />
      <View style={s.mid}>
        <Text style={s.name} numberOfLines={2}>{p.name}</Text>
        <Text style={s.meta}>{sets ? t('studio.setsLine', { pieces: line.pieces, sets: line.sets }) : t('studio.piecesLine', { count: line.pieces })}</Text>
        <Text style={s.price}>{line.unit ? rupees(line.subtotal) : t('studio.noPrice')}</Text>
      </View>
      <View style={s.buttons}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('studio.removeOne', { name: p.name })} onPress={onMinus} style={s.btn}><Text style={s.btnText}>−</Text></Pressable>
        <Text style={s.count}>{line.pieces}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('studio.addOne', { name: p.name })} onPress={onPlus} style={s.btn}><Text style={s.btnText}>+</Text></Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 8, marginBottom: 8 },
  img: { width: 64, height: 64, borderRadius: 8 },
  mid: { flex: 1, paddingHorizontal: 10 },
  name: { color: colors.ink, fontWeight: '600', fontSize: 13 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  price: { color: colors.accent, fontWeight: '700', marginTop: 2 },
  buttons: { alignItems: 'center' },
  btn: { width: 44, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  btnText: { fontSize: 20, color: colors.ink, fontWeight: '700' },
  count: { color: colors.ink, fontWeight: '700', marginVertical: 2 },
});
