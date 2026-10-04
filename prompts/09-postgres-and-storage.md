# Step 09 — Postgres, migrations, cloud file storage

Read `CLAUDE.md` first. This is step 09. Do only this step.

## Goal
Production-grade data layer: Postgres with real columns, migrations, and GLB/image/thumbnail files in S3-compatible
storage (AWS S3 or Cloudflare R2) behind a CDN. Local development uses Docker.

## Tasks
1. **Docker for dev:** `server/docker-compose.yml` with Postgres 16 and MinIO (S3-compatible). `npm run dev:up`.
2. **ORM + migrations:** use Drizzle ORM (`drizzle-orm`, `drizzle-kit`, `pg`). Schema in `server/src/db/schema.mjs`
   (or `.ts` with tsx) with these tables:
   `users(id uuid, email citext unique, name, password_hash null, email_verified_at, role, created_at)`,
   `auth_identities(user_id, provider, subject)`, `refresh_tokens(id, user_id, token_hash, expires_at, revoked_at,
   user_agent)`, `products(id text pk, sku, name, category, role, subcategory, brand, material, color_family,
   colors jsonb, family, collection, w_cm, d_cm, h_cm, dims_confidence, size_review, placements text[],
   room_types text[], styles text[], images text[], retailer_url, price_inr, compare_at_inr, set_size, proxy jsonb,
   demo bool, status, updated_at)`, `product_links(product_id, other_id, kind)`,
   `models(id, product_id, version, glb_key, usdz_key, size_mb, w_cm, d_cm, h_cm, status, report jsonb,
   reviewed_by, created_at)`, `designs(id uuid, user_id, name, room_type, frame, cloud_anchor_id, scan jsonb,
   items jsonb, thumbnail_key, share_slug unique, updated_at, deleted_at, created_at)`, `wishlist`, `events`,
   `sample_rooms`, `catalogue_versions`, `audit_log(actor_id, action, target, at, data jsonb)`.
   Indexes: products(category), products(role), GIN(room_types), designs(user_id, updated_at), events(name, ts).
3. **Repository layer:** `server/src/repos/*.mjs` so routes never write SQL directly. Port every route to it.
   Delete `node:sqlite` code. Keep a `seed` script that loads `src/data/catalogue.json` and `rooms.json`.
4. **Storage:** `server/src/lib/storage.mjs` with `putObject`, `getSignedUploadUrl`, `publicUrl(key)` using
   `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`; env `S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY,
   S3_SECRET_KEY, CDN_BASE_URL`. Admin model upload becomes: request signed URL → client uploads → `POST
   /v1/admin/models/:productId/validate` downloads from storage, runs `checkGlb`, creates a `models` row and bumps the
   catalogue version. Files are immutable (`<id>-v<n>.glb`), served from `CDN_BASE_URL`.
5. **Tests:** run against a disposable Postgres (testcontainers or the compose DB with a per-run schema) and MinIO.
   All step-08 tests must pass unchanged in behaviour.
6. **Deploy config:** `server/Dockerfile` (node:22-slim, non-root), `server/render.yaml` (or `fly.toml`) for API +
   managed Postgres; document R2/S3 bucket + CDN setup in `docs/DEPLOY.md` (bucket policy, CORS for uploads,
   cache headers `immutable`, 1-year max-age for versioned files).

## Done when
`npm run dev:up && npm run migrate && npm run seed && npm test` passes in `server/`. `docs/DEPLOY.md` lets me deploy
staging by following it.
