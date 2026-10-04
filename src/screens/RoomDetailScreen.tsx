import { t } from '../i18n';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/ui';
import { RoomPlan } from '../components/RoomPlan';
import { getFurniture, sizeLabel, useProducts } from '../data/furniture';
import { fitsScanned, getRoom, ROOM_ID_PREFIX, roomAreaM2, roomProducts } from '../data/rooms';
import { useSettings } from '../store/settingsStore';
import { SHOW_PRICES } from '../config';
import { formatPrice, colors } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

export default function RoomDetailScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'RoomDetail'>) {
  useProducts();
  const { width } = useWindowDimensions();
  const scan = useSettings((s) => s.scanned);
  const noAR = useSettings((s) => s.arSupported === false);
  const room = getRoom(route.params.id);
  if (!room) return <Text style={s.p}>{t('roomDetail.thisRoomIsNo')}</Text>;
  const list = roomProducts(room, getFurniture);
  const total = SHOW_PRICES ? list.reduce((sum, l) => sum + (l.product.priceInr ?? 0) * (l.sets ?? l.pieces), 0) : 0;
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 14 }}>
      <View style={s.card}>
        <RoomPlan room={room} find={getFurniture} width={width - 56} />
      </View>
      <Text style={s.title}>{room.title}</Text>
      <Text style={s.meta}>{(room.roomCm.w / 100).toFixed(1)} × {(room.roomCm.d / 100).toFixed(1)} m · {roomAreaM2(room).toFixed(0)} m²</Text>
      {scan ? (
        <Text style={[s.meta, { color: fitsScanned(room, scan) ? colors.accent : colors.danger, fontWeight: '600' }]}>
          {fitsScanned(room, scan) ? t('rooms.fits') : t('rooms.largerScanned')}
        </Text>
      ) : null}
      <Text style={s.p}>{room.blurb}</Text>
      {room.notes ? <Text style={[s.p, { color: colors.muted }]}>{room.notes}</Text> : null}

      <Button label={t('roomDetail.tryInMyRoom')} onPress={() => (noAR ? navigation.navigate('Plan', { designId: ROOM_ID_PREFIX + room.id }) : navigation.navigate('AR', { designId: ROOM_ID_PREFIX + room.id }))} style={{ marginTop: 14 }} />

      <Text style={s.h}>{t('roomDetail.piecesInThisRoom')}</Text>
      {list.map(({ product, pieces, sets }) => (
        <Pressable key={product.id} accessibilityRole="button" accessibilityLabel={t('designs.open', { name: product.name })} style={s.row} onPress={() => navigation.navigate('Item', { id: product.id })}>
          <Text style={s.item}>{product.name}</Text>
          <Text style={s.meta}>
            {sizeLabel(product)}
            {product.setSize ? ` · sold in sets of ${product.setSize}: ${pieces} piece${pieces > 1 ? 's' : ''} = ${sets} set${sets! > 1 ? 's' : ''}` : pieces > 1 ? ` · ${pieces} pieces` : ''}
          </Text>
        </Pressable>
      ))}
      {SHOW_PRICES && total > 0 ? <Text style={s.p}>Reference price for the room: {formatPrice(total)}</Text> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink, marginTop: 14 },
  meta: { color: colors.muted, marginTop: 2 },
  p: { color: colors.ink, marginTop: 10, lineHeight: 21 },
  h: { fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: 22, marginBottom: 6 },
  row: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginBottom: 8 },
  item: { color: colors.ink, fontWeight: '600' },
});
