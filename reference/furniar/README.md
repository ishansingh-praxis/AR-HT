# FurniAR

React Native (Expo dev build) + TypeScript AR app for the HomeTown furniture catalogue. AR runs on ARKit / ARCore
through ViroReact. Camera images never leave the phone.

See `docs/PLAN.md` (project plan), `docs/DATA-AUDIT.md` (what is in the HomeTown export), `TESTING.md` (device test plan).

## Run it
AR needs a **real device** and a **development build** (not Expo Go, not an emulator).
```bash
npm install
npx expo prebuild
npx expo run:android      # ARCore phone, USB debugging on
npx expo run:ios          # Mac + Xcode + real iPhone
```
Change `com.example.furniar` in `app.json` first.

## Checks (run before changing anything)
```bash
npm run typecheck
npm test                  # geometry, curated-room integrity, room scan maths, recommendations
npm run validate:models   # GLB size must match listed dimensions (+-5%)
npm run doctor
(cd server && npm install && npm test)   # 7 end-to-end API tests
```

## What the app does
- **Front page:** pick room type and size, then scan the room or browse.
- **Sample rooms:** 4 designs curated from real HomeTown products, drawn to scale, with the real product list.
  Collections are kept together (Nova bedroom, Oren dining). Room tests fail if pieces overlap, leave the room,
  or leave an awkward gap.
- **Camera room scan:** aim at each floor corner and tap Mark corner. Works out size, area and angle at any
  rotation, and warns when the room is irregular.
- **AR placement:** sample rooms line up with the scanned walls (or anchor at the dot if you skip scanning).
  Individual products place with drag / pinch / twist. Collision outline, shadows, light estimate, depth-occlusion
  toggle, photo capture, saved designs.
- **No 3D model yet:** real HomeTown products show as a to-scale box with a label. Four demo products use real GLBs.
- **Recommendations:** rules engine on the device: role gaps for the room type, hard space and fit filters, same
  collection, style, colour harmony. Each suggestion shows a reason.

## Data pipeline
```bash
npm run data:import -- /path/HT_Data_dump.csv   # -> server/data/hometown-products.json (5,505 products)
npm run data:rooms                              # -> src/data/catalogue.json + rooms.json (curation in scripts/rooms/curation.mjs)
```
Add or change a room by editing `scripts/rooms/curation.mjs`, rebuild, then `npm test`: bad layouts fail.
`server/data/` is git-ignored (it is large and derived from your CSV).

## Backend (`server/`)
Node 22 + Express + SQLite (`node:sqlite`; plain SQL, so Postgres is a mechanical swap).
Auth, catalogue (filter by role / room type), wishlist, designs, anonymous usage events, and admin product
create/update. An uploaded GLB is rejected with 422 if its size doesn't match the listed dimensions; a product
without a GLB is accepted and stays a to-scale box. Point the app at it with `EXPO_PUBLIC_API_URL`.
Before going live: HTTPS, production database, object storage/CDN for GLBs, real secrets.

## Known limits
- **Nothing here has run on a real phone.** AR gestures, scan accuracy, shadows, occlusion and photo capture follow
  Viro's API as documented and are covered by TESTING.md, not by automated tests.
- Scan accuracy depends on the phone's tracking. Treat results as estimates and measure to confirm.
- Saved designs reopen relative to a new tap point, not at the same spot in the room (needs persistent anchors).
- Floor placement only. Wall items need wall-mountable products, which the export doesn't have.
- No rugs or floor lamps exist in the active data, so rooms have none.
- Sizes come from source data with known problems (see the audit); low-confidence sizes are flagged.
- Login screens and a cloud-synced wishlist/designs UI aren't built (the API exists).
