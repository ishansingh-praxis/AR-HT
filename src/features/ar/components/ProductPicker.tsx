import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ProductCard } from '../../../components/ProductCard';
import { colors } from '../../../theme';
import { t } from '../../../i18n';
import type { Product } from '../../../types/furniture';

/** Category chips + every placeable product as photo cards, to choose what the Place button puts down. */
export function ProductPicker({ products, productId, onPick }: { products: Product[]; productId?: string; onPick: (id: string) => void }) {
  const [cat, setCat] = useState<string | null>(null);
  const shown = products.filter((f) => !cat || f.category === cat);
  return (
    <View>
      <View style={{ height: 48, marginBottom: 6 }}>
        <FlashList horizontal showsHorizontalScrollIndicator={false} data={[null, ...new Set(products.map((f) => f.category))]} keyExtractor={(c) => c ?? 'all'}
          renderItem={({ item: c }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={t('picker.category', { name: c ?? t('picker.all') })} accessibilityState={{ selected: cat === c }} onPress={() => setCat(c)} style={[s.chip, cat === c && s.on]}>
              <Text style={[s.text, cat === c && { color: colors.accentInk }]}>{c ?? t('picker.all')}</Text>
            </Pressable>
          )} />
      </View>
      <View style={{ height: 178 }}>
        <FlashList horizontal showsHorizontalScrollIndicator={false} data={shown} keyExtractor={(f) => f.id}
          renderItem={({ item: f }) => <ProductCard product={f} selected={f.id === productId} width={140} label={t('picker.select', { name: f.name })} onPress={() => onPick(f.id)} />} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.line, marginRight: 8, minHeight: 44, justifyContent: 'center' },
  on: { backgroundColor: colors.accent, borderColor: colors.accent },
  text: { color: colors.ink, fontSize: 13 },
});
