import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../src/db.mjs';
import { createApp } from '../src/app.mjs';
import { DOCS, specYaml } from '../scripts/gen-openapi.mjs';

const app = createApp({ db: openDb(), jwtSecret: 'x'.repeat(24), uploadDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ht-oa-')), publicUrl: 'http://localhost:4000' });
const routes = app.locals.routeTable();

test('every route is documented, and every documented route exists', () => {
  const live = new Set(routes.map((r) => `${r.method} ${r.path}`));
  for (const k of live) assert.ok(DOCS[k], `undocumented route: ${k} (add it to scripts/gen-openapi.mjs)`);
  for (const k of Object.keys(DOCS)) assert.ok(live.has(k), `documented but not a route: ${k}`);
});

test('openapi.yaml is up to date (run: npm run openapi)', () => {
  const file = fs.readFileSync(new URL('../openapi.yaml', import.meta.url), 'utf8');
  assert.equal(file, specYaml(routes), 'server/openapi.yaml is stale: run npm run openapi');
});

test('guards in the spec match the code: admin routes are never public', () => {
  for (const r of routes.filter((x) => x.path.startsWith('/v1/admin'))) assert.ok(r.guards.includes('auth') && r.guards.some((g) => g.startsWith('role:')), `${r.method} ${r.path} must need auth and a role`);
  for (const r of routes.filter((x) => /^\/v1\/(me|wishlist|designs)/.test(x.path))) assert.ok(r.guards.includes('auth'), `${r.method} ${r.path} must need auth`);
});
