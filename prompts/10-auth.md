# Step 10 — Production authentication

Read `CLAUDE.md` first. This is step 10. Do only this step (server only; app screens are step 11).

## Tasks
1. **Tokens:** access JWT 15 min (`sub`, `role`), refresh token 30 days, random 256-bit, stored hashed in
   `refresh_tokens`, rotated on every `/v1/auth/refresh`; reuse of a revoked token revokes the whole family.
   `/v1/auth/logout` revokes the current token; `/v1/auth/logout-all` revokes all.
2. **Passwords:** argon2id (`argon2`) for new hashes; verify old bcrypt hashes and re-hash on login. Min 8 chars,
   reject the 10k most common passwords (bundle a list). Lock the account 15 min after 10 failed logins.
3. **Email verification + reset:** `POST /v1/auth/verify-email/request`, `POST /v1/auth/verify-email/confirm`
   (6-digit code, 15 min, 5 tries), `POST /v1/auth/password/forgot`, `POST /v1/auth/password/reset` (code + new
   password; revokes all refresh tokens). Email via a provider adapter `lib/mailer.mjs` (Resend or SES; console in dev).
   Unverified users can save designs but cloud sync shows a "verify your email" banner.
4. **Social sign-in:** `POST /v1/auth/google` (verify ID token with `google-auth-library` against our client ids) and
   `POST /v1/auth/apple` (verify identity token with Apple's JWKS via `jose`; handle the private-relay email and
   name-only-on-first-login). Link to an existing account only when the provider email is verified and matches.
5. **Account:** `GET/PATCH /v1/me` (name), `DELETE /v1/me` deletes designs, wishlist, thumbnails in storage, identities,
   tokens; returns 204. Web page `/account/delete` (for the Play Store requirement) that signs in and deletes.
6. **Roles:** `user`, `editor` (products, rooms), `admin` (everything + users). Middleware `requireRole(...)`. Every
   admin/editor write goes to `audit_log`. CLI `make-admin` from step 03 stays.
7. **Rate limits:** per IP and per email on login, register, forgot, verify.
8. **Tests:** every flow above incl. refresh rotation + reuse detection, lockout, reset revokes tokens, Google/Apple
   with mocked verifiers, account deletion removes storage objects (MinIO).

## Done when
Server tests pass. `docs/AUTH.md` explains the flows, env vars (GOOGLE_CLIENT_IDS, APPLE_BUNDLE_ID, APPLE_SERVICE_ID,
MAIL_*), and what I must set up in Google Cloud Console and Apple Developer.
