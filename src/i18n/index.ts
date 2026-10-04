import i18next from 'i18next';
import { getLocales } from 'expo-localization';
import en from './en.json';
import hi from './hi.json';

export const SUPPORTED = ['en', 'hi'] as const;
export type Lang = (typeof SUPPORTED)[number];

/** The phone's first language if we have it, else English. Read at launch. */
export const deviceLanguage = (): Lang => {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return (SUPPORTED as readonly string[]).includes(code) ? (code as Lang) : 'en';
};

i18next.init({
  resources: { en: { translation: en }, hi: { translation: hi } },
  lng: deviceLanguage(),
  fallbackLng: 'en', // a missing Hindi string shows the English one
  interpolation: { escapeValue: false }, // React Native does not render HTML
  returnNull: false,
  initAsync: false, // resources are bundled, so load synchronously: t() works at import time (module-level labels) and on the first render
});

/** Translate a key. `t('library.search')`, `t('plan.fromWall', { cm: 45, wall: 'north' })`. Usable anywhere (components, hooks, alerts). */
export const t = (key: string, vars?: Record<string, string | number>): string => i18next.t(key, vars) as string;
export default i18next;

/** Numbers and sizes formatted for the phone's locale. */
export const formatNumber = (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(getLocales()[0]?.languageTag ?? 'en', opts).format(n);
export const formatCm = (n: number) => `${formatNumber(Math.round(n))} cm`;
export const formatMeters = (cm: number, digits = 1) => `${formatNumber(cm / 100, { minimumFractionDigits: digits, maximumFractionDigits: digits })} m`;
