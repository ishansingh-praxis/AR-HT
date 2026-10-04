import { t } from '../i18n';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/ui';
import { RoomPlan } from '../components/RoomPlan';
import { ProductImage } from '../components/ProductImage';
import { getFurniture, sizeLabel, useProducts } from '../data/furniture';
import { request } from '../services/http';
import { useRooms } from '../store/roomStore';
import { useSettings } from '../store/settingsStore';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { SavedDesign } from '../types/furniture';

interface Shared { slug: string; name: string; roomType?: string; items: SavedDesign['items']; thumbnailUrl?: string; scan?: { widthCm: number; depthCm: number } }

/** Pieces keep their positions relative to each other; the first one becomes the origin so the layout can be placed around the aim dot. */
export function recentre(items: SavedDesign['items']): SavedDesign['items'] {
  const o = items[0]?.offset ?? [0, 0, 0];
  return items.map((i) => ({ ...i, offset: [i.offset[0] - o[0], i.offset[1] - o[1], i.offset[2] - o[2]] as [number, number, number] }));
}

/** Opened from a shared link (https://<domain>/d/<slug>): preview the plan, try it in your room, or save a copy. */
export default function SharedDesignScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'SharedDesign'>) {
  useProducts();
  const { width } = useWindowDimensions();
  const save = useRooms((r) => r.save);
  const noAR = useSettings((s) => s.arSupported === false);
  const [shared, setShared] = useState<Shared | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    request<Shared>(`/shared/${route.params.slug}`, { auth: false }).then((d) => { if (live) setShared(d); }).catch((e) => { if (live) setError(e instanceof Error ? e.message : t('shared.openFailed')); });
    return () => { live = false; };
  }, [route.params.slug]);

  if (error) return <View style={s.center}><Text style={s.p}>{error === 'This link is no longer available' ? t('shared.gone') : error}</Text></View>;
  if (!shared) return <View style={s.center}><ActivityIndicator color={colors.accent} accessibilityLabel={t('sharedDesign.loadingSharedDesign')} /></View>;

  const names = new Map<string, number>();
  for (const i of shared.items) names.set(i.productId, (names.get(i.productId) ?? 0) + 1);
  const items = recentre(shared.items);
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 14 }}>
      <Text style={s.title}>{shared.name}</Text>
      {shared.thumbnailUrl ? <Image accessibilityLabel={t('designs.photoOf', { name: shared.name })} source={{ uri: shared.thumbnailUrl }} style={s.photo} /> : null}
      <View style={s.card}><RoomPlan design={{ items: shared.items }} find={getFurniture} width={width - 28 - 20} scanCm={shared.scan ? { w: shared.scan.widthCm, d: shared.scan.depthCm } : undefined} /></View>
      {!noAR && <Button label={t('roomDetail.tryInMyRoom')} onPress={() => navigation.navigate('AR', { sharedItems: items })} style={{ marginTop: 14 }} />}
      <Button label={t('sharedDesign.saveACopy')} variant="outline" style={{ marginTop: 8 }} onPress={() => {
        save({ items: shared.items, frame: false, name: `${shared.name} (copy)` });
        Alert.alert(t('sharedDesign.saved'), t('sharedDesign.aCopyIsIn'));
      }} />
      <Text style={s.h}>{t('plan.pieces')}</Text>
      {[...names].map(([id, n]) => {
        const p = getFurniture(id);
        return p ? (
          <View key={id} style={s.row} accessible accessibilityLabel={`${p.name}${n > 1 ? `, ${n} pieces` : ''}, ${sizeLabel(p)}`}>
            <ProductImage uri={p.images[0]} blurhash={p.blurhash} style={s.img} />
            <View style={{ flex: 1, paddingLeft: 10 }}><Text style={s.name}>{p.name}{n > 1 ? ` × ${n}` : ''}</Text><Text style={s.meta}>{sizeLabel(p)}</Text></View>
          </View>
        ) : null;
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  p: { color: colors.muted, textAlign: 'center', lineHeight: 21 },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink, marginBottom: 10 },
  photo: { width: '100%', height: 200, borderRadius: 12, marginBottom: 10, backgroundColor: colors.line },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 10, alignItems: 'center' },
  h: { fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: 22, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 8, marginBottom: 8 },
  img: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.line },
  name: { color: colors.ink, fontWeight: '600' },
  meta: { color: colors.muted, marginTop: 2 },
});
