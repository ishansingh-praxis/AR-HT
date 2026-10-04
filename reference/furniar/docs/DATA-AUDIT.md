# HomeTown data audit (HT_Data_dump.csv)

Shopify product export, 40,856 rows. One product spans several rows (one per variant or image); product-level
fields sit on the first row of each handle. Re-run with `npm run data:import -- <csv>`.

## What's in it

| Measure | Count |
|---|---|
| Rows | 40,856 |
| Products (unique handles) | 5,505 |
| Status: active / unlisted / draft / archived | 2,033 / 2,433 / 841 / 198 |
| Active products that are furniture (have a role) | 615 (the rest are decor, kitchen, bedding, bath) |
| **AR candidates**: active, furniture role, complete dimensions, image | **536** |
| Distinct 3D shapes needed for them (collection + role + dimensions) | **395** (colour variants share a shape) |
| Collections with 3+ furniture pieces (e.g. Nova, Oren) | 74 |
| Products with a 3D model, GLB, USDZ or AR field | **0** |

AR candidates by role: sofa 200, storage 95, chair 63, wardrobe 49, bed 44, dining table 26, side table 25,
coffee table 17, desk 13, TV unit 4. **There are no rugs or floor lamps** among active products.

## Data problems found (and what the importer does)

1. **Mixed units.** `2290`, `470 MM`, `63.5 CM`, `Lift Up 1050 | Lift Down 940`. The importer converts to cm.
   Bare numbers are guessed (>= 300 means mm, else cm) and marked `dimsConfidence: low` when the guess is uncertain
   (35 of the 536 candidates). Adjustable-height strings are rejected.
2. **Inconsistent labels.** Length, width and depth are used interchangeably. The footprint is taken as the two
   largest horizontal values. Beds are re-oriented head-to-foot along z.
3. **Conflicting variants.** The "Charm Velvet Accent Chair" is 99 x 69 x 106 in grey and 99 x 99 x 106 in blue.
   A human must confirm sizes before they become 3D scale targets. Low-confidence items are flagged in the app.
4. **Missing heights.** Office chairs have footprint but no height, so they can't be shown as boxes. The study
   sample room uses a dining chair instead (noted in the room).
5. **Unusable style field.** `furniture_style` is 11% filled and holds merchandising labels ("Assortment", "Best
   Seller"). Styles in this app are hand-assigned per curated room until a real style taxonomy exists.
6. **Recommendation fields are empty.** `Complementary products` and `Style this product` are 0% filled.
   `Linked Products` (30%) links colour variants and left/right-hand versions, which is useful for "other colours"
   but is not a "goes with" signal. **Collection (the first word of the title) is the best real pairing signal**,
   and the recommendation engine uses it ("Same Nova collection").
7. **Colour is sparse.** `Color Family` is 29% filled; the importer maps it to a representative hex. Replace this
   with colours measured from the 3D textures once models exist.

## Decisions

- The app bundle holds only curated products (16 now) plus 4 demo GLB models. The full normalised catalogue
  (8.5 MB JSON, 5,505 products) is a server-side asset, not shipped in the app.
- Products without a GLB are shown in AR as a box at their exact size. This is enough to judge fit and layout,
  and is clearly labelled as a stand-in.
- Prices are carried as reference only. The app has no cart or checkout.
