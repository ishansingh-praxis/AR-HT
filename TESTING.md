# Device test plan (AR milestone A)

AR can't be tested on emulators. Do this on **one ARCore Android phone and one iPhone**, in a room with a
plain floor, decent light and some texture on the floor (a bare glossy floor is hard to track).

Build: `npx expo prebuild && npx expo run:android` / `npx expo run:ios`. Run `npm run doctor` first.
To test against the server, set `EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:4000` before starting.

| # | Check | Pass when | Android | iPhone |
|---|-------|-----------|---------|--------|
| 1 | Camera permission | Prompt appears on first AR open; denying it doesn't crash | | |
| 2 | Plane detection | Status text switches to "Floor found" within ~10 s of panning | | |
| 3 | Model load | Product appears after tapping Place; no blank/invisible model | | |
| 4 | Tap to place | Piece lands where the dot was aimed, on the floor (not floating/sunk) | | |
| 5 | Real scale | Measure the placed sofa against a tape measure: within ~5% of `dimensionsCm` | | |
| 6 | Drag | Piece follows the finger on the floor, stays on the floor | | |
| 7 | Pinch | Resizes smoothly, clamped 0.8x–1.25x of the listed size (true scale), no jump when a second finger lands | | |
| 8 | Twist | Rotates about its vertical axis, no jump at gesture start | | |
| 9 | Rotate/Delete buttons | 15° steps; delete removes only the selected piece | | |
| 10 | Multiple pieces | Place 5; frame rate stays smooth; no crash | | |
| 11 | Collision | Overlapping pieces turn red; separating them clears it. Outline matches the real footprint | | |
| 12 | Shadows | A soft shadow appears under each piece | | |
| 13 | Depth occlusion | Toggle on: a real object in front hides the model. Note any lag | | |
| 14 | Lighting | Model brightness roughly follows the room; no flicker | | |
| 15 | Screenshot | "Take photo" saves to the gallery and includes the furniture | | |
| 16 | Save / reopen | Design appears in Saved, reopens around the tapped point with the same layout | | |
| 17 | Backgrounding | Switch apps and come back: AR resumes without crashing | | |

If the model is huge, tiny, sideways or sunk into the floor, run `npm run validate:models`; it usually
means the GLB's units, orientation or origin are wrong.


## Added checks (do these after the basics work)
| Check | Pass when | Android | iPhone |
|---|---|---|---|
| Library shows 670+ placeable items; search and category filter are smooth | no lag scrolling | | |
| Place a sofa from the real catalogue | its footprint matches a tape measure (+/- 3 cm) | | |
| Mark wall, hang a frame | flat on the wall, facing the room, at eye height | | |
| Save with two reference points, restart the app, reopen | pieces return within ~5 cm, facing the same way | | |
| (Only with ReactVision keys) Pin to room, restart, Find my room | pieces return in the same physical spots | | |
| AI layout (server key + signed in) | suggestions are real catalogue pieces placed around the anchor | | |


## Added in the merge (do these on a real phone)
| Check | Pass when | Android | iPhone |
|---|---|---|---|
| Product page → **360° view** | The shape turns by itself, is photo-wrapped, can be dragged; "Photos" tab shows the gallery | | |
| Product page → **View in my room** | Camera opens, "Floor found. Placing …" and the piece appears at the dot after ~1 s | | |
| Scan room: mark 4 corners, Done | Yellow corners and outline sit on the wall-floor lines; width/depth within 3 % of a tape | | |
| Save after a scan, restart, re-scan from the same corner, open the design | Pieces return within ~5 cm | | |
| Save a design | A thumbnail appears on its card (and is not in the gallery) | | |
| Share (signed in) → WhatsApp | Preview card shows the photo; link opens the app, or the web page on a phone without it | | |
| Sample room in AR with a scan | Room is centred and aligned; "Bigger than your room" prompt when too large | | |
| Phone without AR (or Expo Go) | "Plan my room" in onboarding, "Plan view" on products, Saved cards show only Plan | | |
| Plan view: drag, two-finger pan/zoom, rotate, undo/redo | Smooth; 5 cm steps; red outline when pieces overlap | | |
| Plan → Open in AR / AR → Plan | Same pieces, same spacing | | |
| Screen reader on Plan view | Each piece row reads "Sofa, 202 by 89 cm, 45 cm from the north wall"; swipe actions move/turn it | | |
| 30 pieces in AR | 31st is refused with a message; 10+ pieces: note fps (should stay above 30 in High, otherwise auto-drops to Standard and says so) | | |
| Library scroll (700 items) | Smooth (aim for 60 fps on a mid-range phone) | | |
| Dark mode | Set the phone to dark, reopen the app: all text readable, AR overlays unchanged (the theme is read at launch) | | |
| Text size at 200 % | No clipped buttons or labels | | |
| Hindi | Set the phone to Hindi: screens show Hindi (machine translation, mark anything odd) | | |
| Sign up / verify / reset / Google / Apple | See docs/AUTH.md | | |
| Airplane mode | Offline banner; designs still open; changes sync when back online | | |

Automated: `npm run check` (types, lint, logic tests, component tests), `cd server && npm test`, `cd admin && npm test && npm run build`.
UI flows without AR: `.maestro/` (needs a phone or emulator).
