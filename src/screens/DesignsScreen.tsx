import { t } from '../i18n';
import React, { useState } from 'react';
import { Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, HeartButton } from '../components/ui';
import { useWishlist } from '../store/wishlistStore';
import { useProducts, sizeLabel , getFurniture, usePlaceable } from '../data/furniture';

import { useRooms } from '../store/roomStore';
import { ROOMS, ROOM_ID_PREFIX, roomToDesign } from '../data/rooms';
import { useAuthStatus } from '../store/authStore';
import { useSettings } from '../store/settingsStore';
import { useSync } from '../store/syncStore';
import { runSync } from '../services/sync';
import { VerifyBanner } from '../components/AccountSection';
import { RoomPlan } from '../components/RoomPlan';
import { ProductImage } from '../components/ProductImage';
import { shareDesign } from '../services/share';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

export default function DesignsScreen() {
  usePlaceable();
  useProducts();
  const wish = useWishlist((w) => w.items);
  const toggleWish = useWishlist((w) => w.toggle);
  const { designs: mine, rename, remove } = useRooms();
  const outbox = useSync((o) => o.outbox);
  const status = useAuthStatus();
  const noAR = useSettings((st) => st.arSupported === false);
  const [refreshing, setRefreshing] = useState(false);
  const cloudState = (id: string): 'synced' | 'pending' | 'local' => {
    if (status !== 'signedIn') return 'local';
    const d = mine.find((m) => m.id === id);
    return d?.cloudId && !outbox.some((o) => 'id' in o && o.id === id) ? 'synced' : 'pending';
  };
  const designs = [...mine, ...ROOMS.map(roomToDesign)];
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const { width } = useWindowDimensions();
  const share = (id: string) => {
    const d = designs.find((x) => x.id === id);
    if (d) shareDesign(d as never);
  };
  const pictureOf = (d: (typeof designs)[number]) => ('thumbnailUri' in d ? (d.thumbnailUri ?? d.thumbnailUrl) : undefined);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={designs}
      keyExtractor={(d) => d.id}
      contentContainerStyle={{ padding: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await runSync(); setRefreshing(false); }} />}
      ListHeaderComponent={<View><VerifyBanner /><Text style={s.section}>{t('designs.myDesignsAndSample')}</Text></View>}
      ListEmptyComponent={<Text style={s.empty}>{t('designs.noSavedDesignsYet')}</Text>}
      ListFooterComponent={
        <View>
          <Text style={s.section}>{t('designs.savedFurniture')}</Text>
          {wish.length === 0 ? <Text style={s.empty2}>{t('designs.tapTheHeartOn')}</Text> : null}
          {wish.map((w) => {
            const p = getFurniture(w.id);
            if (!p) return null;
            return (
              <Pressable key={w.id} accessibilityRole="button" accessibilityLabel={t('designs.open', { name: p.name })} onPress={() => nav.navigate('Item', { id: p.id })} style={s.wish}>
                <ProductImage uri={p.images[0]} blurhash={p.blurhash} style={s.wishImg} />
                <View style={{ flex: 1, paddingHorizontal: 10 }}>
                  <Text style={s.name} numberOfLines={2}>{p.name}</Text>
                  <Text style={s.meta}>{sizeLabel(p)}</Text>
                </View>
                <HeartButton saved size={18} onPress={() => toggleWish(p.id)} />
              </Pressable>
            );
          })}
        </View>
      }
      renderItem={({ item: d }) => (
        <View style={s.card}>
          {pictureOf(d) ? (
            <Image accessibilityLabel={t('designs.photoOf', { name: d.name })} source={{ uri: pictureOf(d) }} style={s.thumb} resizeMode="cover" />
          ) : d.items.length > 0 ? (
            <View style={s.planBox}><RoomPlan design={d} find={getFurniture} width={width - 28 - 28 - 20} /></View>
          ) : null}
          {editing === d.id ? (
            <TextInput accessibilityLabel={t('designs.designName')} autoFocus value={draft} onChangeText={setDraft} style={s.input}
              onSubmitEditing={() => { rename(d.id, draft); setEditing(null); }} onBlur={() => setEditing(null)} />
          ) : (
            <View style={s.titleRow}>
              <Text style={[s.name, { flex: 1 }]}>{d.name}</Text>
              {!d.id.startsWith(ROOM_ID_PREFIX) && <CloudBadge state={cloudState(d.id)} />}
            </View>
          )}
          <Text style={s.meta}>{d.items.length} pieces · {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'curated by HomeTown'}</Text>
          <View style={s.row}>
            {!noAR && <Button label={t('designs.ar')} onPress={() => nav.navigate('AR', { designId: d.id })} style={s.flex} />}
            <Button label={t('designs.plan')} variant={noAR ? 'solid' : 'outline'} onPress={() => nav.navigate('Plan', { designId: d.id })} style={s.flex} />
            {!d.id.startsWith(ROOM_ID_PREFIX) && <Button label={t('designs.rename')} variant="outline" onPress={() => { setDraft(d.name); setEditing(d.id); }} style={s.flex} />}
          </View>
          <View style={s.row}>
            <Button label={t('designs.share')} variant="outline" onPress={() => share(d.id)} style={s.flex} />
            {!d.id.startsWith(ROOM_ID_PREFIX) && <Button label={t('designs.delete')} variant="danger" style={s.flex}
              onPress={() => Alert.alert(t('designs.deleteDesign'), d.name, [{ text: t('common.cancel') }, { text: t('designs.delete'), style: 'destructive', onPress: () => remove(d.id) }])} />}
          </View>
        </View>
      )}
    />
  );
}

const BADGE = { synced: ['☁ ✓', 'designs.synced'], pending: ['☁ …', 'designs.pending'], local: ['📱', 'designs.local'] } as const;
function CloudBadge({ state }: { state: keyof typeof BADGE }) {
  return <Text accessibilityLabel={t(BADGE[state][1])} style={s.badge}>{BADGE[state][0]}</Text>;
}

const s = StyleSheet.create({
  thumb: { width: '100%', height: 150, borderRadius: 10, marginBottom: 10, backgroundColor: colors.line },
  planBox: { backgroundColor: colors.bg, borderRadius: 10, padding: 10, marginBottom: 10, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  badge: { color: colors.muted, fontSize: 13, marginLeft: 8 },
  section: { fontSize: 17, fontWeight: '700', color: colors.ink, marginVertical: 8 },
  empty2: { color: colors.muted, marginBottom: 12 },
  wish: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 8, marginBottom: 8 },
  wishImg: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.line },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 60 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 12 },
  name: { fontSize: 17, fontWeight: '700', color: colors.ink },
  input: { fontSize: 17, borderBottomWidth: 1, borderColor: colors.accent, color: colors.ink, paddingVertical: 2 },
  meta: { color: colors.muted, marginTop: 4, marginBottom: 10 },
  row: { flexDirection: 'row', marginTop: 8 },
  flex: { flex: 1, marginHorizontal: 3 },
});
