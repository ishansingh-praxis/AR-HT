# Step 04 — Split the AR screen, merge in FurniAR's room scan

Read `CLAUDE.md` first. This is step 04. Do only this step.

## Read first
- `src/screens/ARScreen.tsx` and `src/ar/*` (HTRD, ~475 lines of AR logic)
- `reference/furniar/src/screens/ARScreen.tsx` (scan mode, outline, sample-room placement, turn 90°)
- `reference/furniar/src/utils/room.ts`, `reference/furniar/scripts/rooms.test.ts` (scan maths tests)
- `src/utils/clearance.ts` (HTRD's roomStats / fitsRoom)

## Part A: refactor, no behaviour change
Split `ARScreen.tsx` into:
- `src/features/ar/useLayoutHistory.ts` (items, past, future, commit, undo, redo, update)
- `src/features/ar/usePlacement.ts` (place, duplicate, remove, rotate, swap, wall placement)
- `src/features/ar/useDesignIO.ts` (save, reopen by offset / two-point frame / cloud anchor, pin)
- `src/features/ar/useCapture.ts` (photo, video)
- `src/features/ar/components/` TopBar, StatusBanner, CoachingOverlay, ProductPicker, SelectionActions,
  SuggestionChips, BottomSheet, PermissionGate
- `ARScreen.tsx` becomes composition only (< 200 lines).
The bottom sheet gets a tab bar like FurniAR's: **Suggested · All · Rooms · Tools** (Tools = measure, wall, save,
photo, video, AI layout, pin). Suggested can show HTRD's current pairs list until step 06.

## Part B: room scan (replaces "Measure room")
1. Copy `room.ts` into `src/utils/room.ts` (`roomFromCorners`, `layoutFits`, `placeLayout`) and its tests into
   `scripts/room.test.ts`. Keep HTRD's `roomStats` free-area logic; remove duplicates so there is one room module.
2. **Scan mode** (`mode: 'place' | 'scan' | 'wall'`): Mark corner, Undo, Done (≥3 corners), Skip. Draw yellow corner
   spheres and a closing polyline (FurniAR). Reject rooms under 1.5 m². Warn when rectangularity < 0.9.
3. Save the scan in `settingsStore.scanned` `{widthCm, depthCm, areaM2, rectangularity, at}` and keep the full
   `RoomBox` (with corners in world coords) in AR screen state for alignment.
4. **Reference points:** the first two scanned corners automatically become the two-point frame used when saving
   (HTRD's `toFrame`). So "scan, place, save" always reopens in the same spot after a re-scan of the same corners.
   Show a hint: "Start the scan from the same corner next time to restore this design here."
5. Status line shows `Room 4.5 × 3.8 m · 17.1 m² · 9.2 m² free`. Suggestions are filtered by `fitsRoom` (existing).
6. Entry points: Welcome "Scan my room" opens AR in scan mode (`route.params.mode = 'scan'`); Tools tab has "Re-scan".
7. Track nothing yet (analytics arrive in step 07) but leave `// track('room_scanned', …)` where it belongs.

## Done when
- `npm run check` passes, including the ported room tests (noisy rotated rectangles within 3 %, L-shaped room flagged).
- No file in `src/features/ar` over 250 lines. `ARScreen.tsx` under 200.

## Phone checkpoint (I do this) — also update TESTING.md with these rows
Measure a real room with a tape: scanned width/depth within 3 %. Outline sits on the wall-floor lines. Place 3 pieces,
save, close the app, reopen the design, re-scan starting at the same corner: pieces return within ~5 cm.
All HTRD checks still pass (undo/redo, wall hanging, collision, walkway warning, photo, video).
