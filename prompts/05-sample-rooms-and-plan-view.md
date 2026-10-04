# Step 05 — Curated sample rooms and the to-scale plan view

Read `CLAUDE.md` first. This is step 05. Do only this step.

## Read first
- `reference/furniar/scripts/rooms/curation.mjs`, `reference/furniar/scripts/build-rooms.mjs`
- `reference/furniar/src/components/RoomPlan.tsx`, `RoomsScreen.tsx`, `RoomDetailScreen.tsx`
- `reference/furniar/scripts/rooms.test.ts` (room integrity rules)
- `src/recommend*` or `src/utils/recommend.ts` (HTRD `buildStarter`, `sampleDesigns`, `LAYOUT`)

## Tasks
1. **Room data.** `scripts/rooms/curation.mjs` + `scripts/build-rooms.mjs` → `src/data/rooms.json`
   `{id, title, roomType, styles, blurb, notes?, roomCm:{w,d}, pieces:[{productId, x, z, rot, anchor}]}`. Pieces
   reference products in OUR catalogue by id. Port FurniAR's 4 rooms; any product missing from our catalogue →
   pick the closest same-role product from our catalogue and note it. Then **add 8 more rooms** (2 per room type,
   different sizes: ~9, 12, 16, 25 m²), keeping collections together where the catalogue has them. Only use products
   that are placeable and have no `sizeReview`.
2. **Integrity tests** `scripts/rooms.test.ts` (port + extend): exactly one anchor; every footprint inside the room;
   no overlaps; gaps between different pieces are ≤ 12, 35–50 or ≥ 60 cm; a 60 cm walkway path exists from the
   room's door side (assume door on the wall opposite the anchor unless `door` is given). Bad rooms fail the build.
3. **Plan view component** `src/components/RoomPlan.tsx`: top-down to-scale drawing, product colour fill, front-edge
   marker, role label when it fits, room dimensions on two edges, optional highlight of one piece. Use
   `react-native-svg` (install it) instead of absolute Views so it stays sharp and handles any rotation.
4. **Screens.** Add a **Rooms** tab (between Library and My designs): list of rooms with plan, title, size, piece
   count, "Fits your scanned room" / "Larger than your room" badge, filter chips by room type (user's type first).
   **RoomDetail** screen: plan, blurb, notes, "Try in my room", "Scan my room first", product list with counts and
   set maths (6 chairs sold in 2s = 3 sets), reference price total only when `SHOW_PRICES`.
5. **AR placement of a room** (in the Rooms tab of the AR sheet): with a scan → centred and wall-aligned
   (`placeLayout`), "Bigger than your room — place anyway?" prompt; without a scan → anchor at the dot.
   "Turn layout 90°" (`rotateLayout`, add to `utils/geometry.ts` with a test). Placed room pieces become normal
   items (undoable, draggable, savable).
6. **Replace** HTRD's generated `sampleDesigns` in My designs with these curated rooms (show under "Sample rooms").
   Keep `buildStarter` for "Start with a living room" from Welcome when no curated room of that type fits.

## Done when
`npm run check` passes with all 12 rooms valid. Screenshot-free summary: list the rooms with size and pieces.
