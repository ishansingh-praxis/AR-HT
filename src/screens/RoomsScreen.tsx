import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RoomPlan } from '../components/RoomPlan';
import { getFurniture, useProducts } from '../data/furniture';
import { fitsScanned, roomAreaM2, ROOMS, toRoomType } from '../data/rooms';
import { useRooms } from '../store/roomStore';
import { useSettings } from '../store/settingsStore';
import { KINDS } from '../studio/studio';
import { colors } from '../theme';
import { ROOM_LABEL, type RoomType } from '../types/furniture';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { t } from '../i18n';

const TYPES: RoomType[] = ['living', 'bedroom', 'dining', 'study'];

/** Rooms tab: pick a kind of room to design with a matching set and a budget, or browse the finished sample rooms below. */
export default function RoomsScreen() {
  useProducts(); // re-render when the catalogue updates
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const mine = toRoomType(useRooms((r) => r.roomType));
  const scan = useSettings((s) => s.scanned);
  const [type, setType] = useState<RoomType | null>(null);
  // The user's own room type first.
  const order = useMemo(() => [mine, ...TYPES.filter((tp) => tp !== mine)], [mine]);
  const data = useMemo(
    () => ROOMS.filter((r) => !type || r.roomType === type).sort((a, b) => order.indexOf(a.roomType) - order.indexOf(b.roomType)),
    [type, order],
  );
  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={data}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: 14 }}
      ListHeaderComponent={
        <View>
          <Text style={s.h} accessibilityRole="header">{t('rooms.designARoom')}</Text>
          <Text style={s.sub}>{t('rooms.designSub')}</Text>
          <View style={s.grid}>
            {KINDS.map((k) => (
              <Pressable key={k.id} accessibilityRole="button" accessibilityLabel={t('rooms.designKind', { room: t(`kinds.${k.id}`) })} onPress={() => nav.navigate('RoomStudio', { kind: k.id })} style={s.kind}>
                <Text style={s.kindIcon} accessibilityElementsHidden importantForAccessibility="no">{k.icon}</Text>
                <Text style={s.kindName}>{t(`kinds.${k.id}`)}</Text>
                <Text style={s.kindMeta} numberOfLines={2}>{t(`kinds.${k.id}Blurb`)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[s.h, { marginTop: 18 }]} accessibilityRole="header">{t('rooms.sampleRooms')}</Text>
          <View style={s.chips}>
            {[null, ...order].map((tp) => (
              <Pressable key={tp ?? 'all'} accessibilityRole="button" accessibilityState={{ selected: type === tp }} accessibilityLabel={t('rooms.showType', { type: tp ? ROOM_LABEL[tp] : t('picker.all') })} onPress={() => setType(tp)} style={[s.chip, type === tp && s.chipOn]}>
                <Text style={[s.chipText, type === tp && { color: colors.accentInk }]}>{tp ? ROOM_LABEL[tp] : t('picker.all')}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      renderItem={({ item: r }) => (
        <Pressable accessibilityLabel={t('designs.open', { name: r.title })} onPress={() => nav.navigate('RoomDetail', { id: r.id })} style={s.card}>
          <RoomPlan room={r} find={getFurniture} width={300} />
          <Text style={s.name}>{r.title}</Text>
          <Text style={s.meta}>{(r.roomCm.w / 100).toFixed(1)} × {(r.roomCm.d / 100).toFixed(1)} m · {roomAreaM2(r).toFixed(0)} m² · {r.pieces.length} pieces</Text>
          {scan ? (
            <Text style={[s.badge, { color: fitsScanned(r, scan) ? colors.accent : colors.danger }]}>
              {fitsScanned(r, scan) ? t('rooms.fits') : t('rooms.larger')}
            </Text>
          ) : null}
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  h: { fontSize: 20, fontWeight: '800', color: colors.ink },
  sub: { color: colors.muted, marginTop: 2, marginBottom: 10, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  kind: { width: '48.5%', backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, minHeight: 130 },
  kindIcon: { fontSize: 34 },
  kindName: { color: colors.ink, fontWeight: '800', fontSize: 16, marginTop: 6 },
  kindMeta: { color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginBottom: 10 },
  chip: { minHeight: 44, justifyContent: 'center', paddingVertical: 7, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: colors.line, marginRight: 8, marginBottom: 8, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.ink },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 12, alignItems: 'center' },
  name: { fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: 10, alignSelf: 'flex-start' },
  meta: { color: colors.muted, marginTop: 2, alignSelf: 'flex-start' },
  badge: { marginTop: 6, fontWeight: '600', alignSelf: 'flex-start' },
});
