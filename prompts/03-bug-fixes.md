# Step 03 — Fix the known bugs

Read `CLAUDE.md` first. This is step 03. Do only this step. For every fix that can be tested off-device, add a
regression test (unit test in `scripts/` or API test in `server/test/`).

1. **Server shrinks the catalogue.** `fetchProducts` calls `/products?limit=100` once and the store replaces the
   bundled 681 items with 100 (beds and wall pieces vanish). Fix now (step 09 replaces this with delta sync):
   page through `offset` until `total` is reached, and only replace the bundled list if the full set arrived.
   Server test: seeding 681 products and paging returns all 681.
2. **Crash in AR model error handler.** `onError` in the AR scene reads `product.model3D!.url`; proxies have no
   `model3D`. Log `model3D?.url ?? proxy key`, and show a small "Couldn't load this piece" message with a Remove button (don't delete it silently).
3. **Admin by email at sign-up.** Remove granting `admin` during `/auth/register`. Add `server/scripts/make-admin.mjs
   <email>` (CLI) that sets the role in the DB. `ADMIN_EMAILS` is removed from env and docs. Test: registering with
   a former admin email gives role `user`.
4. **Deleted designs come back after sync.** Add a persisted `pendingOps` queue in `roomStore`
   (`{type:'delete'|'rename', cloudId, name?}`). Cloud calls that fail are queued; `syncDesigns` replays the queue first
   and skips downloading ids that have a pending delete. Unit test the sync logic with a fake API.
5. **Shadows only near the first piece.** Centre the shadow camera on the bounding box of all floor items and size
   `shadowOrthographicSize` to cover it (min 4 m, max 10 m). Put the maths in `src/utils/shadow.ts` with a test.
6. **Docs disagree.** `TESTING.md` says pinch is 0.3–3×; code is 0.8–1.25×. Fix the doc.
7. **Cleartext traffic.** Make `usesCleartextTraffic` true only when `APP_ENV=development` via `app.config.js`.
8. **Token storage.** Install `expo-secure-store`; store the JWT there instead of AsyncStorage (keep email in
   AsyncStorage). Migrate an existing token once on startup.
9. **AI cost limit.** Per-user rate limit on `/layout/suggest`: 20 per day and 5 per minute, 429 with a friendly
   message. Test it.
10. **Slow product queries.** `/products` parses the whole table per request and `/designs` POST loads every product
    id. Use `SELECT … WHERE id IN (…)` for the design check and SQL `WHERE category = ?` for filters. Test unchanged.
11. **Model URLs tied to one host.** Store `model3D.key` (e.g. `models/<id>-v2.glb`) and build the URL at read time
    from `PUBLIC_URL` (later the CDN base). Migrate existing rows on startup. Test: changing `PUBLIC_URL` changes URLs.
12. **Large AsyncStorage values.** The catalogue cache is ~660 KB as one value. Move the catalogue cache to a file
    with `expo-file-system` (write JSON to `documentDirectory`), keep only `{source, version}` in AsyncStorage.

## Done when
All checks pass; list each bug with "fixed + test name" or "fixed, needs phone check".
