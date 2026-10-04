# Step 16 — Release

Read `CLAUDE.md` first. This is step 16. Do only this step.

## Tasks
1. **Clean up:** delete `reference/` (confirm nothing imports it), delete the Khronos demo models from the catalogue
   unless I say keep, remove dead code (`formatPrice` if unused, old aliases), run lint/format.
2. **EAS:** `eas.json` profiles development / preview / production with env per profile (`APP_ENV`, `API_URL`,
   `SHARE_DOMAIN`, `SENTRY_DSN`, `CLOUD_ANCHORS`). `app.config.js` reads them. Auto-increment build numbers.
   `eas update` channels (preview, production) with `runtimeVersion` policy `appVersion`.
3. **Permissions:** camera (required), photo library add-only, microphone only if video records sound (otherwise
   remove `RECORD_AUDIO` and record silent). Purpose strings in plain language. Android `minSdk` per ARCore needs,
   `<uses-feature android:name="android.hardware.camera.ar" required=false>` so non-AR phones can install
   (plan editor covers them).
4. **Store prep docs** in `docs/STORE.md`: Play data-safety answers and App Store privacy answers derived from what
   the code actually collects (account email, designs, anonymous events, crash logs; camera frames never collected);
   privacy policy and terms drafts (`docs/privacy.md`, `docs/terms.md`) for my review; account-deletion URL; store
   descriptions, keywords, screenshot list (8 shots), a 30-second AR preview video script.
5. **CI/CD:** GitHub Actions: on tag `v*` run checks, `eas build --profile production --non-interactive` for both
   platforms, `eas submit` to internal testing (Play) and TestFlight. Server: build Docker image and deploy to staging
   on main, production on tag, run migrations first.
6. **Release checklist** `docs/RELEASE.md` with checkboxes: version bump, migrations, catalogue version, Sentry
   release, staged rollout 10 % → 50 % → 100 % with crash-free > 99 % gate, rollback steps (EAS update rollback,
   previous Docker image).
7. **Beta:** `docs/BETA.md`: tester instructions, feedback form questions, what to measure (scan success,
   placements per session, saved designs, share rate, crash-free sessions).

## Done when
`eas build --profile preview --platform android` succeeds (I run it), CI is green, all docs exist.
