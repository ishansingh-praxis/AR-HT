import { Appearance } from 'react-native';
import { dark, light } from './themePalettes';

/**
 * Colour tokens. The palette follows the phone's light/dark setting at LAUNCH (styles are created once when the app starts, so
 * switching the phone theme while the app is open takes effect the next time it opens). AR overlays use fixed translucent colours
 * so they stay readable on top of the camera in either mode.
 */
export const isDark = Appearance.getColorScheme() === 'dark';
export const colors = isDark ? dark : light;
/** Always-dark surface for hero screens (onboarding), whatever the phone theme is. */
export const hero = '#14211F';

export const formatPrice = (n: number) => `₹${n.toLocaleString('en-IN')}`;
