import { t } from '../i18n';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Logo } from '../components/ui';
import { ROOM_TYPES } from '../data/furniture';
import { useRooms } from '../store/roomStore';
import { useSettings } from '../store/settingsStore';
import { track } from '../services/events';
import { PRESET_AREA, type SizePreset } from '../utils/area';
import { colors, hero } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

const SIZES: { id: SizePreset; label: string }[] = [
  { id: 'small', label: t('welcome.sizeSmall', { area: PRESET_AREA.small ?? 0 }) },
  { id: 'medium', label: t('welcome.sizeMedium', { area: PRESET_AREA.medium ?? 0 }) },
  { id: 'large', label: t('welcome.sizeLarge', { area: PRESET_AREA.large ?? 0 }) },
  { id: 'unknown', label: "I'm not sure" },
];

export default function WelcomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Welcome'>) {
  const insets = useSafeAreaInsets();
  const { roomType, setRoomType } = useRooms();
  const preset0 = useSettings((s) => s.preset);
  const finish = useSettings((s) => s.finish);
  const arSupported = useSettings((s) => s.arSupported);
  const [size, setSize] = useState<SizePreset>(preset0);

  const go = (to: 'Tabs' | 'AR' | 'Plan') => {
    finish(size);
    track('onboarding_done', { room: roomType, size });
    if (to === 'AR') navigation.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'AR', params: { starter: true, mode: 'scan' } }] });
    else if (to === 'Plan') navigation.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'Plan' }] });
    else navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24, paddingHorizontal: 22 }}>
      <Logo size={52} light />
      <Text style={s.title}>{t('welcome.seeItInYour')}</Text>
      <Text style={s.sub}>{t('welcome.placeTrueToSize')}</Text>

      <Text style={s.h}>{t('welcome.whatAreYouDesigning')}</Text>
      <View style={s.wrap}>
        {ROOM_TYPES.map((r) => (
          <Pressable key={r} accessibilityRole="button" accessibilityLabel={r} accessibilityState={{ selected: r === roomType }} onPress={() => setRoomType(r)} style={[s.chip, r === roomType && s.chipOn]}>
            <Text style={[s.chipText, r === roomType && { color: colors.accentInk }]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.h}>{t('welcome.howBigIsIt')}</Text>
      <View style={s.wrap}>
        {SIZES.map((z) => (
          <Pressable key={z.id} accessibilityRole="button" accessibilityLabel={z.label} accessibilityState={{ selected: z.id === size }} onPress={() => setSize(z.id)} style={[s.chip, z.id === size && s.chipOn]}>
            <Text style={[s.chipText, z.id === size && { color: colors.accentInk }]}>{z.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.note}>{arSupported === false ? t('welcome.noAr') : t('welcome.scanNote')}</Text>

      <Button label={arSupported === false ? t('welcome.planRoom') : t('welcome.scanRoom')} onPress={() => go(arSupported === false ? 'Plan' : 'AR')} style={{ marginTop: 26 }} />
      <Button label={t('welcome.browseRooms')} variant="outline" onPress={() => go('Tabs')} style={{ marginTop: 10, borderColor: '#5E7570' }} />
      <Text style={s.fine}>{t('welcome.theCameraIsOnly')}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: hero },
  title: { color: '#fff', fontSize: 32, fontWeight: '700', marginTop: 20, lineHeight: 38 },
  sub: { color: '#C9D4D1', fontSize: 15, marginTop: 12, lineHeight: 22 },
  h: { color: '#fff', fontWeight: '700', fontSize: 16, marginTop: 26, marginBottom: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { minHeight: 44, justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#5E7570', marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: '#E7ECEA' },
  note: { color: '#9FB0AC', fontSize: 12, marginTop: 2 },
  fine: { color: '#9FB0AC', fontSize: 12, textAlign: 'center', marginTop: 18 },
});
