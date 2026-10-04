# Step 14 — 2D plan editor (works without AR)

Read `CLAUDE.md` first. This is step 14. Do only this step.

## Why
Some phones have no ARCore/ARKit, some users can't scan, and screen-reader users need a non-camera path. The plan
editor edits the SAME design data as AR.

## Tasks
1. **AR support check** at startup (`ViroUtils.isARSupportedOnDevice` via `src/ar/`). Unsupported → AR buttons
   become "Plan view", with a one-line explanation.
2. **Plan screen** `src/screens/PlanScreen.tsx` using `react-native-svg` + `react-native-gesture-handler` +
   `react-native-reanimated`: room rectangle from the scan, preset size, or user-entered W × D (cm); pieces drawn with
   the shared `planSvg` geometry; drag to move (5 cm snap), rotate buttons (15°, 90°), pinch-zoom/pan the canvas,
   add from the product picker / suggestions, delete, undo/redo (reuse `useLayoutHistory`), collision + walkway
   highlighting (same utils as AR), dimensions of the selected piece and its distance to the nearest wall.
3. **Same data:** a plan design saves the same `items[]` offsets; opening it in AR places it (offset from the anchor
   piece, or room-aligned when a scan exists). AR designs open in Plan too. Add "Plan" / "AR" toggle on design cards.
4. **Accessibility:** every piece is an accessible element ("Sofa, 202 by 89 cm, 45 cm from the north wall");
   move/rotate via accessibility actions.
5. **Tests:** pure functions for plan↔world conversion, wall distance, snap; round-trip plan → AR → plan keeps
   positions within 1 mm.

## Done when
`npm run check` passes; describe how a user without AR goes from onboarding to a saved, shareable design.
