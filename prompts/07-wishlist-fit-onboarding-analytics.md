# Step 07 — Wishlist, "Will it fit?", onboarding, analytics

Read `CLAUDE.md` first. This is step 07. Do only this step.

## Read first
`reference/furniar/src/store/wishlistStore.ts`, `settingsStore.ts`, `services/events.ts`,
`screens/WelcomeScreen.tsx`, `ProductScreen.tsx`, `SavedScreen.tsx`, `navigation/AppNavigator.tsx` (hydration gate).

## Tasks
1. **Onboarding.** Replace Welcome with FurniAR's: room type (living, bedroom, dining, study) + size
   (small ~9 m², medium ~16, large ~28, not sure), "Scan my room" / "Browse rooms". Persist `onboarded`; the
   navigator waits for store hydration and starts at Tabs for returning users (no flash). Settings → "Change room".
   `areaOf(settings)` = scan if present, else preset. Map room types so HTRD's 'Office' becomes 'study'.
2. **Wishlist.** `src/store/wishlistStore.ts` (ids + addedAt). Heart button on Library cards and Item screen.
   My designs tab becomes **Saved** with two sections: My designs, Saved furniture. Wishlist boosts recommendations
   (engine already has the favourite term). Cloud sync comes in step 11.
3. **Will it fit?** On Item: number input "free width in cm" → fits / tight / too wide (existing `checkFit`). If a
   room is scanned, prefill with its longest wall and show "Fits along your longest wall (4.5 m)". Also show
   the footprint area vs free floor area.
4. **Item screen merge.** Keep HTRD's Item (offline 3D preview, variants, View on HomeTown) and add from FurniAR:
   low-confidence size warning, "sold as a set of N", reference price only if `SHOW_PRICES`. Show proxy GLBs in the
   3D preview too, labelled "simplified shape at real size" (load the bundled asset via `expo-asset` local URI).
5. **Analytics.** Port `services/events.ts` (offline queue, cap 300, batches of 50, device id). Events:
   `app_opened, onboarding_done, ar_opened, room_scanned, rec_shown, rec_placed, piece_placed, piece_removed, undo,
   wall_marked, wall_piece_hung, design_saved, design_reopened, sample_room_placed, ai_layout_used, photo_taken,
   video_recorded, wishlist_added, item_viewed, retailer_link_opened`. Flush on app background (AppState) and on AR
   close. Props: ids and numbers only. Settings toggle "Share anonymous usage" (default on, persisted) that stops
   tracking and clears the queue.
6. Tests: events queue (cap, batch, failure keeps queue, opt-out), wishlist store, areaOf, fit prefill logic.

## Done when
`npm run check` passes. List every event and the screen that sends it.

## Phone checkpoint (I do this)
Fresh install → onboarding → scan → suggestions change with room size → heart items → they appear in Saved →
Will it fit prefilled from scan. Restart the app: no onboarding flash, data kept.
