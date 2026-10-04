import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
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
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center' },
  label: { fontSize: 15, fontWeight: '600' },
});
