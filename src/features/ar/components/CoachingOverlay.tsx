import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { t } from '../../../i18n';

export function CoachingOverlay({ lost }: { lost: boolean }) {
  return (
    <View pointerEvents="none" style={s.coach} accessibilityLiveRegion="polite">
      <Text style={s.title}>{lost ? t('coaching.lost') : t('coaching.scanFloor')}</Text>
      <Text style={s.text}>{t('coachingOverlay.moveThePhoneSlowly')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  coach: { position: 'absolute', top: '32%', left: 30, right: 30, backgroundColor: 'rgba(20,33,31,0.8)', borderRadius: 16, padding: 18, alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  text: { color: '#D5DEDB', textAlign: 'center', marginTop: 6 },
});
