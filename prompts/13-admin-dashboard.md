# Step 13 — Admin dashboard (web)

Read `CLAUDE.md` first. This is step 13. Do only this step.

## Goal
Replace `server/public/admin.html` with a real web dashboard in `admin/` (Vite + React + TypeScript +
TanStack Query + React Router; plain CSS or Tailwind). Talks only to `/v1` (types from `server/openapi.yaml` via
`openapi-typescript`). Sign-in with the same accounts; only `editor`/`admin` roles get in.

## Pages
1. **Products:** searchable, filterable table (category, role, model status, size review, confidence). Edit page
   with every field; size fields show the plausibility warnings live (reuse `scripts/lib/catalogue-rules.mjs` logic,
   moved to a shared package `shared/` importable by app, server and admin). "Mark size checked" clears `sizeReview`
   and sets `dimsConfidence: high` (audit logged). Bulk import: upload the Shopify CSV → server runs the step-02
   importer in a job → shows a diff (added / changed / removed / flagged) → Publish bumps the catalogue version.
2. **3D models:** per product: upload GLB (signed URL, step 09) → validation report (size per axis, origin, floor,
   MB, triangle count, texture sizes) → side-by-side review: product photos | `<model-viewer>` with a 1 m reference
   cube and the listed dimensions drawn as a box → Approve (publishes, bumps version) / Reject with reason.
   Queue view: "needs model", "awaiting review", "rejected". Shape groups: products sharing collection+role+size so
   one model can be reused with a colour swap.
3. **Sample rooms:** list + editor: drag pieces on the to-scale plan (shared `planSvg` + pointer drag), rotate 90°,
   pick products by search; live integrity checks from step 05 (overlap, outside room, awkward gaps); Publish.
4. **Users:** search, role change (admin only), disable account, delete. Audit log viewer.
5. **Analytics:** daily active devices, AR sessions, scan success rate, placements, top placed products,
   recommendation placed rate (rec_placed / rec_shown), from `events` with SQL views (`server` adds
   `GET /v1/admin/stats?from&to`).
6. **Deploy:** build to static files served by the API at `/admin` (or a separate static host). Document it.

## Done when
`cd admin && npm run build` passes, `npm run typecheck` passes, server tests for new admin endpoints pass.
