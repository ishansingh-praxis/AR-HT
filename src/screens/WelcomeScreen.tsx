import { t } from '../i18n';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Logo } from '../components/ui';
import { useSettings } from '../store/settingsStore';
import { track } from '../services/events';
import { hero } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

export default function WelcomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Welcome'>) {
  const insets = useSafeAreaInsets();
  const finish = useSettings((s) => s.finish);
  const arSupported = useSettings((s) => s.arSupported);

  const go = (to: 'Tabs' | 'AR' | 'Plan') => {
    finish('unknown');
    track('onboarding_done', {});
    if (to === 'AR') navigation.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'AR', params: { starter: true, mode: 'scan' } }] });
    else if (to === 'Plan') navigation.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'Plan' }] });
    else navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24, paddingHorizontal: 22 }}>
      <Logo size={52} light />
      <Text style={s.title}>{t('welcome.seeItInYour')}</Text>
      <Text style={s.sub}>{t('welcome.placeTrueToSize')}</Text>

      <Text style={s.note}>{arSupported === false ? t('welcome.noAr') : t('welcome.scanNote')}</Text>

      <Button label={t('welcome.browseRooms')} onPress={() => go('Tabs')} style={{ marginTop: 30 }} />
      <Button label={arSupported === false ? t('welcome.planRoom') : t('welcome.scanRoom')} variant="outline" onPress={() => go(arSupported === false ? 'Plan' : 'AR')} style={{ marginTop: 10, borderColor: '#5E7570' }} />
      <Text style={s.fine}>{t('welcome.theCameraIsOnly')}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: hero },
  title: { color: '#fff', fontSize: 32, fontWeight: '700', marginTop: 20, lineHeight: 38 },
  sub: { color: '#C9D4D1', fontSize: 15, marginTop: 12, lineHeight: 22 },
  note: { color: '#9FB0AC', fontSize: 12, marginTop: 2 },
  fine: { color: '#9FB0AC', fontSize: 12, textAlign: 'center', marginTop: 18 },
});
