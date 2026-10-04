# Real 3D models (runs in parallel from step 05 onward)

The app works without models: every product is a true-size proxy shape. Real models make it look like the product.
This is mostly sourcing work, not coding. The tooling exists: `scripts/publish-models.mjs`,
`scripts/validate-models.mjs`, and the admin model review page (step 13).

## Your part
1. Ask HomeTown or its suppliers for CAD/3D files (FBX, OBJ, GLB, SKP, 3DS) for the products in the sample rooms
   first. This is the fastest and most accurate source.
2. Otherwise hire a 3D artist or studio, or use an image-to-3D service with artist clean-up. Give them this spec:
   - GLB (glTF 2.0 binary), metres, Y up, **front faces +z**, origin at the centre of the floor footprint, base at y=0
   - Real size from our catalogue (W × D × H cm) within ±2 %
   - ≤ 50k triangles, textures ≤ 1024 px (PBR: base colour, normal, roughness/metal), file ≤ 8 MB
   - One model per shape; colour variants as separate material sets
   - No Draco/meshopt compression until we confirm Viro loads it
3. Order of work: products in the sample rooms → whole collections → top sellers (sofas, beds, wardrobes) → the rest.

## Prompt for Claude when files arrive
```
Read CLAUDE.md. I put new GLB files in models/raw/<product id>.glb.
Run publish-models for them, show me the OK/REVIEW report, fix only what is
mechanical (orientation if rotated 90/180°, units if 100× off) and re-run.
Do not change catalogue sizes to match a model. Upload approved files with the
step-09 storage flow (or the admin dashboard), then run validate:models.
```


## Making models from the product photos (built in)
`scripts/image-to-3d.mjs` sends each product's photo to an image-to-3D service (Meshy is wired in), downloads the GLB, scales it to the listed
height, stands it on the floor, centres it, shrinks textures, and reports OK or REVIEW (width/depth within 10 % of the listed size).
```bash
MESHY_API_KEY=... npm run models:from-photos -- --next 5          # shows the plan, spends nothing
MESHY_API_KEY=... npm run models:from-photos -- --next 5 --yes    # generates (uses credits)
npm run models:from-photos -- --normalise --yaw 90                 # a model faces sideways: turn it and re-check
```
It starts with the products used in the sample rooms, then sofas, beds and wardrobes. Task ids are saved so an interrupted run never pays twice.
**What to expect:** one photo gives a plausible model with an invented back and sides; chairs sold as a set may come out as two chairs; proportions can be off (those go to REVIEW).
Always review each model next to its photos in the admin dashboard (3D models, Upload for review) and reject the ones that look wrong. The service call follows
the public docs but was not run against the live service from here: generate one model first and check it.
