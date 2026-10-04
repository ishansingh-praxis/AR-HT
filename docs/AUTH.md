# Authentication

All routes are under `/v1/auth`. Every response that signs a user in returns:
`{ token, accessToken, refreshToken, expiresIn, user }` (`token` is the same as `accessToken`, kept for older app builds).

## Tokens
- **Access token**: JWT, 15 minutes, claims `sub` (user id) and `role`. Sent as `Authorization: Bearer …`.
- **Refresh token**: 256-bit random, 30 days, stored only as a SHA-256 hash in `refresh_tokens`. `POST /refresh` swaps it for a new pair and
  revokes the old one. If an **already-used** token is presented again (a copy was stolen), every token from that login ("family") is revoked.
- `POST /logout {refreshToken}` revokes one session. `POST /logout-all` (signed in) revokes all of them.

## Passwords
- Hashed with **scrypt** (N=2^15, r=8, p=1, per-password salt; built into Node, no native build). The prompt suggested argon2id;
  scrypt gives the same class of memory-hard protection without a native dependency. Old bcrypt hashes still verify and are re-hashed at next login.
- Minimum 8 characters, rejected if in the bundled common-password list (`server/src/lib/common-passwords.txt`, the 8+ character entries from SecLists' 10k list)
  or if it contains the part of the email before the `@`.
- **Lockout**: 10 wrong passwords lock the account for 15 minutes (`429`). A reset clears the lock.
- Rate limits per IP and per email on register, login, forgot, reset. Unknown email and wrong password give the same `401` message.

## Email verification and reset
| Route | Auth | Body |
|---|---|---|
| `POST /verify-email/request` | yes | – (emails a 6-digit code) |
| `POST /verify-email/confirm` | yes | `{code}` |
| `POST /password/forgot` | no | `{email}` (always `200`, whether or not the account exists) |
| `POST /password/reset` | no | `{email, code, password}` (revokes all refresh tokens) |

Codes last 15 minutes, allow 5 wrong tries, and are single use. Registration sends a code automatically. Unverified users can use the app and save designs;
the app shows a "verify your email" banner before cloud sync (`user.emailVerified` is `false`).

Email goes through `lib/mailer.mjs`: `MAIL_PROVIDER=console` (prints the message; default) or `resend` (`RESEND_API_KEY`, `MAIL_FROM`).

## Google and Apple
- `POST /google {idToken}` verified with `google-auth-library` against `GOOGLE_CLIENT_IDS`.
- `POST /apple {identityToken, name?}` verified against Apple's JWKS with `jose`; audiences are `APPLE_BUNDLE_ID` and `APPLE_SERVICE_ID`.
  Apple sends the email (possibly a private relay address) and name only the first time, so the app must send `name` on first login.
- An existing account is linked **only** if the provider says the email is verified and it matches; otherwise `409`. Without server setup both return `501`.

### What you must set up
**Google Cloud Console**: create a project, configure the OAuth consent screen, then create OAuth client ids: *Web* (used as the audience for ID tokens),
*Android* (package `in.hometown.roomdesigner` + your signing SHA-1) and *iOS* (bundle id). Put all of them in `GOOGLE_CLIENT_IDS` and the web client id in the app as
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
**Apple Developer**: enable *Sign in with Apple* on the App ID (`APPLE_BUNDLE_ID`). Only if you also need it on the web/Android, create a Services ID (`APPLE_SERVICE_ID`).
Apple requires Sign in with Apple whenever another social login is offered on iOS.

## Account
`GET/PATCH /me` (name). `DELETE /me` removes designs, wishlist, identities, tokens and stored thumbnails (`204`).
`/account/delete` is a public web page that signs in and deletes (the Play Store requires a deletion URL that works without the app).

## Roles
`user` < `editor` (products, models, rooms) < `admin` (everything, users, audit log). `requireRole(...)` in `middleware/auth.mjs`.
Admin/editor writes are appended to `audit_log` (`GET /v1/admin/audit`). Admins manage users at `/v1/admin/users` (role, disable, delete).
Make the first admin from the command line: `node scripts/make-admin.mjs you@example.com [admin|editor|user]`.

## Environment
`JWT_SECRET` (required in production), `GOOGLE_CLIENT_IDS`, `APPLE_BUNDLE_ID`, `APPLE_SERVICE_ID`, `MAIL_PROVIDER`, `RESEND_API_KEY`, `MAIL_FROM`.
