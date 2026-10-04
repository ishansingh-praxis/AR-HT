import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SAMPLE_ROOMS, getFurniture, useProducts } from '../data/furniture';
import { RoomPlan } from '../components/RoomPlan';
import { useSettings } from '../store/settingsStore';
import { colors, ROOM_LABEL } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

export default function RoomsScreen() {
  useProducts();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const { roomType, scanned } = useSettings();
  // Rooms of the user's chosen type first.
  const rooms = [...SAMPLE_ROOMS].sort((a, b) => Number(b.roomType === roomType) - Number(a.roomType === roomType));

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 14 }}
      data={rooms}
      keyExtractor={(r) => r.id}
      ListHeaderComponent={<Text style={s.intro}>Room designs curated from real HomeTown products, drawn to scale. Open one to try it in your own room.</Text>}
      renderItem={({ item: r }) => {
        const fits = scanned ? Math.max(r.roomCm.w, r.roomCm.d) <= Math.max(scanned.widthCm, scanned.depthCm) && Math.min(r.roomCm.w, r.roomCm.d) <= Math.min(scanned.widthCm, scanned.depthCm) : null;
        return (
          <Pressable style={s.card} onPress={() => nav.navigate('RoomDetail', { id: r.id })} accessibilityRole="button" accessibilityLabel={r.title}>
            <RoomPlan room={r} find={getFurniture} width={width - 28 - 24} />
            <Text style={s.title}>{r.title}</Text>
            <Text style={s.meta}>{ROOM_LABEL[r.roomType]} · {(r.roomCm.w / 100).toFixed(1)} × {(r.roomCm.d / 100).toFixed(1)} m · {r.pieces.length} pieces</Text>
            {fits !== null && <Text style={[s.badge, { color: fits ? colors.accent : colors.danger }]}>{fits ? 'Fits your scanned room' : 'Larger than your scanned room'}</Text>}
          </Pressable>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  intro: { color: colors.muted, marginBottom: 12, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 12, marginBottom: 14 },
  title: { color: colors.ink, fontWeight: '700', fontSize: 17, marginTop: 10 },
  meta: { color: colors.muted, marginTop: 3, fontSize: 13 },
  badge: { marginTop: 6, fontWeight: '600', fontSize: 13 },
});
