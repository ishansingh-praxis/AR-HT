# Step 02 — One product model, one importer

Read `CLAUDE.md` first. This is step 02. Do only this step.

## Goal
Every product carries the fields BOTH apps need, produced by ONE Node importer, so later steps (sample rooms,
recommendations, wishlist) have the data they expect.

## Read first
- `src/types/furniture.ts` (HTRD) and `reference/furniar/src/types/furniture.ts`
- `scripts/build_catalogue.py` (HTRD importer: categories, bed-height fix, plausibility checks, wall decor, linked/related)
- `reference/furniar/scripts/hometown/normalize.mjs` (unit parser with ambiguity flag, role rules, colour → hex, price, weight)
- `reference/furniar/scripts/build-rooms.mjs` (family = collection name, canonical orientation, setSize)
- `reference/furniar/docs/DATA-AUDIT.md`

## Tasks
1. **Unified type** in `src/types/furniture.ts`. Keep every HTRD field and add the FurniAR ones:
   `role: Role` (sofa, bed, chair, coffee-table, side-table, dining-table, desk, tv-unit, wardrobe, storage, rug, lamp,
   decor, wall-art), `roomTypes: RoomType[]` (living, bedroom, dining, study, other), `styles: string[]`,
   `dimsConfidence: 'high'|'low'`, `setSize?`, `weightKg?`, `sku?`, `priceInr?`, `compareAtInr?`,
   `colors` (always an array, at least one `{name, hex}` when a colour family is known), `collection?`
   (FurniAR's "family" = first word of title shared by 3+ products; keep HTRD's `family` too, it is the variant group).
   Keep `category` (Sofa/Bed/Wardrobe/Chair/Table/Storage/Wall) because proxies and the UI use it.
   Define `RoomType` and `Role` here and export label maps `ROLE_LABEL`, `ROOM_LABEL`.
2. **One importer in Node**: `scripts/import-catalogue.mjs` (uses `csv-parse`, move it to devDependencies). Port ALL
   of `build_catalogue.py`'s rules (active only, furniture categories, mattress exclusion, unit parsing, height-in-length
   cleanup, bed fix 70–150 cm, `size_flag` plausibility checks → `sizeReview`, wall decor import with thickness rules,
   linked/related kept only when the target exists, existing entries with `model3D` preserved). Merge in FurniAR's
   `parseMm` ambiguity → `dimsConfidence`, `roleFor` rules, `hexForColor`, prices, weight, collection, setSize.
   Derive `roomTypes` from role (sofa/coffee-table/tv-unit → living; bed/wardrobe → bedroom; dining-table → dining;
   desk → study; chair/side-table/storage → several) and HomeTown's own category field.
   Outputs: `src/data/catalogue.json`, `scripts/data_issues.json`, `scripts/size_review.csv`. Usage:
   `npm run build:catalogue -- data/HT_Data_dump.csv`. Delete `build_catalogue.py` after parity is confirmed.
3. **Upgrade without the CSV.** I may not have the CSV. Write `scripts/upgrade-catalogue.mjs` that adds the new fields
   to the existing `src/data/catalogue.json` (role from category/subcategory/name with the same rules, roomTypes,
   colors from colorFamily, dimsConfidence 'high' unless sizeReview, collection from names). Run it now and commit the
   result. Then run `npm run build:proxies` so proxies and `proxyAssets.ts` stay in sync.
4. **Shared importer helpers** live in `scripts/lib/catalogue-rules.mjs` with unit tests in
   `scripts/catalogue.test.ts`: unit parsing ("470 MM", "63.5 CM", "2290", "Lift Up 1050 | Lift Down 940"), bed fix,
   each plausibility rule, role rules (at least 15 real product names), colour mapping.
5. **Catalogue store.** Bump `catalogueStore` persist `version` to 3 with a migration that resets to the bundled file.
6. Update every screen/util that reads products so typecheck passes (e.g. `colors` is now always an array).

## Done when
- `npm run check` and server tests pass; new catalogue tests pass.
- Print counts: products by category and by role, placeable count (should stay ~670), sizeReview count, items with
  `collection`. Tell me if any number changed from before and why.
