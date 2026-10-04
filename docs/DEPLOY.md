# Deploying the API (no Postgres, no cloud storage)

The server keeps everything on local disk:

| What | Where | Setting |
|---|---|---|
| Database | one SQLite file (WAL mode) | `DB_FILE` (default `server/data/furni.db`) |
| Uploaded files (3D models, thumbnails) | a folder | `UPLOAD_DIR` (default `server/uploads`) |
| Schema | versioned migrations that run on start | `npm run migrate` to run them by hand |

Put both paths on a **persistent disk**. SQLite handles thousands of users on one small server; the catalogue is
read-heavy and designs are small. If you outgrow one machine later, the SQL is plain and the storage layer
(`server/src/lib/storage.mjs`) is the only file that touches the disk.

## Run locally
```bash
cd server && npm install
cp .env.example .env     # set JWT_SECRET in production
npm run seed             # catalogue + sample rooms (also done on first start)
npm start                # http://localhost:4000
npm test
```
Point the app at it: `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:4000/v1`.

## Deploy with Docker (any VM, Fly.io, Railway, Render)
Build from the **repo root** (the image bundles `src/data/catalogue.json` and `rooms.json` for seeding):
```bash
docker build -f server/Dockerfile -t hometown-ar-api .
docker run -d --name hometown-api -p 4000:4000 -v hometown-data:/data \
  -e JWT_SECRET=$(openssl rand -hex 32) -e PUBLIC_URL=https://api.example.com hometown-ar-api
```
`render.yaml` is a ready blueprint for Render (web service + 5 GB disk). On Fly.io use a volume mounted at `/data`.

## HTTPS
Put the container behind a reverse proxy that terminates TLS (Caddy: `api.example.com { reverse_proxy localhost:4000 }`),
or use the host's built-in HTTPS. The server trusts one proxy hop (`X-Forwarded-*`).

## Files, caching and an optional CDN
Model files are immutable (`models/<id>-v<n>.glb`; a new upload is a new version), served from `/files` with
`Cache-Control: public, max-age=31536000, immutable`. To offload bandwidth, mirror `UPLOAD_DIR` to any static host or CDN
and set `CDN_BASE_URL=https://cdn.example.com`; the API then returns model URLs on that host.

Upload flow (used by the admin page): `POST /v1/admin/models/:productId/upload-url` returns a signed `PUT` link valid for
10 minutes and for one key; `PUT` the GLB to it; `POST /v1/admin/models/:productId/validate` checks it against the listed
size, records it, and bumps the catalogue version so apps download it.

## Backups (do this)
```bash
npm run backup                       # server/backups/furni-YYYY-MM-DD.db, safe while running
rsync -a /data/uploads backup-host:/backups/uploads/    # files are append-only, so rsync is cheap
```
Schedule both nightly (cron / the host's snapshot feature). To restore: stop the server, put the `.db` file at `DB_FILE`, start.

## Monitoring
`GET /health` (process up) and `GET /ready` (database answers) for uptime checks. Logs are JSON (pino) with a request id
and never contain bodies or tokens.
