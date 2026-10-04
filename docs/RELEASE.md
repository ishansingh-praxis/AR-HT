# Release checklist

Copy this list into the release issue and tick it off. Versions follow `v<major>.<minor>.<patch>` and match `app.json` `version`.

## One-time setup
- [ ] Apple Developer account, Google Play Console account, Expo account; `eas login`; `eas init` (adds the project id to `app.json`)
- [ ] `eas update:configure` (adds the updates URL; channels `preview` and `production` already exist in `eas.json`)
- [ ] EAS environment variables for each environment (`eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://api.example.com --visibility plaintext`): `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SHARE_DOMAIN`, `SHARE_DOMAIN` (same value), `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`, optional `EXPO_PUBLIC_CLOUD_ANCHORS`, `RV_API_KEY`, `RV_PROJECT_ID`; Sentry: `SENTRY_ORG`, `SENTRY_PROJECT`, secret `SENTRY_AUTH_TOKEN`
- [ ] `eas credentials` for signing, the Play service-account key and the App Store Connect API key (used by `eas submit`)
- [ ] GitHub secrets: `EXPO_TOKEN`; environments `staging` and `production` each with `DEPLOY_HOOK_URL` (add required reviewers to `production`)
- [ ] API deployed (docs/DEPLOY.md), share domain set up (docs/SHARING.md), Google/Apple sign-in configured (docs/AUTH.md), uptime check on `/health` (docs/MONITORING.md)

## Every release
1. **Version bump**: edit `version` in `app.json` (build numbers auto-increment on EAS). Update `server/package.json` version if the API changed.
2. **Code**: `npm run check`, `cd server && npm test`, `cd admin && npm test && npm run build` are green on `main` (CI does this).
3. **Migrations**: new schema changes are new entries at the end of `server/src/migrations.mjs` (never edit old ones). Test on a copy of the production database: `cp data/furni.db /tmp/x.db && DB_FILE=/tmp/x.db npm run migrate`. `npm run backup` first.
4. **Catalogue version**: product changes bump it automatically (admin edits, imports, model approvals). If you changed `src/data/catalogue.json`, bump the `version` number in `src/store/catalogueStore.ts` so installed apps drop their old cached copy.
5. **Device pass**: `TESTING.md` on one mid-range Android, one flagship Android and one iPhone. Note fps, heat and any crash.
6. **Tag**: `git tag v1.2.3 && git push --tags`. CI runs all checks, builds Android (AAB) and iOS on EAS, submits to Play internal testing (draft) and TestFlight, and deploys the API to production (after approval).
7. **Sentry release**: the app build uploads source maps (`SENTRY_AUTH_TOKEN`); the release name is `hometown-ar@<version>`. Check the release shows up with 0 crashes on your own test.
8. **Staged rollout** (Play Console, Production):
   - [ ] 10 % for 24 hours. Gate: crash-free sessions > 99 % and no new crash with more than 5 users in Sentry
   - [ ] 50 % for 24 hours, same gate
   - [ ] 100 %
   - iOS: phased release over 7 days in App Store Connect
9. **Announce** and watch Sentry, the uptime monitor and the admin Analytics page for the first 48 hours.

## JavaScript-only fixes without a store review
`eas update --channel production --message "Fix X"` works for changes that do not touch native code (`runtimeVersion` policy is `appVersion`, so an update only reaches builds with the same app version). Test it on the `preview` channel first.

## Rollback
- **App (OTA update)**: `eas update:rollback --channel production` (or republish the previous update). Native builds cannot be rolled back: halt the Play rollout (Console, Halt rollout) and ship a fix as the next version.
- **API**: redeploy the previous image tag (`ghcr.io/<repo>-api:v1.2.2`) from your host. The database is migrated forward only: restore the pre-release backup (`npm run backup` file) only if a migration itself was wrong, and expect to lose writes since the backup.
- **Catalogue**: restore products from the audit log / re-import the previous Shopify CSV in the admin (Import page, "Publish").
- **Admin dashboard**: part of the API image, so it rolls back with it.
