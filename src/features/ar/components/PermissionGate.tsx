import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/ui';
import { colors } from '../../../theme';
import { t } from '../../../i18n';

/** Shown while the camera permission is being asked, or when it was denied. */
export function PermissionGate({ state, top, onBack }: { state: 'checking' | 'denied'; top: number; onBack: () => void }) {
  return (
    <View style={[s.gate, { paddingTop: top }]}>
      <Text style={s.title}>{state === 'checking' ? t('permissionGate.starting') : t('permissionGate.needed')}</Text>
      {state === 'denied' && (
        <>
          <Text style={s.text}>{t('permissionGate.hometownUsesTheCamera')}</Text>
          <Button label={t('permissionGate.openSettings')} onPress={() => Linking.openSettings()} />
          <Button label={t('permissionGate.back')} variant="outline" onPress={onBack} style={{ marginTop: 10 }} />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  gate: { flex: 1, backgroundColor: colors.bg, padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink, marginBottom: 10 },
  text: { color: colors.muted, lineHeight: 21, marginBottom: 20 },
});
