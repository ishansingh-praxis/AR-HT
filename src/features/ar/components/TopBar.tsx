import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme';
import { t } from '../../../i18n';

function Pill({ label, a11y, onPress, disabled, danger, first }: { label: string; a11y?: string; onPress: () => void; disabled?: boolean; danger?: boolean; first?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y ?? label} onPress={onPress} disabled={disabled}
      style={[s.pill, !first && { marginLeft: 8 }, disabled && { opacity: 0.4 }, danger && { backgroundColor: colors.danger }]}>
      <Text style={s.text}>{label}</Text>
    </Pressable>
  );
}

export function TopBar({ onClose, onUndo, onRedo, canUndo, canRedo, recording, onToggleVideo, onHelp }: {
  onHelp: () => void; onClose: () => void; onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean; recording: boolean; onToggleVideo: () => void;
}) {
  return (
    <View style={s.row}>
      <Pill first label={t('topBar.close')} onPress={onClose} />
      <Pill label={t('plan.undo')} onPress={onUndo} disabled={!canUndo} />
      <Pill label={t('plan.redo')} onPress={onRedo} disabled={!canRedo} />
      <Pill label={recording ? t('topBar.stop') : t('topBar.record')} onPress={onToggleVideo} danger={recording} />
      <Pill label="?" a11y={t('hint.help')} onPress={onHelp} />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row' },
  pill: { backgroundColor: 'rgba(20,33,31,0.75)', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, minHeight: 44, justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '600' },
});
