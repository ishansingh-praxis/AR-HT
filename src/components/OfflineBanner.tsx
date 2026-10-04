import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { t } from '../i18n';

/** Thin banner shown while the phone has no internet. The catalogue, rooms and saved designs keep working; syncing waits. */
export function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetInfo();
  if (isConnected !== false && isInternetReachable !== false) return null;
  return (
    <View style={s.bar} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={s.text}>{t('offlineBanner.youAreOfflineEverything')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { backgroundColor: '#5B4A1E', paddingVertical: 6, paddingHorizontal: 12 },
  text: { color: '#FFF4D6', fontSize: 12 },
});
