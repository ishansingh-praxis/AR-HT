import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../../../i18n';

const BAD = 'rgba(179,64,47,0.9)';

/** The stack of one-line status messages under the top bar. */
export function StatusBanner({ status, bad, brokenCount, onRemoveBroken, roomLine, selectedLine }: {
  status: string; bad: boolean; brokenCount: number; onRemoveBroken: () => void; roomLine?: string; selectedLine?: string;
}) {
  return (
    <>
      <Text accessibilityLiveRegion="polite" style={[s.status, bad && { backgroundColor: BAD }]}>{status}</Text>
      {brokenCount > 0 && (
        <View style={[s.row, s.status, { backgroundColor: BAD }]}>
          <Text style={{ color: '#fff', flex: 1 }}>Couldn&apos;t load {brokenCount === 1 ? 'this piece' : `${brokenCount} pieces`}.</Text>
          <Pressable accessibilityLabel={t('statusBanner.removePiecesThatFailed')} onPress={onRemoveBroken}><Text style={{ color: '#fff', fontWeight: '700' }}>{t('statusBanner.remove')}</Text></Pressable>
        </View>
      )}
      {roomLine ? <Text style={s.status}>{roomLine}</Text> : null}
      {selectedLine ? <Text style={s.status}>{selectedLine}</Text> : null}
    </>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row' },
  status: { marginTop: 8, color: '#fff', backgroundColor: 'rgba(20,33,31,0.75)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, overflow: 'hidden' },
});
