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
| 7 | Pinch | Resizes smoothly, clamped 0.3x–3x, no jump when a second finger lands | | |
| 8 | Twist | Rotates about its vertical axis, no jump at gesture start | | |
| 9 | Rotate/Delete buttons | 15° steps; delete removes only the selected piece | | |
| 10 | Multiple pieces | Place 5; frame rate stays smooth; no crash | | |
| 11 | Collision | Overlapping pieces turn red; separating them clears it. Outline matches the real footprint | | |
| 12 | Shadows | A soft shadow appears under each piece | | |
| 13 | Depth occlusion | Toggle on: a real object in front hides the model. Note any lag | | |
| 14 | Lighting | Model brightness roughly follows the room; no flicker | | |
| 15 | Screenshot | "Take photo" saves to the gallery and includes the furniture | | |
| 18 | Room scan | Mark 4 corners of a room you've measured with a tape: width and depth within ~3% | | |
| 19 | Scan outline | Yellow outline sits on the real wall/floor lines, not floating | | |
| 20 | Sample room, scanned | Layout is centred, wall-aligned, nothing pokes through a wall | | |
| 21 | Sample room, unscanned | Anchor piece lands at the dot; "Turn layout 90°" rotates the whole group | | |
| 22 | To-scale boxes | Box sofa matches a tape measure on the real sofa size; label readable, faces camera | | |
| 23 | Suggestions | "Suggested" list changes as you place pieces; reasons make sense | | |
| 16 | Save / reopen | Design appears in Saved, reopens around the tapped point with the same layout | | |
| 17 | Backgrounding | Switch apps and come back: AR resumes without crashing | | |

If the model is huge, tiny, sideways or sunk into the floor, run `npm run validate:models`; it usually
means the GLB's units, orientation or origin are wrong.
