import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlatList } from 'react-native';
import { ProductCard } from '../../components/ProductCard';
import { ProductPicker } from '../ar/components/ProductPicker';
import { getTheme, themeScore, type Kind } from '../../studio/studio';
import { colors } from '../../theme';
import { t } from '../../i18n';
import type { Product } from '../../types/furniture';

/** "Add furniture": photo cards for pieces that suit this room and theme first, then everything. Tapping a card adds one piece to the room. */
export function AddPicker({ kind, themeId, catalogue, onAdd }: { kind: Kind; themeId: string; catalogue: Product[]; onAdd: (p: Product) => void }) {
  const [tab, setTab] = useState<'room' | 'all'>('room');
  const forRoom = useMemo(() => {
    const th = getTheme(themeId);
    return catalogue.filter((p) => !p.sizeReview && !p.demo && kind.slots.some((sl) => sl.match(p))).sort((a, b) => themeScore(b, th) - themeScore(a, th) || a.id.localeCompare(b.id)).slice(0, 40);
  }, [catalogue, kind, themeId]);
  return (
    <View style={s.box}>
      <View style={s.tabs}>
        {(['room', 'all'] as const).map((k) => (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)} style={[s.tab, tab === k && s.on]}>
            <Text style={[s.tabText, tab === k && { color: colors.accentInk }]}>{k === 'room' ? t('studio.forThisRoom') : t('studio.allFurniture')}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'room' ? (
        <FlatList horizontal showsHorizontalScrollIndicator={false} data={forRoom} keyExtractor={(p) => p.id} style={{ height: 180 }}
          renderItem={({ item }) => <ProductCard product={item} width={140} label={t('studio.addProduct', { name: item.name })} onPress={() => onAdd(item)} />} />
      ) : (
        <ProductPicker products={catalogue} onPick={(id) => { const p = catalogue.find((x) => x.id === id); if (p) onAdd(p); }} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderRadius: 14, padding: 12, marginTop: 10 },
  tabs: { flexDirection: 'row', marginBottom: 10 },
  tab: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, marginRight: 8, borderWidth: 1, borderColor: colors.line },
  on: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.ink, fontWeight: '600', fontSize: 13 },
});
