// Single place for build-time config. EXPO_PUBLIC_* values are public: never put secrets here.
import { apiBase } from './sync/http';

/** API base, always ending in /v1 (EXPO_PUBLIC_API_URL may be given with or without it). Empty = fully offline. */
export const API_URL = apiBase(process.env.EXPO_PUBLIC_API_URL ?? '');
export const CLOUD_ANCHORS = process.env.EXPO_PUBLIC_CLOUD_ANCHORS === '1';
/** Reference prices (lowest variant) power the room budget. On by default; set EXPO_PUBLIC_SHOW_PRICES=0 to hide every price. */
export const SHOW_PRICES = process.env.EXPO_PUBLIC_SHOW_PRICES !== '0';
export const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
/** The four Khronos demo models are test content: shown in development builds, hidden in store builds unless EXPO_PUBLIC_SHOW_DEMO=1. */
export const SHOW_DEMO = process.env.EXPO_PUBLIC_SHOW_DEMO === '1' || APP_ENV === 'development';
/** Domain that serves shared design pages and opens the app (https://<SHARE_DOMAIN>/d/<slug>). */
export const SHARE_DOMAIN = process.env.EXPO_PUBLIC_SHARE_DOMAIN ?? '';
/** Google OAuth client ids (public). Google sign-in is hidden when none is set. */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
export const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
