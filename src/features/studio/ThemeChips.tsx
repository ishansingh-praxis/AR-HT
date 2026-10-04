import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { THEMES } from '../../studio/studio';
import { colors } from '../../theme';
import { t } from '../../i18n';

/** Theme picker: tapping one picks a new matching set (colours and materials) for the room. */
export function ThemeChips({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
      {THEMES.map((th) => (
        <Pressable key={th.id} accessibilityRole="button" accessibilityState={{ selected: value === th.id }} accessibilityLabel={t('studio.themeLabel', { name: t(`themes.${th.id}`) })}
          onPress={() => onChange(th.id)} style={[s.chip, value === th.id && s.on]}>
          <Text style={s.icon}>{th.icon}</Text>
          <Text style={[s.text, value === th.id && { color: colors.accentInk }]}>{t(`themes.${th.id}`)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  chip: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, marginRight: 8 },
  on: { backgroundColor: colors.accent, borderColor: colors.accent },
  icon: { fontSize: 18, marginRight: 6 },
  text: { color: colors.ink, fontWeight: '600' },
});
