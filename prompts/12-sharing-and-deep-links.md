# Step 12 — Thumbnails, share links, deep links

Read `CLAUDE.md` first. This is step 12. Do only this step.

## Tasks
1. **Thumbnails.** On Save in AR, take a screenshot (existing `takeScreenshot`, not saved to gallery), resize to
   720 px wide JPEG with `expo-image-manipulator`, store locally with the design, upload to storage on sync
   (signed URL) and set `thumbnailKey`. Saved screen shows thumbnails; sample rooms show their plan.
2. **Share a design.** `POST /v1/designs/:id/share` creates a random 10-char `share_slug` (revocable via DELETE).
   Share sheet message: photo + "See my room plan: https://<SHARE_DOMAIN>/d/<slug>". Guests: share the photo +
   product list text (no link).
3. **Web share page.** Server renders `GET /d/:slug` (plain HTML, no framework): title, thumbnail, to-scale plan SVG
   (port `RoomPlan` drawing logic to a shared pure function `src/plan/planSvg.ts` used by both app and server),
   product list with photos, sizes and "View on HomeTown" links, "Open in the app" button. Open Graph tags for
   WhatsApp previews. No personal data on the page.
4. **Deep links.** Scheme `hometownar://` plus universal/app links for `https://<SHARE_DOMAIN>/d/*`:
   `app.json` `ios.associatedDomains`, `android.intentFilters` (autoVerify); server serves
   `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` from env values. React Navigation
   `linking` config: `/d/:slug` → a "Shared design" screen (fetch, preview plan, "Try in my room" → AR with the
   design pending placement, "Save a copy").
5. **Product links.** `item/:id` deep link → Item screen. "View on HomeTown" adds UTM params
   (`utm_source=hometown-ar&utm_medium=app&utm_campaign=<context>`).
6. **Tests:** share slug create/revoke/404 after revoke, page renders without auth, planSvg snapshot for one room.

## Done when
`npm run check` and server tests pass. Tell me the DNS / hosting steps for the share domain.

## Phone checkpoint (I do this)
Save a design → thumbnail appears → Share to WhatsApp → preview card shows → link opens the app on a phone that has
it and the web page on one that doesn't → "Try in my room" places it.
