import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Product } from '../types/furniture';
import { cm } from '../data/furniture';
import { colors, formatPrice } from '../theme';

export function ProductCard({ item, onPress, note }: { item: Product; onPress: () => void; note?: string }) {
  return (
    <Pressable onPress={onPress} style={s.card} accessibilityLabel={`${item.name}, ${cm(item)}`}>
      <Image source={{ uri: item.images[0] }} style={s.img} resizeMode="cover" />
      <View style={s.body}>
        <Text style={s.name} numberOfLines={2}>{item.name}</Text>
        <Text style={s.meta}>{cm(item)}</Text>
        {item.priceInr ? <Text style={s.meta}>{formatPrice(item.priceInr)}</Text> : null}
        {note ? <Text style={s.note}>{note}</Text> : null}
        {item.modelStatus === 'proxy' ? <Text style={s.badge}>To-scale box in AR</Text> : <Text style={[s.badge, { color: colors.accent }]}>3D model</Text>}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, margin: 6, backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden' },
  img: { width: '100%', aspectRatio: 1, backgroundColor: colors.line },
  body: { padding: 10 },
  name: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  meta: { color: colors.muted, marginTop: 2, fontSize: 12 },
  note: { color: colors.accent, marginTop: 4, fontSize: 12 },
  badge: { color: colors.muted, marginTop: 4, fontSize: 11 },
});
