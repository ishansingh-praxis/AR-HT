import { t } from '../i18n';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { sizeLabel, useCategories, useProducts } from '../data/furniture';
import { useRooms } from '../store/roomStore';
import { recommend } from '../recommend/engine';
import { HeartButton } from '../components/ui';
import { ProductImage } from '../components/ProductImage';
import { useWishlist } from '../store/wishlistStore';
import { isSaved } from '../utils/wishlist';
import { track } from '../services/events';
import { toRoomType } from '../data/rooms';
import { colors } from '../theme';
import { SHOW_DEMO } from '../config';
import type { RootStackParamList } from '../navigation/AppNavigator';

export default function LibraryScreen() {
  const all = useProducts();
  const items = useMemo(() => all.filter((p) => SHOW_DEMO || !p.demo), [all]);
  const categories = useCategories();
  const roomType = useRooms((r) => r.roomType);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const starters = useMemo(() => recommend(items, { roomType: toRoomType(roomType), placed: [], maxResults: 8 }), [items, roomType]);
  const wish = useWishlist((w) => w.items);
  const toggleWish = useWishlist((w) => w.toggle);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [arOnly, setArOnly] = useState(false);
  const data = useMemo(
    () => items.filter((f) => (!cat || f.category === cat) && (!arOnly || !!f.model3D || !!f.proxy) && f.name.toLowerCase().includes(q.trim().toLowerCase())),
    [items, q, cat, arOnly]
  );
  return (
    <FlashList
      style={{ backgroundColor: colors.bg }}
      data={data}
      numColumns={2}
      keyExtractor={(f) => f.id}
      contentContainerStyle={{ padding: 10 }}
      ListHeaderComponent={
        <View>
          <Text style={s.room}>Designing: {roomType}</Text>
          {starters.length > 0 && !q && !cat && (
            <View>
              <Text style={s.startTitle}>Good starting pieces for your {roomType.toLowerCase()}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {starters.map((r) => (
                  <Pressable key={r.product.id} accessibilityLabel={`${r.product.name}. ${r.reasons[0]}`} style={s.startCard} onPress={() => nav.navigate('Item', { id: r.product.id })}>
                    <ProductImage uri={r.product.images[0]} blurhash={r.product.blurhash} style={s.startImg} />
                    <Text style={s.startName} numberOfLines={2}>{r.product.name}</Text>
                    <Text style={s.size}>{sizeLabel(r.product)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          <TextInput value={q} onChangeText={setQ} placeholder={t('library.searchFurniture')} accessibilityLabel={t('library.searchFurniture')} placeholderTextColor={colors.muted} style={s.search} />
          <View style={s.chips}>
            {[null, ...categories].map((c) => (
              <Pressable key={c ?? 'all'} accessibilityRole="button" accessibilityLabel={t('picker.category', { name: c ?? t('picker.all') })} accessibilityState={{ selected: cat === c }} onPress={() => setCat(c)} style={[s.chip, cat === c && s.chipOn]}>
                <Text style={[s.chipText, cat === c && { color: colors.accentInk }]}>{c ?? t('picker.all')}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel={t('library.showOnlyArReady')} accessibilityState={{ selected: arOnly }} onPress={() => setArOnly(!arOnly)} style={[s.chip, arOnly && s.chipOn]}>
              <Text style={[s.chipText, arOnly && { color: colors.accentInk }]}>{t('library.arReady')}</Text>
            </Pressable>
          </View>
          <Text style={s.count}>{data.length} pieces</Text>
        </View>
      }
      ListEmptyComponent={<Text style={s.empty}>{t('library.noFurnitureMatchesClear')}</Text>}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, ${sizeLabel(item)}`} style={s.card} onPress={() => nav.navigate('Item', { id: item.id })}>
          <ProductImage uri={item.images[0]} blurhash={item.blurhash} style={s.img} />
          <View style={s.heart}><HeartButton size={18} saved={isSaved(wish, item.id)} onPress={() => { if (toggleWish(item.id)) track('wishlist_added', { id: item.id }); }} /></View>
          <Text style={s.name} numberOfLines={2}>{item.name}</Text>
          <Text style={s.size}>{sizeLabel(item)}</Text>
          <Text style={[s.badge, (item.model3D || item.proxy) && { color: colors.accent }]}>{item.demo ? t('library.badgeDemo') : item.model3D ? t('library.badgeReady') : item.proxy ? t('library.badgeShape') : t('library.badgeReview')}</Text>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  room: { color: colors.muted, margin: 8 },
  startTitle: { color: colors.ink, fontWeight: '700', margin: 8 },
  startCard: { width: 140, marginRight: 10, marginLeft: 6, backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden' },
  startImg: { width: '100%', height: 90, backgroundColor: colors.line },
  startName: { color: colors.ink, fontWeight: '600', padding: 8, paddingBottom: 2, fontSize: 12 },
  search: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: colors.ink, margin: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { minHeight: 44, justifyContent: 'center', paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.line, margin: 4, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.ink, fontSize: 13 },
  count: { color: colors.muted, margin: 8, fontSize: 12 },
  badge: { color: colors.muted, fontSize: 11, paddingHorizontal: 10, paddingBottom: 10, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  card: { flex: 1, margin: 6, backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden' },
  heart: { position: 'absolute', top: 6, right: 6 },
  img: { width: '100%', height: 130, backgroundColor: colors.line },
  name: { color: colors.ink, fontWeight: '600', padding: 10, paddingBottom: 2 },
  size: { color: colors.muted, fontSize: 12, paddingHorizontal: 10, paddingBottom: 10 },
});
