import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { willItFit } from '../utils/fit';
import { areaOf } from '../utils/area';
import { useSettings } from '../store/settingsStore';
import { colors } from '../theme';
import type { Product } from '../types/furniture';
import { t } from '../i18n';

/** "Will it fit?": type the free width, or use the longest wall of the scanned room. */
export function FitCalculator({ product }: { product: Product }) {
  const scan = useSettings((s) => s.scanned);
  const preset = useSettings((s) => s.preset);
  const [typed, setTyped] = useState('');
  const n = Number(typed.replace(',', '.'));
  const answer = willItFit({ widthCm: product.dimensionsCm.w, depthCm: product.dimensionsCm.d }, {
    freeWidthCm: typed.trim() && n > 0 ? n : null,
    scanLongestWallCm: scan ? scan.widthCm : null,
    areaM2: areaOf({ scanned: scan, preset }),
  });
  const tone = answer.fit?.status === 'fits' ? colors.accent : answer.fit?.status === 'no' ? colors.danger : colors.muted;
  return (
    <View style={s.box}>
      <Text style={s.title}>{t('fitCalculator.willItFit')}</Text>
      <TextInput
        accessibilityLabel={t('fitCalculator.freeWidthInCentimetres')}
        value={typed} onChangeText={setTyped} keyboardType="numeric"
        placeholder={answer.prefillCm ? t('fit.placeholderWall', { cm: Math.round(answer.prefillCm) }) : t('fit.placeholder')}
        placeholderTextColor={colors.muted} style={s.input}
      />
      <Text style={[s.msg, { color: tone }]}>{t(answer.msg.key, answer.msg.vars)}</Text>
      {answer.freeFloorM2 != null ? (
        <Text style={s.small}>{t('fit.footprint', { piece: answer.footprintM2.toFixed(1), floor: answer.freeFloorM2.toFixed(0) })}</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginTop: 14 },
  title: { color: colors.ink, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, color: colors.ink },
  msg: { marginTop: 8, fontWeight: '600' },
  small: { color: colors.muted, fontSize: 12, marginTop: 4 },
});
