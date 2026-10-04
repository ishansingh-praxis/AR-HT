import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { APP_ENV, SENTRY_DSN } from '../config';
import { scrubEvent } from '../../shared/scrub.mjs';

/**
 * Crash reporting. Off unless EXPO_PUBLIC_SENTRY_DSN is set. The release is the app version, so crashes group per build, and every event is
 * scrubbed (tokens, emails, passwords, codes) before it leaves the phone. Camera frames and room data are never attached.
 */
export function initMonitoring() {
  if (!SENTRY_DSN) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    release: `hometown-ar@${Constants.expoConfig?.version ?? 'dev'}`,
    environment: APP_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event as never) as never,
    beforeBreadcrumb: (b) => (b.category === 'console' ? null : b), // console logs can contain anything
  });
}

/** Report a handled error (an ErrorBoundary caught it). No-op without a DSN. */
export function reportError(error: unknown, context?: string) {
  if (!SENTRY_DSN) return;
  Sentry.withScope((scope) => { if (context) scope.setTag('where', context); Sentry.captureException(error); });
}

export const wrapApp = <T extends React.ComponentType<never>>(c: T): T => (SENTRY_DSN ? (Sentry.wrap(c as never) as unknown as T) : c);
