# Step 06 — One recommendation engine

Read `CLAUDE.md` first. This is step 06. Do only this step.

## Read first
- `reference/furniar/src/recommend/engine.ts` and the recommender part of `reference/furniar/scripts/rooms.test.ts`
- `src/utils/recommend.ts` (HTRD: PAIRS, styleScore, completeLook, alternatives, colourVariants, starter layouts)

## Tasks
1. Create `src/recommend/engine.ts` from FurniAR's engine (role quotas per room type, hard filters, weighted score,
   reasons, max 2 per role, deterministic) and extend the score with HTRD's signals:
   - +0.15 if the candidate is in the anchor's HomeTown `related` list ("Recommended by HomeTown with your sofa")
   - material match (HTRD `styleScore`) folded into the style term
   - space filter uses the scanned room's free area (`fitsRoom` + 55 % walk share) and, when known, the longest
     free wall for wide pieces
   - exclude `sizeReview`, demo items (unless no real item fits) and wall-only items from floor roles; wall-art gets its
     own quota per room type (living 2, bedroom 1, dining 1, study 1) and is only suggested once a wall is marked
   Re-tune weights so they still sum to 1 and document them at the top of the file.
2. Keep HTRD's helpers but move them into `src/recommend/`: `alternatives` (Swap), `colourVariants` (Option),
   `buildStarter`/`layoutFromSlots`. Delete `src/utils/recommend.ts` when nothing imports it.
3. **UI.** AR sheet "Suggested" tab: horizontal cards (photo, short name, size, first reason). Tapping selects the
   product for placing. When a piece is selected, its chips show Option / Swap / Pairs with it. Library header shows
   "Good starting pieces for your <room>" (FurniAR HomeScreen) from the engine with no placed items.
4. **AI layout** (server) stays; when it returns, show each slot's `why` as the reason.
5. Tests `scripts/recommend.test.ts`: port FurniAR's cases + new ones (related boost, wall-art needs a wall, demo
   fallback, free-area filter with a scanned room, determinism, real catalogue gives ≥ 3 suggestions for each room
   type after placing its anchor).

## Done when
`npm run check` passes. Print the top 5 suggestions with reasons for a placed 3-seater sofa in a 16 m² living room
and for a queen bed in a 12 m² bedroom, from the real catalogue.
