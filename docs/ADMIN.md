# Admin dashboard

A Vite + React + TypeScript app in `admin/` (TanStack Query, React Router, plain CSS). Only `editor` and `admin` accounts can sign in.
It talks only to `/v1`; its API types are generated from `server/openapi.yaml` (`npm run types`, checked in CI).

| Page | Who | What |
|---|---|---|
| Products | editor, admin | Search/filter (category, role, model status, size review, confidence); edit every field with live size plausibility warnings; "Mark size checked" |
| 3D models | editor, admin | Upload a GLB through a signed link, validation report (size, origin, floor, MB, triangles, textures), review stage (photos next to the model, the listed size as an orange box, a 1 m cube), Approve or Reject with a reason. Queues: awaiting review / needs model / rejected / shape groups |
| Sample rooms | editor, admin | Drag pieces on the to-scale plan (same drawing code as the app), rotate, search products, live integrity checks, Publish (refused if a check fails) |
| Import | editor, admin | Upload the Shopify CSV, review added/changed/not-in-file/flagged, Publish (optionally remove products missing from the file) |
| Users & audit | admin | Search, change role, disable, delete; audit log of every admin/editor write |
| Analytics | editor, admin | Active devices, AR sessions, scan rate, placements, top products, suggestion placed rate (from anonymous events) |

## Run
```bash
cd server && npm start             # API on :4000
cd admin && npm install && npm run dev      # http://localhost:5173/admin/ (proxies /v1 to :4000)
```
Make yourself an admin first: `cd server && node scripts/make-admin.mjs you@example.com` (needs an account created in the app or via `POST /v1/auth/register`).

## Deploy
`cd admin && npm run build` writes `admin/dist`. The API serves it at `/admin` automatically when that folder exists (the Docker image builds it in a first stage, see `server/Dockerfile`).
No separate hosting is needed; if you prefer one, host `admin/dist` on any static host under `/admin/` and proxy `/v1` to the API.

## Where the sample rooms are used
The app ships the 12 curated rooms in `src/data/rooms.json`. Rooms published here are stored in the server's `sample_rooms` table and served at `GET /v1/rooms`.
Run `npm run build:rooms` to keep the bundled copy in step if you want published rooms to ship inside the app too.
