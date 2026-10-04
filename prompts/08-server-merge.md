# Step 08 — One server with every endpoint

Read `CLAUDE.md` first. This is step 08. Do only this step. Stay on SQLite for now; step 09 moves to Postgres.

## Read first
`server/src/*`, `server/test/api.test.mjs`, `reference/furniar/server/src/*`, `reference/furniar/server/test/api.test.mjs`.

## Tasks
1. **Structure.** Split `server/src/app.mjs` into routers: `routes/auth.mjs`, `me.mjs`, `catalogue.mjs`,
   `designs.mjs`, `wishlist.mjs`, `events.mjs`, `layout.mjs`, `admin.mjs`, `rooms.mjs`; `middleware/auth.mjs`,
   `middleware/errors.mjs`; `lib/glb.mjs`. Mount everything under `/v1` and keep the old unversioned paths as aliases
   until the app is switched (then remove them).
2. **Port from FurniAR:** wishlist (GET, PUT /:productId, DELETE /:productId), `/events` (allow-list = the event names
   from step 07, flat props, 50 per batch, rate limit), `role` and `roomType` product filters, admin create of a product
   WITHOUT a GLB (modelStatus 'proxy'), `tx` helper. Keep HTRD's AI layout, `/admin` page, design rename,
   partial PUT that never blanks fields.
3. **New endpoints:** `GET /v1/rooms` (curated rooms from a `sample_rooms` table seeded from `rooms.json`),
   `GET /v1/catalogue?since=<version>` returning `{version, products:[changed], removed:[ids]}` with ETag + gzip
   (`compression` middleware), and a `catalogue_versions` bump on every admin product change.
4. **Design fields.** Designs get `updatedAt`, `deletedAt` (soft delete), `thumbnailKey?`, `roomType`, `frame`,
   `cloudAnchorId`, `scan?` (`{widthCm, depthCm, areaM2}`). `GET /v1/designs?since=<ms>` returns changed + deleted.
   `PATCH` accepts name and items (full replace) with `updatedAt` guard (409 if stale).
5. **Request hygiene:** request id + pino logging (no bodies, no tokens), `helmet`, CORS allow-list from env,
   global rate limit, 1 MB JSON limit, graceful shutdown, `/health` and `/ready` (DB check).
6. **Config:** `server/src/config.mjs` reads and validates env with zod (PORT, JWT_SECRET (required in prod),
   PUBLIC_URL, CORS_ORIGINS, ANTHROPIC_API_KEY?, LAYOUT_MODEL, DB_FILE). Update `server/.env.example`.
7. **App switch:** `src/services/api.ts` uses `/v1/*`, uses the catalogue delta endpoint (replacing the step-03 paging),
   and stores the catalogue version.
8. **Tests:** merge both test suites (all 15 existing cases) + new ones for rooms, catalogue delta, design
   since/soft-delete/409, events allow-list, wishlist. Remove the old aliases at the end once tests use `/v1`.
9. **OpenAPI:** write `server/openapi.yaml` describing every route (used by the admin dashboard in step 13).

## Done when
Server tests all pass (list count), app typecheck passes, `docs/API.md` lists every endpoint with auth requirement.
