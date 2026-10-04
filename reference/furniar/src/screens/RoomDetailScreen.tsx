import React from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { cm, getFurniture, getRoom, useProducts } from '../data/furniture';
import { RoomPlan } from '../components/RoomPlan';
import { Button } from '../components/ui';
import { colors, formatPrice, ROOM_LABEL } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

export default function RoomDetailScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'RoomDetail'>) {
  useProducts();
  const { width } = useWindowDimensions();
  const room = getRoom(route.params.id);
  if (!room) return <Text style={{ padding: 20 }}>Room not found.</Text>;

  // Group repeated pieces and work out how many sets to buy (e.g. 6 chairs sold as sets of 2 = 3 sets).
  const lines = [...room.pieces.reduce((m, p) => m.set(p.productId, (m.get(p.productId) ?? 0) + 1), new Map<string, number>())]
    .flatMap(([id, n]) => { const p = getFurniture(id); return p ? [{ p, n }] : []; });
  const total = lines.reduce((sum, { p, n }) => sum + (p.priceInr ?? 0) * Math.ceil(n / (p.setSize ?? 1)), 0);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <RoomPlan room={room} find={getFurniture} width={width - 32} />
      <Text style={s.title}>{room.title}</Text>
      <Text style={s.meta}>{ROOM_LABEL[room.roomType]} · {(room.roomCm.w / 100).toFixed(1)} × {(room.roomCm.d / 100).toFixed(1)} m</Text>
      <Text style={s.text}>{room.blurb}</Text>
      {room.notes ? <Text style={s.note}>Note: {room.notes}</Text> : null}
      <Button label="Try in my room (AR)" onPress={() => navigation.navigate('AR', { roomId: room.id })} style={{ marginTop: 14 }} />
      <Button label="Scan my room first" variant="outline" onPress={() => navigation.navigate('AR', { roomId: room.id, mode: 'scan' })} style={{ marginTop: 8 }} />
      <Text style={s.h}>In this design</Text>
      {lines.map(({ p, n }) => (
        <View key={p.id} style={s.row}>
          <Image source={{ uri: p.images[0] }} style={s.img} />
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={2}>{p.name}</Text>
            <Text style={s.meta}>{cm(p)}{p.dimsConfidence === 'low' ? ' (check size)' : ''}</Text>
            <Text style={s.meta}>
              {n > 1 ? `${n} used` : '1 used'}{p.setSize ? ` · sold as a set of ${p.setSize} (${Math.ceil(n / p.setSize)} set${Math.ceil(n / p.setSize) > 1 ? 's' : ''})` : ''}
              {p.priceInr ? ` · ${formatPrice(p.priceInr)}` : ''}
            </Text>
          </View>
          <Button label="View" variant="outline" onPress={() => navigation.navigate('Product', { id: p.id })} />
        </View>
      ))}
      {total > 0 && <Text style={s.total}>Reference total {formatPrice(total)}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: colors.ink, marginTop: 14 },
  meta: { color: colors.muted, marginTop: 3, fontSize: 13 },
  text: { color: colors.ink, marginTop: 10, lineHeight: 21 },
  note: { color: colors.warn, marginTop: 8, fontSize: 13 },
  h: { color: colors.ink, fontWeight: '700', fontSize: 16, marginTop: 22, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 10, marginBottom: 8 },
  img: { width: 56, height: 56, borderRadius: 8, marginRight: 10, backgroundColor: colors.line },
  name: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  total: { color: colors.ink, fontWeight: '700', marginTop: 8 },
});
