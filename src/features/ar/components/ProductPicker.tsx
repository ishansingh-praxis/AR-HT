import { t } from '../../../i18n';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { colors } from '../../../theme';
import type { Product } from '../../../types/furniture';

/** Category chips + every placeable product, to choose what the Place button puts down. */
export function ProductPicker({ products, productId, onPick }: { products: Product[]; productId?: string; onPick: (id: string) => void }) {
  const [cat, setCat] = useState<string | null>(null);
  return (
    <>
      <FlashList horizontal showsHorizontalScrollIndicator={false} data={[null, ...new Set(products.map((f) => f.category))]} keyExtractor={(c) => c ?? 'all'} style={{ marginBottom: 6 }}
        renderItem={({ item: c }) => (
          <Pressable accessibilityLabel={t('picker.category', { name: c ?? t('picker.all') })} onPress={() => setCat(c)} style={[s.chip, cat === c && s.on]}><Text style={[s.text, cat === c && { color: colors.accentInk }]}>{c ?? t('picker.all')}</Text></Pressable>
        )} />
      <FlashList horizontal showsHorizontalScrollIndicator={false}
        data={products.filter((f) => !cat || f.category === cat)} keyExtractor={(f) => f.id}
        renderItem={({ item: f }) => (
          <Pressable accessibilityLabel={t('picker.select', { name: f.name })} onPress={() => onPick(f.id)} style={[s.chip, f.id === productId && s.on]}>
            <Text style={[s.text, f.id === productId && { color: colors.accentInk }]} numberOfLines={1}>{f.name.length > 34 ? f.name.slice(0, 33) + '…' : f.name}</Text>
          </Pressable>
        )} />
    </>
  );
}

const s = StyleSheet.create({
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.line, marginRight: 8, minHeight: 44, justifyContent: 'center' },
  on: { backgroundColor: colors.accent, borderColor: colors.accent },
  text: { color: colors.ink, fontSize: 13 },
});
