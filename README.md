# HomeTown AR

Place true-to-size HomeTown furniture in your room with your phone's camera, plan rooms to scale, get suggestions that fit, and save or share designs.
React Native (Expo dev build) app + a small Node API + a web admin dashboard. No cart, checkout or payments.

| Folder | What |
|---|---|
| `src/`, `App.tsx` | The app. `src/ar/` is the only code that touches the AR library (Viro); `src/features/ar/` and `src/features/plan/` hold the AR and plan-editor logic and parts |
| `server/` | Express API on **SQLite + local disk** (no Postgres, no cloud storage needed): auth, catalogue, designs, sharing, admin tools |
| `admin/` | Web dashboard (Vite + React): products, 3D model review, sample rooms, import, users, analytics. Served by the API at `/admin` |
| `shared/` | Pure code used by app tooling, server and admin (catalogue rules, importer, room checks, scrubbing of crash reports) |
| `docs/` | AUTH, API, DEPLOY, SHARING, ADMIN, MONITORING, STORE, RELEASE, BETA, DECISIONS |
| `prompts/` | The numbered build plan these features came from |
| `reference/` | The old FurniAR prototype, kept read-only. Nothing imports it; delete it after you have committed (see docs/DECISIONS.md) |

## Quick start
```bash
npm install && (cd server && npm install) && (cd admin && npm install)
npm run check                      # types, lint, logic tests, component tests
(cd server && npm test)            # 65 API tests
(cd admin && npm test && npm run build)
```
Run the API: `cd server && npm start` (SQLite file in `server/data`, uploads in `server/uploads`; see `server/.env.example`). Admin: `http://localhost:4000/admin`
after `cd admin && npm run build` (make yourself admin with `node scripts/make-admin.mjs you@example.com`).

## Run the app
Expo Go runs everything except AR (the AR screen shows a notice; the plan editor works). AR needs a **real phone and a development build**:
```bash
npx expo prebuild && npx expo run:android      # ARCore phone, USB debugging
npx expo run:ios                                # Mac + Xcode + real iPhone
# or in the cloud: eas build --profile development --platform android
```
Point the app at your API with `EXPO_PUBLIC_API_URL` (see `.env.example`; with or without `/v1`). Phone on Wi-Fi: `http://<computer-LAN-IP>:4000`, Android emulator: `http://10.0.2.2:4000`
(set `APP_ENV=development` at prebuild so Android allows plain http). Then follow `TESTING.md` on a real phone. UI flows that do not need AR: `.maestro/`.

If the camera does not open: you are in Expo Go (use the dev build); camera permission was denied (the app shows Open settings); the phone has no ARCore (the plan editor takes over);
otherwise read `adb logcat | grep -i viro`.

## What is in the app
- **Library** (700 products, photo placeholders, search, categories), **product page** with a spinning **360° view** (the true-size shape wrapped in the product photo, or the real model when there is one), real size, "Will it fit?", colour variants, saved furniture
- **View in my room**: opens the camera, finds the floor and drops the piece at the aim dot at true size (resize limited to 80 to 125 %); drag, twist, copy, delete, undo/redo, collision outlines, walkway warnings, photo and video
- **Room scan**: tap the floor corners (3+) for width, depth, area, irregular-room warning and free area; the first two corners are the reference points that bring a saved design back to the same spot
- **Sample rooms** (12 curated, drawn to scale) placed centred and aligned to a scanned room; suggestions with reasons (Suggested tab); AI layout (needs a server key)
- **Plan view**: a 2D editor with the same designs, for phones without AR or when the camera is not wanted; screen-reader friendly
- **Saved designs** with thumbnails, share link and web page, optional account with offline-safe sync (email codes, Google, Apple), account deletion
- English and Hindi (Hindi is machine translated: review it), dark mode, accessibility labels, offline banner, crash screens with "Try again"

## Data and 3D models
`src/data/catalogue.json` is built from HomeTown's Shopify export: `npm run build:catalogue -- data/HT_Data_dump.csv` (or the admin Import page, which shows a diff first).
Placeable products use a **simplified true-size shape** (`npm run build:proxies`) until a photo-real GLB is approved in the admin; the app labels shapes honestly.
Sizes in the export are messy: the importer flags implausible ones (`sizeReview`), and flagged products are not placeable until an editor checks them. See `prompts/MODELS.md` for sourcing real models.
`npm run build:blurhash` adds image placeholders. `npm run validate:models` checks GLB sizes.

## Deploy, release, operate
`docs/DEPLOY.md` (one container, SQLite + disk), `docs/SHARING.md` (share domain and app links), `docs/AUTH.md`, `docs/ADMIN.md`, `docs/MONITORING.md`,
`docs/RELEASE.md` (checklist, staged rollout, rollback), `docs/STORE.md` + `privacy.md` + `terms.md` (drafts for review), `docs/BETA.md`.
EAS profiles `development`, `preview` (APK), `production` (AAB) are in `eas.json`; CI in `.github/workflows` (checks on every push, builds and submits on `v*` tags, API deploy).

## Not verified here
No device testing has been done in this environment: AR placement, scanning accuracy, gestures in the plan editor, thumbnails, share links opening the app, deep links,
Google/Apple sign-in and on-device performance all need a phone (see `TESTING.md`). Logic is covered by automated tests; see `docs/DECISIONS.md` for known limits.
