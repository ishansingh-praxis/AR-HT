import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProductImage } from './ProductImage';
import { sizeLabel } from '../data/furniture';
import { rupees } from '../studio/studio';
import { SHOW_PRICES } from '../config';
import { colors } from '../theme';
import type { Product } from '../types/furniture';

/**
 * A product as a small card with its photo, name, size and (when prices are on) the reference price.
 * Used wherever the user picks furniture: the AR sheet's Suggested and All tabs, the room planner, the plan editor.
 */
export function ProductCard({ product, onPress, selected, note, label, width = 150 }: {
  product: Product; onPress: () => void; selected?: boolean; note?: string; label: string; width?: number;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!selected }} onPress={onPress} style={[s.card, { width }, selected && s.on]}>
      <ProductImage uri={product.images[0]} blurhash={product.blurhash} style={s.img} />
      <View style={s.body}>
        <Text style={s.name} numberOfLines={2}>{product.name}</Text>
        <Text style={s.meta} numberOfLines={1}>{sizeLabel(product)}</Text>
        {SHOW_PRICES && product.priceInr ? <Text style={s.price}>{rupees(product.priceInr)}</Text> : null}
        {note ? <Text style={s.note} numberOfLines={2}>{note}</Text> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { marginRight: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden' },
  on: { borderColor: colors.accent, borderWidth: 2 },
  img: { width: '100%', height: 84 },
  body: { padding: 8 },
  name: { color: colors.ink, fontSize: 12, fontWeight: '600', minHeight: 30 },
  meta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  price: { color: colors.accent, fontSize: 12, fontWeight: '700', marginTop: 2 },
  note: { color: colors.muted, fontSize: 11, marginTop: 3 },
});
