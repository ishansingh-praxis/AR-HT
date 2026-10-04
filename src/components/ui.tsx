import { t } from '../i18n';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../theme';

export function Button({
  label,
  onPress,
  variant = 'solid',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'outline' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const solid = variant === 'solid';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[
        s.btn,
        solid && { backgroundColor: colors.accent },
        variant === 'outline' && { borderWidth: 1, borderColor: colors.accent },
        variant === 'danger' && { borderWidth: 1, borderColor: colors.danger },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Text
        style={[
          s.label,
          { color: solid ? colors.accentInk : variant === 'danger' ? colors.danger : colors.accent },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 44, justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center' },
  label: { fontSize: 15, fontWeight: '600' },
});

/** HomeTown logo with optional company name beside it. */
export function Logo({ size = 40, showName = true, light = false }: { size?: number; showName?: boolean; light?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }} accessible accessibilityRole="image" accessibilityLabel={t('ui.hometownLogo')}>
      <Image source={require('../../assets/logo.png')} style={{ width: size, height: size, borderRadius: size / 2 }} />
      {showName && (
        <Text style={{ marginLeft: 10, fontSize: size * 0.5, fontWeight: '800', letterSpacing: 0.5, color: light ? '#fff' : colors.ink }}>
          Home<Text style={{ color: '#F05A22' }}>Town</Text>
        </Text>
      )}
    </View>
  );
}

/** Heart toggle for "Save for later". */
export function HeartButton({ saved, onPress, size = 22 }: { saved: boolean; onPress: () => void; size?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? t('ui.removeSaved') : t('ui.saveForLater')}
      accessibilityState={{ selected: saved }}
      hitSlop={10}
      onPress={onPress}
      style={{ width: size + 16, height: size + 16, borderRadius: (size + 16) / 2, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontSize: size, color: saved ? '#D8402F' : colors.muted }}>{saved ? '♥' : '♡'}</Text>
    </Pressable>
  );
}
