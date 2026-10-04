# Project plan (AR-only app on the HomeTown catalogue)

## Where we are
Built and tested: front page, product library, 4 curated sample rooms from real products, room scan by marked
corners, layout placement aligned to scanned walls, to-scale boxes for products without 3D, collision, fit check,
recommendation engine v1, backend (auth, catalogue, wishlist, designs, events, admin upload with GLB size validation).
**Not yet seen on a real device: all AR behaviour.** See TESTING.md.

## The real bottleneck: 3D models
395 distinct shapes for the 536 AR-ready products, with a long tail (288 shapes to cover 80%).
Nothing in the export has a model. Plan for a pipeline, not a modelling batch:

```
product photos (6 per product) + listed dimensions
  -> image/multi-view-to-3D generation (or manufacturer CAD where available)
  -> normalise: orientation (front = +z), origin at floor centre, scale from listed dimensions
  -> reject if proportions disagree with the listed dimensions by > 8%
  -> compress (Draco/meshopt), cap textures, cap triangles
  -> human review against the photos, then test in AR
  -> publish (model + validation report stored with the product)
```
Rules: size always comes from product data, never from the generator. Generated back/sides are guesses, so a
human signs off every model. One model per shape; colours/materials are swaps on top.

**Order of work:** (1) the 14 shapes in the four sample rooms, because rooms look complete; (2) whole collections
(74 have 3+ pieces) so the recommender can complete a set; (3) sofas, beds, wardrobes by listing count; (4) the tail.

## Phases
| Phase | Weeks | Exit test |
|---|---|---|
| 0. Device test + data sign-off | 2 | TESTING.md passes on 1 ARCore + 1 ARKit phone; a person confirms sizes for the curated products |
| 1. 3D pipeline + first 14 models | 4-6 | Four sample rooms show real models at true size; validator green |
| 2. Scan quality | 3-4 | Tape-measure test: corner scan within 3% on 10 real rooms; add door/window marking and wall-clearance rules |
| 3. Models at scale | 8-12 | 120+ shapes live (full collections first) |
| 4. Realism + walls | 4-6 | Shadows/occlusion judged on device; wall items need a wall-mountable product set |
| 5. Persistence + sharing | 4 | Saved room reopens aligned (anchors), shareable image/link |
| 6. Learned recommendations | after launch | Needs real usage; events are already collected |
| 7. Beta + release | 4-5 | Crash-free sessions > 99%, store submissions |

## Camera room analysis roadmap
Done: measure the floor outline by marking corners (area, long/short side, irregular-room warning).
Next: mark doors and windows so layouts keep entrances clear; ceiling height; walls as obstacles.
Later, opt-in only: photo-based style and colour reading. This needs a cloud vision model, so it must be a
separate consent step and must never send frames by default.

## Risks
- **Model supply and accuracy** dominates cost and schedule.
- **Source data sizes are unreliable** (conflicting variants, guessed units). Human sign-off is required.
- **Phone tracking drift** limits scan accuracy; always show scans as estimates.
- **ViroReact is a dependency we don't control.** Keep AR behind one screen/interface so a native module can replace it.
