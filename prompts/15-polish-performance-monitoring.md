# Step 15 — Polish, performance, monitoring

Read `CLAUDE.md` first. This is step 15. Do only this step.

## Tasks
1. **Monitoring:** Sentry in the app (`@sentry/react-native` with the Expo plugin, source maps on EAS builds) and the
   server (`@sentry/node`); release = app version; scrub tokens/emails. Server uptime check on `/health`.
2. **Errors & empty states:** an ErrorBoundary per tab with "Try again"; offline banner (NetInfo); every list has an
   empty state; every network action shows progress and a readable error.
3. **Images:** switch to `expo-image` with disk caching and blurhash placeholders (server adds `blurhash` per image
   in the catalogue import).
4. **Performance:** FlatList → FlashList for Library and pickers; memoise product lookups with a `Map` in the
   catalogue store (`getFurniture` is O(n) now); AR: cap 30 placed pieces, LOD rule (proxies when > 15 GLBs),
   model download cache with `expo-file-system` keyed by `id-vN`, preload the selected product's GLB.
   Measure: Library scroll 60 fps on a mid-range Android; AR stays above 30 fps with 10 pieces in High quality,
   otherwise auto-drop to Standard and tell the user.
5. **Quality setting:** auto-pick Standard/High from device class on first run (RAM + Android API level / iPhone
   model); user can override.
6. **Accessibility:** labels and roles on every control, Dynamic Type up to 200 % without clipping, 4.5:1 contrast,
   44 pt touch targets, reduced-motion respect, AR status messages announced (`AccessibilityInfo.announceForAccessibility`).
7. **Localisation:** `i18next` + `expo-localization`; move every string to `src/i18n/en.json`; add `hi.json`
   (Hindi) with machine translation marked for review. Number/size formatting via `Intl`.
8. **Dark mode:** theme tokens for light/dark; AR overlays stay readable on camera images.
9. **App icon, splash, store-quality copy** for every screen; consistent naming ("Design", "Room", "Piece").
10. **Tests:** component tests (React Native Testing Library + jest-expo) for Library filter, Item fit box,
    Saved sections, onboarding; Maestro flows in `.maestro/` for onboarding → browse → save → sign-in (non-AR parts).

## Done when
`npm run check`, component tests and Maestro flows (on an emulator) pass. Report fps numbers I should verify.

## Phone checkpoint (I do this)
Full `TESTING.md` on a mid-range Android, a flagship Android and an iPhone. Note fps, heat, and any crash in Sentry.
