# Store preparation

Everything below is derived from what the code does today. If you change what the app collects, change this file, `privacy.md` and the store forms together.

## What the app collects

| Data | When | Where it goes | Linked to the person? |
|---|---|---|---|
| Email, optional name, password (stored only as a scrypt hash), Google/Apple account id | Only if the user creates an account or signs in | API server (SQLite on your disk) | Yes |
| Saved designs: pieces, positions, name, room type, scanned room size (width, depth, area as numbers) | Only when signed in and email verified (cloud backup); otherwise stays on the phone | API server | Yes |
| Saved furniture (product ids) | Same as designs | API server | Yes |
| Design photo: a screenshot of the AR view (it shows the user's room) | Only when the user **shares that design**, or turns on **Back up design photos** in Settings (off by default) | API server storage; public through the share link when shared | Yes |
| Anonymous usage events: random device id (not tied to an account), event names, product ids and numbers | Unless the user turns off "Share anonymous usage" | API server | No |
| Crash reports: stack trace, app version, device model and OS version (tokens, emails, codes scrubbed; user reduced to an id) | Only in builds with a Sentry DSN | Sentry | No |
| Camera | Used live for AR, **frames are never sent anywhere** | Stays on the phone | n/a |
| Location, contacts, microphone, photos library (read), payments, advertising id | **Not collected** | n/a | n/a |

Not collected on purpose: no ads, no third-party analytics SDK, no tracking across apps.
Account deletion: in the app (Settings, Delete my data) and on the web at `https://<api>/account/delete` (no app needed). Deletion removes the account, designs, saved furniture, linked sign-ins, tokens and stored photos.
Data in transit is encrypted (HTTPS). Passwords are hashed. Admin actions are audit-logged.

## Google Play: Data safety form

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | Yes (collected), **not shared** with third parties (Sentry and the host are service providers acting on your behalf) |
| Is all of the user data collected by your app encrypted in transit? | Yes |
| Do you provide a way for users to request that their data is deleted? | Yes: in-app, and the web URL `https://<api>/account/delete` |
| Personal info: Name | Collected (optional), App functionality, Account management |
| Personal info: Email address | Collected, App functionality, Account management |
| Photos and videos: Photos | Collected **optionally** (design photo on share or backup), App functionality |
| App activity: App interactions | Collected, Analytics, **not linked** to identity, user can opt out in Settings |
| App info and performance: Crash logs, Diagnostics | Collected, Analytics, not linked |
| Device or other IDs | Collected: random install id for anonymous analytics, not linked |
| Location, Financial info, Health, Messages, Contacts, Audio, Files and docs, Calendar, Web browsing | Not collected |
| Data used for tracking / advertising | None |

## Apple: App Privacy ("nutrition labels")

- **Contact Info**: Email Address, Name. Linked to the user. Purpose: App Functionality. Not used for tracking.
- **User Content**: Photos or Videos (design photo, optional). Linked to the user. Purpose: App Functionality. Not used for tracking.
- **Identifiers**: Device ID (random install id). Not linked to the user. Purpose: Analytics. Not used for tracking.
- **Usage Data**: Product Interaction. Not linked. Purpose: Analytics. Not used for tracking.
- **Diagnostics**: Crash Data, Performance Data. Not linked. Purpose: App Functionality.
- "Data Used to Track You": **none**.
- Required for review: Sign in with Apple is offered because Google sign-in is offered (iOS). Account deletion is available in the app. `ITSAppUsesNonExemptEncryption` is false.
- Purpose strings (already in the app, plain language): camera (place furniture, images stay on the phone), photo library add-only (saves your photos and videos), microphone string says the app does not use it.

## Store listing copy (draft, English; add Hindi from `src/i18n/hi.json` after review)

**Name**: HomeTown AR
**Subtitle / short description (80)**: See HomeTown furniture in your room, to scale, before you decide.
**Full description**:
> Place true-to-size HomeTown furniture in your own room with your camera. Check the fit before you buy: the sofa, bed or wardrobe appears at its real width, depth and height, with walkway warnings when pieces are too close.
>
> • Scan your room by tapping its corners and get its size
> • Try curated sample rooms, drawn to scale, and fit them to your room
> • Get suggestions that match your room size and what you have placed
> • No AR on your phone? Draw your room on a to-scale plan instead
> • Save designs, share a link or photo, back them up with an optional account
> • Look around any product in 360°
> HomeTown AR shows furniture at real size for planning. Simplified shapes are used until photo-real models arrive and are labelled as such. There is no checkout: "View on HomeTown" opens the product page.

**Keywords (iOS, 100)**: furniture,AR,room planner,sofa,bed,home decor,floor plan,interior,hometown,measure room,room designer
**Category**: Lifestyle (or House & Home on Play)
**Support URL / privacy URL / account deletion URL**: your support page, a public page on your website (host `docs/privacy.md` there), `https://<api>/account/delete`

## Screenshots (8, same order on both stores)
1. Welcome: "See it in your room before you decide." (room type and size chosen)
2. Library with the "Good starting pieces for your living room" row
3. Product page: 360° view with real size and "View in my room"
4. AR: a sofa placed in a real room with the measured size line
5. AR: scan outline on the floor with the room size ("Room 4.5 × 3.8 m")
6. AR: walkway warning (red outline) and the Suggested tab
7. Sample room plan drawn to scale ("Fits your scanned room")
8. Saved: design cards with thumbnails and the share sheet
Use a phone in light mode, English, 1080×1920 or larger; add Hindi variants if the listing is localised.

## 30-second AR preview video (script)
0–3 s: Title card "HomeTown AR: see it in your room first."
3–8 s: Phone camera pans a real living room floor; "Floor found" appears.
8–14 s: Tap View in my room on a sofa; it lands at true size. Caption "True size. Real width, depth, height."
14–19 s: Mark four corners; yellow outline; text "Room 4.5 × 3.8 m".
19–25 s: Place a sample room; a gap warning turns a piece red; the user drags it clear.
25–30 s: Save, thumbnail appears, share sheet. End card: logo and "View on HomeTown".
No voice-over needed (the app records silent video). Keep faces and personal items out of frame.
