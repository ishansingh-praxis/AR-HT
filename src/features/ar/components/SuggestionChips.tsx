import React from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { ProductCard } from '../../../components/ProductCard';
import { colors } from '../../../theme';
import { t } from '../../../i18n';
import type { Recommendation } from '../../../recommend/engine';

/** Horizontal cards from the recommendation engine: photo, name, size, price and the first reason. */
export function SuggestionChips({ data, productId, onPick }: { data: Recommendation[]; productId?: string; onPick: (id: string) => void }) {
  if (!data.length) return <Text style={s.empty}>{t('suggestionChips.placeAPieceAnd')}</Text>;
  return (
    <FlatList horizontal showsHorizontalScrollIndicator={false} data={data} keyExtractor={(r) => r.product.id}
      renderItem={({ item: r }) => (
        <ProductCard product={r.product} selected={r.product.id === productId} note={r.reasons[0]} width={160}
          label={t('suggestions.select', { name: r.product.name, reason: r.reasons[0] })} onPress={() => onPick(r.product.id)} />
      )} />
  );
}

const s = StyleSheet.create({ empty: { color: colors.muted, paddingVertical: 8 } });
