# Monitoring

## Crash reports (Sentry)
**App** (`@sentry/react-native`): set `EXPO_PUBLIC_SENTRY_DSN`. The release is `hometown-ar@<app version>`, so crashes group per build.
For readable stack traces on EAS builds set `SENTRY_ORG` and `SENTRY_PROJECT` as build env vars and `SENTRY_AUTH_TOKEN` as an EAS secret; `app.config.js` then adds the
Sentry plugin, which uploads source maps. Without a DSN nothing is sent.

**Server** (`@sentry/node`): set `SENTRY_DSN`. The release is `hometown-ar-server@<version>`. Only unexpected errors (HTTP 500) are reported, with the request id, method and path.

**Privacy**: every event passes through `shared/scrub.mjs` before it leaves the phone or the server: Authorization headers, tokens, passwords, one-time codes and email
addresses are removed, the user is reduced to an id, request bodies and cookies are dropped, console breadcrumbs are not recorded. Camera frames and room geometry are never
attached (tested in `scripts/scrub.test.ts`).

Each screen is wrapped in an `ErrorBoundary`: a crash shows "Try again" on that screen instead of closing the app, and is reported with a `where` tag.

## Uptime
Point any uptime monitor (UptimeRobot, Better Stack, Pingdom) at:
- `GET https://<api>/health`: the process is up (expects `{"ok":true}`)
- `GET https://<api>/ready`: the database answers (503 when it does not)
Alert after 2 failed checks, 1 minute apart. Logs are JSON (pino) with a request id (`x-request-id` response header) and never contain bodies or tokens.

## What to watch after a release
- Crash-free sessions and crash-free users in Sentry (gate for the staged rollout, see `docs/RELEASE.md`)
- 5xx rate and p95 latency of `/v1/catalogue` and `/v1/designs`
- Admin dashboard, Analytics: scan success rate, suggestions placed rate
