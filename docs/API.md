# API

Generated from the live route table by `npm run openapi` (in `server/`), together with [`server/openapi.yaml`](../server/openapi.yaml). Do not edit by hand.
Everything is under `/v1` unless it is a public page. Errors are `{ "error": "message", "details": [...] }`. "editor" routes also accept admins.

| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/health` | public | Process is up |
| GET | `/ready` | public | Database answers |
| POST | `/v1/auth/register` | public | Create an account; sends a verification code |
| POST | `/v1/auth/login` | public | Sign in with email and password (10 wrong tries lock for 15 minutes) |
| POST | `/v1/auth/refresh` | public | Swap a refresh token for a new pair (rotation; reuse revokes the family) |
| POST | `/v1/auth/logout` | public | Revoke one refresh token |
| POST | `/v1/auth/logout-all` | signed in | Revoke every session of the signed-in user |
| POST | `/v1/auth/verify-email/request` | signed in | Email a new 6-digit code |
| POST | `/v1/auth/verify-email/confirm` | signed in | Confirm the email with the code |
| POST | `/v1/auth/password/forgot` | public | Email a reset code (always 200) |
| POST | `/v1/auth/password/reset` | public | Set a new password with the code; revokes all sessions |
| POST | `/v1/auth/google` | public | Sign in with a Google ID token |
| POST | `/v1/auth/apple` | public | Sign in with an Apple identity token |
| GET | `/v1/me` | signed in | The signed-in user |
| PATCH | `/v1/me` | signed in | Change the display name |
| DELETE | `/v1/me` | signed in | Delete the account and everything tied to it |
| GET | `/v1/wishlist` | signed in | Saved furniture |
| PUT | `/v1/wishlist/{productId}` | signed in | Save a product (idempotent) |
| DELETE | `/v1/wishlist/{productId}` | signed in | Remove a saved product (idempotent) |
| GET | `/v1/designs` | signed in | The user's designs; with ?since=<ms> only what changed plus deleted ids |
| POST | `/v1/designs` | signed in | Create a design (idempotent per clientId) |
| GET | `/v1/designs/{id}` | signed in | One design |
| PATCH | `/v1/designs/{id}` | signed in | Rename and/or replace items; a stale updatedAt is 409 |
| DELETE | `/v1/designs/{id}` | signed in | Soft delete (other devices learn through ?since) |
| POST | `/v1/events` | public | Anonymous usage events (batches of up to 50) |
| POST | `/v1/layout/suggest` | signed in | AI layout suggestions (20/day, 5/minute per user) |
| GET | `/v1/rooms` | public | Curated sample rooms |
| POST | `/v1/admin/products` | editor | Create a product, optionally with a GLB (multipart: product JSON + model) |
| PUT | `/v1/admin/products/{id}` | editor | Partial update; only fields sent are changed |
| DELETE | `/v1/admin/products/{id}` | editor | Delete a product (apps learn through the catalogue delta) |
| POST | `/v1/admin/models/{productId}/upload-url` | editor | Signed PUT link for the next model version |
| POST | `/v1/admin/models/{productId}/validate` | editor | Validate an uploaded GLB; review:true waits for approval |
| GET | `/v1/admin/models/{productId}` | editor | Uploaded model versions |
| GET | `/v1/admin/audit` | admin | Audit log of admin and editor writes |
| GET | `/v1/admin/users` | admin | Search users |
| PATCH | `/v1/admin/users/{id}` | admin | Change role or disable/enable a user |
| DELETE | `/v1/admin/users/{id}` | admin | Delete a user and their data |
| POST | `/v1/admin/products/{id}/size-checked` | editor | Mark a flagged size as checked (clears sizeReview) |
| POST | `/v1/admin/import` | editor | Upload the Shopify CSV; returns the diff (multipart "file") |
| POST | `/v1/admin/import/{id}/publish` | editor | Apply an import; removeMissing also removes products absent from the file |
| GET | `/v1/admin/models-queue` | editor | Needs model / awaiting review / rejected |
| POST | `/v1/admin/models/{productId}/{version}/approve` | editor | Publish a pending model |
| POST | `/v1/admin/models/{productId}/{version}/reject` | editor | Reject a pending model with a reason |
| POST | `/v1/admin/rooms/check` | editor | Run the integrity checks without saving |
| PUT | `/v1/admin/rooms/{id}` | editor | Create or update a room; refused (422) when it fails the checks |
| DELETE | `/v1/admin/rooms/{id}` | editor | Delete a room |
| GET | `/v1/admin/rooms` | editor | Sample rooms (editor view) |
| GET | `/v1/admin/stats` | editor | Usage statistics from anonymous events |
| PUT | `/v1/uploads/{token}` | public | Upload raw bytes to a signed link |
| POST | `/v1/designs/{id}/share` | signed in | Create (or return) the share link |
| DELETE | `/v1/designs/{id}/share` | signed in | Revoke the share link |
| POST | `/v1/thumbnails/upload-url` | signed in | Signed PUT link for a design thumbnail |
| GET | `/v1/shared/{slug}` | public | A shared design (public, no personal data) |
| GET | `/v1/categories` | public | Product categories with counts |
| GET | `/v1/products` | public | Products; filters category, role, roomType, q; paged with limit/offset |
| GET | `/v1/products/{id}` | public | One product |
| GET | `/v1/catalogue` | public | Delta sync: what changed since a catalogue version (ETag, gzip) |
| GET | `/account/delete` | public | Public page to delete an account (Play Store requirement) |
| GET | `/d/{slug}` | public | Public share page (HTML) |
| GET | `/.well-known/apple-app-site-association` | public | iOS universal links file |
| GET | `/.well-known/assetlinks.json` | public | Android app links file |
