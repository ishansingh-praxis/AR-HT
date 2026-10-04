import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '../components/ui';
import { PRESET_AREA, SizePreset, useSettings } from '../store/settingsStore';
import { colors, ROOM_LABEL } from '../theme';
import type { RoomType } from '../types/furniture';
import type { RootStackParamList } from '../navigation/AppNavigator';

const ROOMS: RoomType[] = ['living', 'bedroom', 'dining', 'study'];
const SIZES: { id: SizePreset; label: string }[] = [
  { id: 'small', label: `Small · about ${PRESET_AREA.small} m²` }, { id: 'medium', label: `Medium · about ${PRESET_AREA.medium} m²` },
  { id: 'large', label: `Large · about ${PRESET_AREA.large} m²` }, { id: 'unknown', label: "I'm not sure" },
];

export default function WelcomeScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { roomType: r0, preset: p0, finish } = useSettings();
  const [room, setRoom] = useState<RoomType>(r0);
  const [size, setSize] = useState<SizePreset>(p0);

  const go = (to: 'Tabs' | 'AR') => {
    finish(room, size);
    if (to === 'AR') nav.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'AR', params: { mode: 'scan' } }] });
    else nav.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24, paddingHorizontal: 22 }}>
      <Text style={s.kicker}>FurniAR</Text>
      <Text style={s.title}>See furniture in your room before you decide.</Text>
      <Text style={s.sub}>Scan your room with the camera, try curated room designs built from the HomeTown catalogue, and get suggestions that fit your space.</Text>

      <Text style={s.h}>Which room are you designing?</Text>
      <View style={s.wrap}>
        {ROOMS.map((r) => (
          <Pressable key={r} onPress={() => setRoom(r)} style={[s.card, room === r && s.cardOn]} accessibilityRole="button" accessibilityState={{ selected: room === r }}>
            <Text style={[s.cardText, room === r && { color: colors.accentInk }]}>{ROOM_LABEL[r]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.h}>How big is it?</Text>
      <View style={s.wrap}>
        {SIZES.map((z) => (
          <Pressable key={z.id} onPress={() => setSize(z.id)} style={[s.chip, size === z.id && s.cardOn]} accessibilityRole="button" accessibilityState={{ selected: size === z.id }}>
            <Text style={[s.chipText, size === z.id && { color: colors.accentInk }]}>{z.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.note}>A camera scan replaces this guess with measured numbers.</Text>

      <Button label="Scan my room" onPress={() => go('AR')} style={{ marginTop: 26 }} />
      <Button label="Browse sample rooms" variant="outline" onPress={() => go('Tabs')} style={{ marginTop: 10 }} />
      <Text style={s.fine}>The camera is only used on your phone to measure and place furniture. Camera images are never uploaded.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  kicker: { color: colors.accent, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', fontSize: 12 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800', color: colors.ink, marginTop: 10 },
  sub: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 12 },
  h: { color: colors.ink, fontWeight: '700', fontSize: 16, marginTop: 28, marginBottom: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, marginRight: 8, marginBottom: 8 },
  cardOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  cardText: { color: colors.ink, fontWeight: '600' },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, marginRight: 8, marginBottom: 8 },
  chipText: { color: colors.ink, fontSize: 13 },
  note: { color: colors.muted, fontSize: 12, marginTop: 2 },
  fine: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 18 },
});
