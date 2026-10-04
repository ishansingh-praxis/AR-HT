import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors } from '../../theme';
import { t } from '../../i18n';

/** Labelled text field used by every account screen. */
export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={[s.input, error ? { borderColor: colors.danger } : null]} {...props} />
      {error ? <Text accessibilityLiveRegion="polite" style={s.err}>{error}</Text> : null}
    </View>
  );
}

export const FormError = ({ text }: { text?: string | null }) => (text ? <Text accessibilityLiveRegion="polite" style={s.formErr}>{text}</Text> : null);
export const Title = ({ children }: { children: string }) => <Text accessibilityRole="header" style={s.title}>{children}</Text>;
export const Para = ({ children }: { children: React.ReactNode }) => <Text style={s.para}>{children}</Text>;

/** Turns thrown errors into a sentence for the screen. */
export const messageOf = (e: unknown) => (e instanceof Error ? e.message : t('common.wentWrong'));

export const authStyles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.bg }, body: { padding: 20 } });

const s = StyleSheet.create({
  label: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: 12, color: colors.ink, fontSize: 16, minHeight: 48 },
  err: { color: colors.danger, fontSize: 12, marginTop: 4 },
  formErr: { color: colors.danger, marginBottom: 10, lineHeight: 20 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  para: { color: colors.muted, lineHeight: 21, marginBottom: 16 },
});
