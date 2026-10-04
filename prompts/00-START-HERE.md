# Start here (you do this part, not Claude)

## What you are building
One app, **HomeTown AR**. It combines everything from both prototypes:

| From Room Designer (base) | From FurniAR (ported in) |
|---|---|
| 681-item catalogue, 670 placeable | Room scan by corners (size, angle, irregular-room warning) |
| Shaped true-size proxies, 3D preview | Curated sample rooms + to-scale plan drawings |
| Undo/redo, copy, 5 cm snap, walkway warning | Scored recommendation engine with reasons |
| Wall pieces (frames, clocks) | Wishlist ("Save for later") |
| Measure room, two-point re-anchoring, cloud anchors | "Will it fit?" calculator |
| AI layout (server + Claude API) | Onboarding with room size, shown once |
| Accounts + cloud design sync, video, photo | Anonymous analytics events |
| Model publish pipeline + /admin page | Layout aligned to scanned walls, "turn 90°" |

New work on top: full catalogue sync, Postgres, cloud file storage, proper sign-in (verify, reset, Google, Apple),
wishlist sync, share links, admin dashboard, 2D plan editor, monitoring, store release.

## One-time setup (about 1 hour)
1. Install: **Node 22.13+**, **Git**, **VS Code**, **Android Studio** (SDK + platform tools), and on a Mac **Xcode 16+**.
   Python is not needed after step 02.
2. Install the **Claude Code** extension in VS Code and sign in.
3. Unzip this folder somewhere without spaces in the path, e.g. `C:\dev\hometown-ar` or `~/dev/hometown-ar`.
4. In a terminal in that folder:
   ```bash
   git init && git add -A && git commit -m "start: HTRD base + FurniAR reference"
   npm install
   cd server && npm install && cd ..
   npm test && (cd server && npm test)
   ```
   All tests should pass. If `npm install` fails on version conflicts, start step 01; Claude fixes it there.
5. Install EAS (Expo's build service) and log in: `npm i -g eas-cli && eas login`. A free Expo account is enough.
6. Have a real **ARCore Android phone** with USB debugging turned on. An iPhone with a Mac comes later.
7. If you have HomeTown's `HT_Data_dump.csv`, put it at `data/HT_Data_dump.csv`. It is gitignored. Step 02 works
   without it, using the catalogue that is already in the repo.

## How to run each step
1. Open the folder in VS Code and open the Claude Code panel.
2. Start a **new conversation** for every step. Long chats lose context, and `CLAUDE.md` gives each new chat what it needs.
3. Paste: `Do prompts/01-foundation.md` (or copy the whole file in). Let it finish.
4. Read its summary, run the app if the step says so, then commit: `git add -A && git commit -m "step 01"`.
   If something is wrong, say so in the same chat before you commit.
5. Do the **phone checkpoints** where a step tells you to. AR can't be tested anywhere else.

## Step order
| # | File | What gets built | Phone check after? |
|---|---|---|---|
| 01 | 01-foundation.md | Rename, configs, lint, CI, AR isolation layer, first device build | yes |
| 02 | 02-data-model-and-catalogue.md | One product model + one importer for both apps' fields | |
| 03 | 03-bug-fixes.md | 12 known bugs fixed with tests | |
| 04 | 04-ar-refactor-and-room-scan.md | AR screen split up + FurniAR room scan merged in | **yes** |
| 05 | 05-sample-rooms-and-plan-view.md | Curated rooms, plan drawings, wall-aligned placement | |
| 06 | 06-recommendations.md | Unified suggestion engine with reasons | |
| 07 | 07-wishlist-fit-onboarding-analytics.md | Wishlist, Will it fit, onboarding, events | **yes** |
| 08 | 08-server-merge.md | One server with every endpoint from both | |
| 09 | 09-postgres-and-storage.md | Postgres, migrations, S3/R2 storage, delta catalogue | |
| 10 | 10-auth.md | Verify email, reset, refresh tokens, Google + Apple | |
| 11 | 11-app-accounts-and-sync.md | Sign-in screens, secure token, offline-safe sync | |
| 12 | 12-sharing-and-deep-links.md | Thumbnails, share link, web share page | **yes** |
| 13 | 13-admin-dashboard.md | Web admin: products, sizes, models, rooms, users | |
| 14 | 14-plan-editor.md | 2D top-down editor (no AR needed) | |
| 15 | 15-polish-performance-monitoring.md | Accessibility, performance, Sentry, caching | **yes** |
| 16 | 16-release.md | EAS production builds, store prep, beta | **yes** |

Steps 13 and 14 don't depend on each other. Do them in either order once 11 is done.

## Decisions already made for you (change them in CLAUDE.md if you disagree)
- Base code is Room Designer. FurniAR is ported in, then `reference/` is deleted in step 16.
- Prices: shown as an optional "reference price", switched by `SHOW_PRICES` in `src/config.ts` (default **off**).
- No cart or checkout. "View on HomeTown" opens the product page.
- Resize limited to 80–125%, so true scale stays honest.
- Proxies (simple shapes) for every product until real 3D models arrive. See `prompts/MODELS.md`.
