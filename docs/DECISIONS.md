# Decisions and known limits

Where the work differs from the numbered prompts, and why.

## Storage: no Postgres, no S3
You asked to avoid Postgres. The API stays on SQLite (a single local file, WAL mode) and files go to a local folder behind a small storage layer (`server/src/lib/storage.mjs`).
Step 09's goals are kept where they still make sense: versioned **migrations** (`server/src/migrations.mjs`, `npm run migrate`), **signed upload links** for models and thumbnails,
immutable versioned files with 1-year cache headers, optional `CDN_BASE_URL`, a Dockerfile, `render.yaml`, backups (`npm run backup`, `VACUUM INTO`) and `docs/DEPLOY.md`.
Not done: Drizzle/`pg`, MinIO/docker-compose, the repository layer (SQL still lives in the route files; there is no second database to swap in, so the layer would only add code).

## Password hashing
`scrypt` (Node built-in, N=2^15) instead of `argon2id`, to avoid a native dependency that must compile on every deploy target. Old bcrypt hashes verify and are upgraded at login.
The common-password list is the 8+ character entries of SecLists' 10k list (about 2,000 words), not all 10,000 (shorter ones are already rejected by the length rule).

## Camera photos (privacy rule changed on purpose)
`CLAUDE.md` said camera frames never leave the phone; step 12 uploads design thumbnails, which are screenshots of the AR view. Resolved: the upload happens only when the user
**shares that design** or turns on **Back up design photos** (Settings, off by default). The rule in `CLAUDE.md`, `docs/STORE.md` and `docs/privacy.md` says so.

## Release clean-up (step 16)
- `reference/` was **not deleted**: this folder is not a git repository, so deletion could not be undone. Nothing imports it (checked) and every tool excludes it. Commit first, then `rm -rf reference/`.
- The four Khronos demo models are **hidden in store builds** (`SHOW_DEMO`, on in development, or set `EXPO_PUBLIC_SHOW_DEMO=1`) instead of being deleted, because the server tests use them and deleting is not reversible without git.
- Prettier was not run over the whole `src/` (90 files predate this work and are not in its style; a mass reformat would bury the real changes). New files follow the surrounding style.
- Video is recorded silent: the microphone permission was removed (the AR library records the rendered screen). If you want sound, re-add `RECORD_AUDIO` and the iOS string.

## Theme and fonts
The light/dark palette is chosen when the app **starts** (styles are created once). Switching the phone theme while the app is open applies at the next launch.
Dynamic Type at 200 % was designed for (no fixed text heights) but cannot be verified without a device.

## Translations
Hindi in `src/i18n/hi.json` is machine translated (marked inside the file). A native speaker should review it before store submission.
The few strings that still come from the server (API error messages) are English.

## Performance numbers
Frame rates cannot be measured here. The code adds caps and fallbacks (30 pieces, level of detail past 15 real models, High to Standard drop when the app's frame rate falls under 20 fps for 5 s,
model download cache), but the targets in `TESTING.md` (60 fps Library scroll, 30 fps AR with 10 pieces) must be checked on phones. The automatic quality drop watches the app's UI frame rate; Viro does not report AR render fps.

## Shapes and photo-to-3D
The built-in shapes were upgraded (cushions, legs, headboards, doors, handles) and are coloured from each product's own photo (`dominantHex`, 28 colours, 78 small GLBs).
They are still not photo-real. `scripts/image-to-3d.mjs` is the route to real-looking models (needs your Meshy key; untested against the live service). Details in `prompts/MODELS.md`.

## What a real image-to-3D conversion would need
The 360° view wraps the product photo around the true-size shape: it is an honest approximation, not a reconstruction. A real 3D model of each product needs one of: supplier CAD files,
a 3D artist, or an image-to-3D service with artist clean-up (`prompts/MODELS.md`). Approved GLBs replace the shape automatically (admin dashboard, 3D models page).

## Admin sample rooms
Rooms published in the dashboard are stored on the server and served at `GET /v1/rooms`. The app still ships its 12 rooms in `src/data/rooms.json` and does not fetch server rooms yet.

## Room studio, prices and the 360° view
- **Rooms tab = "Design a room".** Six kinds (living, bedroom, dining, kitchen & dining, kids, study), five themes. `src/studio/studio.ts` is pure logic (tested in `scripts/studio.test.ts`): it picks real catalogue pieces per slot, scores them by theme (palette colour and material, because the CSV style column is unusable), lays them out without overlaps and keeps walkways clear, and totals a budget.
- **Budget = lowest variant price x sets** (`setSize`). Prices come from the Shopify CSV (`npm run merge:prices`) and are shown by default (`EXPO_PUBLIC_SHOW_PRICES=0` hides them). Items without a price are listed and not counted.
- **Thin stock:** kids and kitchen have few suitable pieces; "kitchen" is really a kitchen-and-dining nook, not a modular kitchen.
- **360° view:** the proxy GLB is inlined as a data URI (no file access needed), the WebView reports ready/error, and on error or after 8 s it falls back to the photos with a message. The page does not scroll while a finger is on the viewer.

## Free photo-to-3D on Google Colab (TripoSR)
This laptop (8 GB RAM, 2-core 2013 CPU, no GPU, no C++ compiler) is too weak to run TripoSR, so the model runs on a free Colab GPU: `node scripts/colab-batch.mjs export --next 20` -> run `colab/triposr_batch.ipynb` -> `node scripts/colab-batch.mjs import models.zip` -> `node scripts/image-to-3d.mjs --normalise` (scales to the listed size, grounds, checks, publishes). One photo only, so back and sides are invented: review in the admin dashboard before release. The notebook has not been run (no Colab access from here). The 3D viewer already uses model-viewer, which is built on Three.js.

## PostgreSQL for production (reverses "no Postgres")
The user first asked to avoid Postgres, then asked for a public Play Store launch for millions of customers, so the server now runs on SQLite (default, dev/pilot) or PostgreSQL (`DATABASE_URL`). One async `Db` wrapper (`server/src/db.mjs`), one set of migrations (type names filled in per engine). Tests run on SQLite, on PGlite (`TEST_DB=pglite`, a real PostgreSQL engine in memory) and in CI against a real Postgres service. The node-postgres driver itself has not been run on this machine (no Docker/Postgres here); CI exercises it. Uploaded files are still local disk: move `lib/storage.mjs` to S3/R2 before running more than one API server.

## Real models shipped inside the app
`node scripts/bundle-models.mjs` orients each generated model upright by matching its proportions to the listed size, stretches it to exactly the listed W x H x D (a model needing more than a 1.4x stretch is left out for review), copies the passing ones to `assets/models/` and lists them in `src/data/bundledModels.ts`. The app marks those products `model3D.bundled` on every catalogue load (`src/utils/bundled.ts`), so the server and the cached catalogue never need to know about them. 14 of the first 20 photo-generated models passed (beds, sofas, night stands, tables, a chair); the 2 wardrobes, bookshelf, TV unit, 4-seater sofa and a chair set did not and keep the simplified shape. Facing (front = +z) could not be detected: a model that faces the wrong way is fixed with `node scripts/bundle-models.mjs --flip <id>` (a 180 degree turn). About 2 MB per model goes into the app download.
