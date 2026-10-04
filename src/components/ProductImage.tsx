import React from 'react';
import { Image } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';
import { colors } from '../theme';

/**
 * A product photo with disk caching and a blurhash placeholder (expo-image). Decorative by default: the card around it carries the label.
 * `uri` is the photo; `blurhash` comes from the catalogue.
 */
export function ProductImage({ uri, blurhash, style, contentFit = 'cover', label }: { uri?: string; blurhash?: string; style?: StyleProp<ImageStyle>; contentFit?: 'cover' | 'contain'; label?: string }) {
  return (
    <Image
      source={uri ? { uri } : undefined} placeholder={blurhash ? { blurhash } : undefined} contentFit={contentFit} transition={150} cachePolicy="disk"
      recyclingKey={uri} style={[{ backgroundColor: colors.line }, style]} accessible={!!label} accessibilityLabel={label} accessibilityIgnoresInvertColors
    />
  );
}
