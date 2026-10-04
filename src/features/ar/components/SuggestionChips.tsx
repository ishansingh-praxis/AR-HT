import React from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { sizeLabel } from '../../../data/furniture';
import { colors } from '../../../theme';
import type { Recommendation } from '../../../recommend/engine';
import { t } from '../../../i18n';

/** Horizontal cards from the recommendation engine: name, size and the first reason. */
export function SuggestionChips({ data, productId, onPick }: { data: Recommendation[]; productId?: string; onPick: (id: string) => void }) {
  if (!data.length) return <Text style={s.empty}>{t('suggestionChips.placeAPieceAnd')}</Text>;
  return (
    <FlatList horizontal showsHorizontalScrollIndicator={false} data={data} keyExtractor={(r) => r.product.id}
      renderItem={({ item: r }) => {
        const on = r.product.id === productId;
        return (
          <Pressable accessibilityLabel={t('suggestions.select', { name: r.product.name, reason: r.reasons[0] })} onPress={() => onPick(r.product.id)} style={[s.card, on && s.on]}>
            <Text style={[s.name, on && { color: colors.accentInk }]} numberOfLines={1}>{r.product.name}</Text>
            <Text style={[s.why, on && { color: colors.accentInk }]} numberOfLines={2}>{sizeLabel(r.product)} · {r.reasons[0]}</Text>
          </Pressable>
        );
      }} />
  );
}

const s = StyleSheet.create({
  card: { width: 190, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line, marginRight: 8, backgroundColor: colors.surface },
  on: { backgroundColor: colors.accent, borderColor: colors.accent },
  name: { color: colors.ink, fontSize: 13 },
  why: { color: colors.muted, fontSize: 11, marginTop: 2 },
  empty: { color: colors.muted, paddingVertical: 8 },
});
