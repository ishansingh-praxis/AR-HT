# Share links and deep links

## What the user sees
1. In AR, **Save** takes a private photo of the room (not added to the gallery), shrinks it to a 720 px JPEG and keeps it with the design.
2. Signed in: the photo is uploaded on the next sync through a signed link (`POST /v1/thumbnails/upload-url`, then `PUT`).
3. **Share** on a design creates a random 10-character link: `https://<SHARE_DOMAIN>/d/<slug>` (`POST /v1/designs/:id/share`, revoke with `DELETE`).
   The message is "See my room plan: <link>". iOS also attaches the photo; on Android the link's preview card (Open Graph image) shows it.
   Guests (no account) share the photo and a product list as text, with no link.
4. The page (`GET /d/:slug`, plain HTML, no scripts) shows the photo, a to-scale plan drawn by `src/plan/planSvg.mjs` (the same code the app uses),
   the products with sizes and "View on HomeTown" links (UTM tagged), an "Open in the app" button, and Open Graph tags for WhatsApp previews.
   It contains no name or email.
5. On a phone with the app, the link opens the **Shared design** screen: preview, **Try in my room** (AR, layout placed around the aim dot) or **Save a copy**.
   `hometownar://item/<id>` opens a product.

## Set up the share domain (once)
1. Pick a hostname, e.g. `share.hometown.in`. Create a DNS **A/AAAA** (or CNAME) record pointing at the server that runs the API.
   It can be the same server as the API: set `PUBLIC_URL=https://api.example.com` and `SHARE_DOMAIN=share.hometown.in`, and point both names at it.
2. Terminate HTTPS for that host (Caddy/nginx/host-managed certificate) and proxy to the API on port 4000. Universal links need valid HTTPS, no redirects on `/.well-known/*`.
3. Server env: `SHARE_DOMAIN`, `APPLE_TEAM_ID` (Apple Developer, Membership), `IOS_BUNDLE_ID` (default `in.hometown.roomdesigner`),
   `ANDROID_PACKAGE` (default same), `ANDROID_SHA256_CERTS` (comma-separated; from Play Console, *App signing*, "SHA-256 certificate fingerprint",
   plus your upload key if you test with it), optional `APP_STORE_URL` / `PLAY_STORE_URL` shown on the page.
4. Check: `curl https://share.hometown.in/.well-known/apple-app-site-association` and `.../assetlinks.json` return JSON.
5. App build env: `SHARE_DOMAIN=share.hometown.in` at prebuild/EAS time (adds `associatedDomains` and Android `intentFilters` with `autoVerify`) and
   `EXPO_PUBLIC_SHARE_DOMAIN=share.hometown.in` (used for in-app link handling). Rebuild the app after changing either.
6. Android: after install, `adb shell pm get-app-links in.hometown.roomdesigner` should show the domain as `verified`.

## Phone checklist
Save a design, a thumbnail appears on its card, Share to WhatsApp, the preview card shows the photo, the link opens the app on a phone that has it and the web page on one that does not, "Try in my room" places it.
