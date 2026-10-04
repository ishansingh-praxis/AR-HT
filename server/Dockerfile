# HomeTown AR API + admin dashboard: one container, SQLite file + uploads on a mounted volume (/data). Build from the repo root.
FROM node:22-slim AS admin
WORKDIR /repo
COPY admin/package*.json ./admin/
RUN cd admin && npm ci
COPY admin ./admin
COPY shared ./shared
COPY src/plan ./src/plan
RUN cd admin && npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production DB_FILE=/data/furni.db UPLOAD_DIR=/data/uploads PORT=4000
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY server ./server
# shared rules + the plan drawing are imported by the server; the catalogue and rooms seed the database on first run.
COPY shared ./shared
COPY src/plan ./src/plan
COPY src/data/catalogue.json src/data/rooms.json ./src/data/
COPY --from=admin /repo/admin/dist ./admin/dist
# shared/importer.mjs imports csv-parse: let modules under /app find the server's node_modules
RUN ln -s /app/server/node_modules /app/node_modules && mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
WORKDIR /app/server
CMD ["node", "src/index.mjs"]
