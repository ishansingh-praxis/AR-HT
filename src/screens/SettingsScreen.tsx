import { t } from '../i18n';
import React from 'react';
import { Linking, ScrollView, Switch, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui';
import { useSettings } from '../store/settingsStore';
import { AccountSection } from '../components/AccountSection';
import { clearEvents } from '../services/events';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

export default function SettingsScreen() {
  const { quality, setQuality, qualityAuto, shareUsage, setShareUsage, backupPhotos, setBackupPhotos } = useSettings();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={s.h}>{t('settings.arQuality')}</Text>
      <Text style={s.p}>High turns on shadows and depth occlusion where your phone supports it. If AR feels slow or hot, use Standard.{qualityAuto ? ` ${t('settings.autoChose', { quality: quality === 'high' ? t('settings.high') : t('settings.standard') })}` : ''}</Text>
      <View style={s.row}>
        <Button label={t('settings.standard')} variant={quality === 'standard' ? 'solid' : 'outline'} onPress={() => setQuality('standard')} style={s.flex} />
        <Button label={t('settings.high')} variant={quality === 'high' ? 'solid' : 'outline'} onPress={() => setQuality('high')} style={s.flex} />
      </View>

      <Text style={s.h}>{t('settings.yourRoom')}</Text>
      <Text style={s.p}>{t('settings.changeTheRoomType')}</Text>
      <Button label={t('settings.changeRoom')} variant="outline" onPress={() => nav.navigate('Welcome')} />

      <Text style={s.h}>{t('settings.cameraHelp')}</Text>
      <Text style={s.p}>
        {'• Allow camera access, or AR cannot start.\n• Use a well-lit room.\n• Point at the floor and move slowly side to side.\n• Plain, glossy floors are hard to track: aim near a rug or the floor edge.'}
      </Text>
      <Button label={t('settings.openPhoneSettings')} variant="outline" onPress={() => Linking.openSettings()} />

      <AccountSection />
      <View style={[s.row, { alignItems: 'center', marginTop: 12 }]}>
        <Text style={[s.p, { flex: 1, marginBottom: 0 }]}>{t('settings.backupPhotos')}</Text>
        <Switch accessibilityLabel={t('settings.backupPhotosLabel')} value={backupPhotos} onValueChange={setBackupPhotos} />
      </View>

      <Text style={s.h}>{t('settings.usageData')}</Text>
      <View style={[s.row, { alignItems: 'center' }]}>
        <Text style={[s.p, { flex: 1, marginBottom: 0 }]}>{t('settings.shareAnonymousUsageWhich')}</Text>
        <Switch accessibilityLabel={t('settings.shareAnonymousUsage')} value={shareUsage} onValueChange={(on) => { setShareUsage(on); if (!on) clearEvents(); }} />
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  h: { fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: 22, marginBottom: 6 },
  p: { color: colors.muted, lineHeight: 20, marginBottom: 12 },
  row: { flexDirection: 'row' },
  flex: { flex: 1, marginHorizontal: 3 },
});
