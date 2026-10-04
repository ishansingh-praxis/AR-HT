// Colour palettes (pure: no React Native imports, so they can be tested). src/theme.ts picks one at launch.
export interface Palette { bg: string; surface: string; ink: string; muted: string; line: string; accent: string; accentInk: string; danger: string }

/** Every text colour here has at least 4.5:1 contrast on the backgrounds it is used on (scripts/theme.test.ts checks it). */
export const light: Palette = {
  bg: '#F3F5F4', surface: '#FFFFFF', ink: '#14211F', muted: '#556561', line: '#DCE3E1', accent: '#2F6F5E', accentInk: '#FFFFFF', danger: '#B3402F',
};
export const dark: Palette = {
  bg: '#0F1716', surface: '#18221F', ink: '#E8F0ED', muted: '#A3B3AF', line: '#2B3A37', accent: '#5FB89F', accentInk: '#06201A', danger: '#FF8F7C',
};

const channel = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255); };
/** WCAG contrast ratio between two #RRGGBB colours (1 to 21). */
export const contrast = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
