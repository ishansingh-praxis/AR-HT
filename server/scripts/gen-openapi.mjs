// Writes server/openapi.yaml from the live route table (so no route can be forgotten) plus the descriptions below.
// Usage: npm run openapi        Check: test/openapi.test.mjs fails when a route is missing here or the file is stale.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../src/db.mjs';
import { createApp } from '../src/app.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// "METHOD /path": [summary, request body schema | null, response schema | null, query params]
export const DOCS = {
  'GET /health': ['Process is up', null, null, []],
  'GET /ready': ['Database answers', null, null, []],
  'POST /v1/auth/register': ['Create an account; sends a verification code', 'Credentials', 'Session', []],
  'POST /v1/auth/login': ['Sign in with email and password (10 wrong tries lock for 15 minutes)', 'Credentials', 'Session', []],
  'POST /v1/auth/refresh': ['Swap a refresh token for a new pair (rotation; reuse revokes the family)', 'RefreshInput', 'Session', []],
  'POST /v1/auth/logout': ['Revoke one refresh token', 'RefreshInput', null, []],
  'POST /v1/auth/logout-all': ['Revoke every session of the signed-in user', null, null, []],
  'POST /v1/auth/verify-email/request': ['Email a new 6-digit code', null, null, []],
  'POST /v1/auth/verify-email/confirm': ['Confirm the email with the code', 'CodeInput', null, []],
  'POST /v1/auth/password/forgot': ['Email a reset code (always 200)', 'EmailInput', null, []],
  'POST /v1/auth/password/reset': ['Set a new password with the code; revokes all sessions', 'ResetInput', null, []],
  'POST /v1/auth/google': ['Sign in with a Google ID token', 'GoogleInput', 'Session', []],
  'POST /v1/auth/apple': ['Sign in with an Apple identity token', 'AppleInput', 'Session', []],
  'GET /v1/me': ['The signed-in user', null, 'UserEnvelope', []],
  'PATCH /v1/me': ['Change the display name', 'NameInput', 'UserEnvelope', []],
  'DELETE /v1/me': ['Delete the account and everything tied to it', null, null, []],
  'GET /v1/wishlist': ['Saved furniture', null, 'WishItems', []],
  'PUT /v1/wishlist/{productId}': ['Save a product (idempotent)', null, null, []],
  'DELETE /v1/wishlist/{productId}': ['Remove a saved product (idempotent)', null, null, []],
  'GET /v1/designs': ['The user\'s designs; with ?since=<ms> only what changed plus deleted ids', null, 'DesignList', ['since']],
  'POST /v1/designs': ['Create a design (idempotent per clientId)', 'DesignInput', 'Design', []],
  'GET /v1/designs/{id}': ['One design', null, 'Design', []],
  'PATCH /v1/designs/{id}': ['Rename and/or replace items; a stale updatedAt is 409', 'DesignPatch', 'Design', []],
  'DELETE /v1/designs/{id}': ['Soft delete (other devices learn through ?since)', null, null, []],
  'POST /v1/designs/{id}/share': ['Create (or return) the share link', null, 'ShareLink', []],
  'DELETE /v1/designs/{id}/share': ['Revoke the share link', null, null, []],
  'POST /v1/thumbnails/upload-url': ['Signed PUT link for a design thumbnail', 'ThumbnailInput', 'UploadLink', []],
  'PUT /v1/uploads/{token}': ['Upload raw bytes to a signed link', null, null, []],
  'GET /v1/shared/{slug}': ['A shared design (public, no personal data)', null, 'SharedDesign', []],
  'POST /v1/events': ['Anonymous usage events (batches of up to 50)', 'EventsInput', null, []],
  'POST /v1/layout/suggest': ['AI layout suggestions (20/day, 5/minute per user)', 'LayoutInput', null, []],
  'GET /v1/rooms': ['Curated sample rooms', null, 'Rooms', []],
  'GET /v1/categories': ['Product categories with counts', null, null, []],
  'GET /v1/products': ['Products; filters category, role, roomType, q; paged with limit/offset', null, 'ProductPage', ['category', 'role', 'roomType', 'q', 'limit', 'offset']],
  'GET /v1/products/{id}': ['One product', null, 'Product', []],
  'GET /v1/catalogue': ['Delta sync: what changed since a catalogue version (ETag, gzip)', null, 'CatalogueDelta', ['since']],
  'POST /v1/admin/products': ['Create a product, optionally with a GLB (multipart: product JSON + model)', 'ProductForm', 'ProductResult', []],
  'PUT /v1/admin/products/{id}': ['Partial update; only fields sent are changed', 'ProductForm', 'ProductResult', []],
  'DELETE /v1/admin/products/{id}': ['Delete a product (apps learn through the catalogue delta)', null, null, []],
  'POST /v1/admin/products/{id}/size-checked': ['Mark a flagged size as checked (clears sizeReview)', null, 'ProductResult', []],
  'POST /v1/admin/models/{productId}/upload-url': ['Signed PUT link for the next model version', null, 'UploadLink', []],
  'POST /v1/admin/models/{productId}/validate': ['Validate an uploaded GLB; review:true waits for approval', 'ValidateInput', 'ProductResult', []],
  'GET /v1/admin/models/{productId}': ['Uploaded model versions', null, null, []],
  'GET /v1/admin/models-queue': ['Needs model / awaiting review / rejected', null, 'ModelQueue', []],
  'POST /v1/admin/models/{productId}/{version}/approve': ['Publish a pending model', null, 'ProductResult', []],
  'POST /v1/admin/models/{productId}/{version}/reject': ['Reject a pending model with a reason', 'RejectInput', null, []],
  'POST /v1/admin/import': ['Upload the Shopify CSV; returns the diff (multipart "file")', 'CsvForm', 'ImportPreview', []],
  'POST /v1/admin/import/{id}/publish': ['Apply an import; removeMissing also removes products absent from the file', 'PublishInput', null, []],
  'GET /v1/admin/rooms': ['Sample rooms (editor view)', null, 'Rooms', []],
  'POST /v1/admin/rooms/check': ['Run the integrity checks without saving', 'Room', 'RoomCheck', []],
  'PUT /v1/admin/rooms/{id}': ['Create or update a room; refused (422) when it fails the checks', 'Room', 'Room', []],
  'DELETE /v1/admin/rooms/{id}': ['Delete a room', null, null, []],
  'GET /v1/admin/stats': ['Usage statistics from anonymous events', null, 'Stats', ['from', 'to']],
  'GET /v1/admin/audit': ['Audit log of admin and editor writes', null, null, ['limit']],
  'GET /v1/admin/users': ['Search users', null, null, ['q']],
  'PATCH /v1/admin/users/{id}': ['Change role or disable/enable a user', 'UserPatch', null, []],
  'DELETE /v1/admin/users/{id}': ['Delete a user and their data', null, null, []],
  'GET /account/delete': ['Public page to delete an account (Play Store requirement)', null, null, []],
  'GET /d/{slug}': ['Public share page (HTML)', null, null, []],
  'GET /.well-known/apple-app-site-association': ['iOS universal links file', null, null, []],
  'GET /.well-known/assetlinks.json': ['Android app links file', null, null, []],
};

// Every property is required unless a list is given: response shapes are complete, so the generated TypeScript types need no `?`.
const obj = (props, required = Object.keys(props)) => ({ type: 'object', properties: props, ...(required.length ? { required } : {}) });
const str = { type: 'string' }, num = { type: 'number' }, int = { type: 'integer' }, bool = { type: 'boolean' };
const arr = (items) => ({ type: 'array', items });
const ref = (n) => ({ $ref: `#/components/schemas/${n}` });
const vec3 = arr(num);
const designItem = obj({ productId: str, offset: vec3, rotationY: num, scale: num }, ['productId', 'offset', 'rotationY', 'scale']);

export const SCHEMAS = {
  Credentials: obj({ email: str, password: str, name: str }, ['email', 'password']),
  RefreshInput: obj({ refreshToken: str }, ['refreshToken']),
  CodeInput: obj({ code: { type: 'string', pattern: '^\\d{6}$' } }, ['code']),
  EmailInput: obj({ email: str }, ['email']),
  ResetInput: obj({ email: str, code: str, password: str }, ['email', 'code', 'password']),
  GoogleInput: obj({ idToken: str }, ['idToken']),
  AppleInput: obj({ identityToken: str, name: str }, ['identityToken']),
  NameInput: obj({ name: str }, ['name']),
  User: obj({ id: int, email: str, name: { type: 'string', nullable: true }, role: { type: 'string', enum: ['user', 'editor', 'admin'] }, emailVerified: bool }, ['id', 'email', 'role', 'emailVerified']),
  UserEnvelope: obj({ user: ref('User') }, ['user']),
  Session: obj({ token: str, accessToken: str, refreshToken: str, expiresIn: int, user: ref('User') }, ['accessToken', 'refreshToken', 'user']),
  WishItems: arr(obj({ id: str, addedAt: int })),
  Dimensions: obj({ w: num, d: num, h: num }, ['w', 'd', 'h']),
  Product: obj({
    id: str, name: str, category: str, role: str, subcategory: str, brand: str, description: str, images: arr(str), dimensionsCm: ref('Dimensions'),
    dimsConfidence: { type: 'string', enum: ['high', 'low'] }, sizeReview: str, material: str, colorFamily: str, family: str, collection: str, retailerUrl: str,
    modelStatus: str, model3D: obj({ url: str, key: str, version: int, unit: str }), proxy: obj({ template: str, color: str }), roomTypes: arr(str), ar: obj({ placements: arr(str) }),
  }, ['id', 'name', 'category', 'dimensionsCm']),
  ProductPage: obj({ total: int, items: arr(ref('Product')) }),
  CatalogueDelta: obj({ version: int, products: arr(ref('Product')), removed: arr(str) }),
  ProductForm: obj({ product: { type: 'string', description: 'JSON of the product fields' }, model: { type: 'string', format: 'binary' } }, ['product']),
  ProductResult: obj({ product: ref('Product'), validation: ref('GlbReport') }, ['product']),
  GlbReport: obj({ ok: bool, issues: arr(str), warnings: arr(str), sizeCm: ref('Dimensions'), triangles: int, fileMb: num, textures: arr(obj({ name: str, mime: str, size: arr(int) })), origin: obj({ x: num, z: num, baseY: num }) }, ['ok', 'issues', 'warnings']),
  ValidateInput: obj({ key: str, review: bool }, ['key']),
  RejectInput: obj({ reason: str }, ['reason']),
  UploadLink: obj({ key: str, version: int, method: str, uploadUrl: str, expiresInSec: int }),
  ThumbnailInput: obj({ clientId: str }, ['clientId']),
  ModelQueue: obj({
    needsModel: arr(ref('Product')),
    pending: arr(obj({ productId: str, version: int, url: str, sizeMb: num, report: ref('GlbReport'), product: ref('Product') }, ['productId', 'version', 'url', 'sizeMb'])),
    rejected: arr(obj({ productId: str, version: int, report: ref('GlbReport') }, ['productId', 'version'])),
  }),
  CsvForm: obj({ file: { type: 'string', format: 'binary' } }, ['file']),
  ImportPreview: obj({ id: str, products: int, skipped: int, issues: arr({ type: 'object', additionalProperties: true }), diff: obj({ added: arr(str), changed: arr(str), removed: arr(str), flagged: arr(str), counts: obj({ added: int, changed: int, removed: int, flagged: int }) }) }),
  PublishInput: obj({ removeMissing: bool }, []),
  DesignInput: obj({ clientId: str, name: str, roomType: str, frame: bool, cloudAnchorId: str, thumbnailKey: str, items: arr(designItem) }, ['items']),
  DesignPatch: obj({ name: str, items: arr(designItem), updatedAt: int, thumbnailKey: str }, []),
  Design: obj({ id: int, clientId: str, name: str, createdAt: int, updatedAt: int, thumbnailKey: str, thumbnailUrl: str, shareSlug: str, items: arr(designItem) }, ['id', 'name', 'createdAt', 'updatedAt', 'items']),
  DesignList: obj({ designs: arr(ref('Design')), deleted: arr(int), serverTime: int }),
  ShareLink: obj({ slug: str, url: str }),
  SharedDesign: obj({ slug: str, name: str, items: arr(designItem), thumbnailUrl: str, products: arr(ref('Product')) }, ['slug', 'name', 'items', 'products']),
  Room: obj({
    id: str, title: str, roomType: str, style: arr(str), blurb: str, notes: str, roomCm: obj({ w: num, d: num }),
    door: obj({ wall: str, at: num }), pieces: arr(obj({ productId: str, x: num, z: num, rot: num, anchor: bool })),
  }, ['id', 'title', 'roomType', 'roomCm', 'pieces']),
  Rooms: arr(ref('Room')),
  RoomCheck: obj({ problems: arr(str), pieceProblems: { type: 'object', additionalProperties: arr(str) } }),
  EventsInput: obj({ deviceId: str, events: arr(obj({ name: str, ts: int, props: { type: 'object' } })) }, ['deviceId', 'events']),
  LayoutInput: obj({ roomType: str, anchorId: str, room: obj({ area: num, maxSpan: num }) }, ['roomType', 'anchorId']),
  UserPatch: obj({ role: { type: 'string', enum: ['user', 'editor', 'admin'] }, disabled: bool }, []),
  Stats: obj({
    from: int, to: int, daily: arr(obj({ day: str, devices: int, arSessions: int, placements: int, scans: int })), topProducts: arr(obj({ id: str, name: str, count: int })),
    totals: obj({ devices: int, arSessions: int, scans: int, placements: int, recShown: int, recPlaced: int, scanSuccessRate: { type: 'number', nullable: true }, recPlacedRate: { type: 'number', nullable: true } }),
  }),
};

// ---- tiny YAML writer (JSON-shaped data only) ----
const scalar = (v) => (typeof v === 'string' ? (/^[A-Za-z0-9_./{}-]+$/.test(v) && !/^(true|false|null|\d.*)$/.test(v) ? v : JSON.stringify(v)) : String(v));
function yaml(v, ind = 0) {
  const pad = ' '.repeat(ind);
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === 'object' && x !== null ? `${pad}-\n${yaml(x, ind + 2)}` : `${pad}- ${scalar(x)}`)).join('\n') : `${pad}[]`;
  return Object.entries(v).map(([k, x]) => (typeof x === 'object' && x !== null ? (Object.keys(x).length || Array.isArray(x) ? `${pad}${scalar(k)}:\n${yaml(x, ind + 2)}` : `${pad}${scalar(k)}: ${Array.isArray(x) ? '[]' : '{}'}`) : `${pad}${scalar(k)}: ${scalar(x)}`)).join('\n');
}

export function buildSpec(routes) {
  const paths = {};
  for (const r of routes) {
    const key = `${r.method} ${r.path}`;
    const d = DOCS[key];
    if (!d) throw new Error(`Route not documented in scripts/gen-openapi.mjs: ${key}`);
    const [summary, body, resp, query] = d;
    const params = [...[...r.path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: str })), ...query.map((q) => ({ name: q, in: 'query', schema: str }))];
    const isForm = body && /Form$/.test(body);
    const role = r.guards.find((g) => g.startsWith('role:'))?.slice(5);
    paths[r.path] ??= {};
    paths[r.path][r.method.toLowerCase()] = {
      summary, tags: [r.path.split('/')[2] === 'admin' ? 'admin' : r.path.startsWith('/v1/') ? r.path.split('/')[2] : 'public'],
      ...(r.guards.length ? { security: [{ bearer: [] }], description: `Requires sign-in${role ? ` and the ${role} role (admin also passes for editor routes)` : ''}.` } : { security: [] }),
      ...(params.length ? { parameters: params } : {}),
      ...(body ? { requestBody: { required: true, content: { [isForm ? 'multipart/form-data' : 'application/json']: { schema: ref(body) } } } } : {}),
      responses: { [resp || body || r.method !== 'GET' ? '200' : '200']: { description: 'OK', ...(resp ? { content: { 'application/json': { schema: ref(resp) } } } : {}) }, default: { description: 'Error: { error: string, details?: string[] }' } },
    };
  }
  const sorted = Object.fromEntries(Object.keys(paths).sort().map((k) => [k, paths[k]]));
  return {
    openapi: '3.0.3',
    info: { title: 'HomeTown AR API', version: '1.0.0', description: 'Generated by server/scripts/gen-openapi.mjs from the live route table. Every route is under /v1 unless it is a public page.' },
    servers: [{ url: 'http://localhost:4000' }],
    paths: sorted,
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas: SCHEMAS },
  };
}

export const specYaml = (routes) => yaml(buildSpec(routes)) + '\n';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createApp({ db: openDb(), jwtSecret: 'x'.repeat(24), uploadDir: path.join(here, '../uploads'), publicUrl: 'http://localhost:4000' });
  fs.writeFileSync(path.join(here, '../openapi.yaml'), specYaml(app.locals.routeTable()));
  // docs/API.md: the same table in human form
  const rows = app.locals.routeTable().map((r) => {
    const role = r.guards.find((g) => g.startsWith('role:'))?.slice(5);
    return `| ${r.method} | \`${r.path}\` | ${r.guards.length ? (role ? `${role}` : 'signed in') : 'public'} | ${DOCS[`${r.method} ${r.path}`][0]} |`;
  });
  fs.writeFileSync(path.join(here, '../../docs/API.md'), `# API

Generated from the live route table by \`npm run openapi\` (in \`server/\`), together with [\`server/openapi.yaml\`](../server/openapi.yaml). Do not edit by hand.
Everything is under \`/v1\` unless it is a public page. Errors are \`{ "error": "message", "details": [...] }\`. "editor" routes also accept admins.

| Method | Path | Access | What it does |
|---|---|---|---|
${rows.join(String.fromCharCode(10))}
`);
  console.log('Wrote server/openapi.yaml and docs/API.md');
}
