import * as Sentry from '@sentry/node';
import { scrubEvent } from '../../../shared/scrub.mjs';

/**
 * Error reporting for the API. Off unless SENTRY_DSN is set. The release is the server version, and every event is scrubbed
 * (tokens, emails, passwords, one-time codes, Authorization headers) in beforeSend. Returns the function the error handler calls.
 */
export function initMonitoring({ dsn, release, environment }) {
  if (!dsn) return () => {};
  Sentry.init({ dsn, release, environment, sendDefaultPii: false, tracesSampleRate: 0, beforeSend: (event) => scrubEvent(event) });
  return (error, ctx) => Sentry.withScope((scope) => { scope.setContext('request', ctx); Sentry.captureException(error); });
}
