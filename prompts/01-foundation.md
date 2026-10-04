# Step 01 — Foundation

Read `CLAUDE.md` first. This is step 01. Do only this step.

## Goal
A clean, renamed, buildable base with tooling, and the AR library isolated behind one folder so later steps
can change AR features safely.

## Tasks
1. **Identity.** Rename the app to "HomeTown AR": `app.json` name/slug `hometown-ar`, keep bundle id / package
   `in.hometown.roomdesigner` unless I said otherwise. Bump `version` to `0.2.0`. `package.json` name `hometown-ar`.
   Server package name `hometown-ar-server`. Update the server startup log line.
2. **Install health.** Run `npm install` and `npx expo install --check`. Fix version mismatches so `npm run doctor`
   passes. Change the `test` script to run each test with `node --no-warnings --experimental-strip-types` (silences the
   module-type warning without changing `package.json` `type`). Keep Viro at 3.0.2 unless doctor proves an incompatibility; if so,
   write what you found in `docs/DECISIONS.md` and pin the versions ReactVision documents.
3. **Config module.** Create `src/config.ts` exporting `API_URL` (from `EXPO_PUBLIC_API_URL`), `CLOUD_ANCHORS`
   (from `EXPO_PUBLIC_CLOUD_ANCHORS === '1'`), `SHOW_PRICES` (from `EXPO_PUBLIC_SHOW_PRICES === '1'`, default false),
   `APP_ENV`. Replace scattered `process.env` reads in `src/` with imports from it. Update `.env.example`.
4. **Tooling.** Add ESLint (expo config + react-hooks rules) and Prettier with `npm run lint` and `npm run format`.
   Fix lint errors in `src/` without changing behaviour. Add `npm run check` = typecheck + lint + test.
5. **gitignore.** Add `.cache/`, `server/data/`, `server/uploads/`, `.env`, `data/*.csv`, `models/published/`.
6. **CI.** `.github/workflows/ci.yml`: on push/PR, Node 22, `npm ci`, `npm run check`, `cd server && npm ci && npm test`.
7. **AR isolation layer.** Create `src/ar/`:
   - `src/ar/viro.ts` re-exports exactly the Viro components and constants the app uses.
   - `src/ar/types.ts`: `Vec3`, `HitResult`, `TrackingState`, `AnchorInfo`, `ARSessionHandle` (takeScreenshot,
     startVideo, stopVideo, hostCloudAnchor, resolveCloudAnchor).
   - Move `PlacementScene` out of `src/screens/ARScreen.tsx` into `src/ar/PlacementScene.tsx` unchanged in behaviour.
   - `src/ar/ARView.tsx` wraps `ViroARSceneNavigator` and exposes an `ARSessionHandle` via ref.
   - `ARScreen.tsx` must import only from `src/ar/`. Add an ESLint `no-restricted-imports` rule that forbids
     `@reactvision/react-viro` outside `src/ar/`.
8. **Test fixture.** Make sure `server/test` uses the committed `models/raw/_example-GlamVelvetSofa.glb` (it does) and
   that no test downloads from the internet.
9. **README.** Rewrite `README.md` for the merged app: what it is, setup, commands, folder map, link to `prompts/`.

## Done when
- `npm run check` and server tests pass. `npm run doctor` passes or its remaining warnings are explained in
  `docs/DECISIONS.md`.
- `grep -r "@reactvision/react-viro" src | grep -v "src/ar/"` returns nothing.
- Summarise the changes, then give me the exact commands to build the dev client on my Android phone.

## Phone checkpoint (I do this)
`npx expo prebuild --clean && npx expo run:android`: the app opens, the Library shows items, AR opens the camera,
"Floor found" appears, a sofa can be placed. Report problems back to this chat before committing.
