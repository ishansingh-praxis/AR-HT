import assert from 'node:assert/strict';
import { ApiError, apiBase, createHttp, type Tokens } from '../src/sync/http.ts';
import { queueDelete, queueUpsert, queueWish, sync, type EngineIO, type LocalDesign, type Op, type RemoteDesign } from '../src/sync/engine.ts';
import type { WishItem } from '../src/utils/wishlist.ts';

// ---------- a fake server with the same rules as server/src/routes/designs.mjs and wishlist.mjs ----------
class FakeServer {
  designs: (RemoteDesign & { deleted?: boolean })[] = [];
  wish: WishItem[] = [];
  clock = 1000;
  nextId = 1;
  online = true;
  calls: string[] = [];
  private tick() { return ++this.clock; }
  private guard() { if (!this.online) throw new TypeError('offline'); }
  api(): EngineIO['api'] {
    const net = async <T,>(fn: () => T): Promise<T> => { if (!this.online) throw new ApiError(0, 'offline'); return fn(); };
    return {
      createDesign: (d) => net(() => {
        this.calls.push('create');
        const dup = this.designs.find((x) => x.clientId === d.clientId && !x.deleted);
        if (dup) return dup;
        const r: RemoteDesign = { id: this.nextId++, clientId: d.clientId, name: d.name, items: d.items, createdAt: this.tick(), updatedAt: this.clock };
        this.designs.push(r);
        return r;
      }),
      patchDesign: (id, d) => net(() => {
        this.calls.push('patch');
        const cur = this.designs.find((x) => x.id === id && !x.deleted);
        if (!cur) throw new ApiError(404, 'Design not found');
        if (d.updatedAt !== undefined && d.updatedAt !== cur.updatedAt) throw new ApiError(409, 'changed', { current: cur });
        Object.assign(cur, { name: d.name, items: d.items, updatedAt: this.tick() });
        return cur;
      }),
      deleteDesign: (id) => net(() => { this.calls.push('delete'); const cur = this.designs.find((x) => x.id === id); if (cur) { cur.deleted = true; cur.updatedAt = this.tick(); } }),
      listDesigns: (since) => net(() => {
        const rows = this.designs.filter((d) => d.updatedAt > since);
        return { designs: rows.filter((d) => !d.deleted), deleted: since ? rows.filter((d) => d.deleted).map((d) => d.id) : [], serverTime: this.clock };
      }),
      wishAdd: (id) => net(() => { this.calls.push('wish+'); if (!this.wish.some((w) => w.id === id)) this.wish.push({ id, addedAt: this.tick() }); }),
      wishRemove: (id) => net(() => { this.calls.push('wish-'); this.wish = this.wish.filter((w) => w.id !== id); }),
      listWishlist: () => net(() => [...this.wish]),
    };
  }
  /** Another phone edits/deletes directly on the server. */
  editElsewhere(id: number, name: string) { const d = this.designs.find((x) => x.id === id)!; d.name = name; d.updatedAt = this.tick(); }
  deleteElsewhere(id: number) { const d = this.designs.find((x) => x.id === id)!; d.deleted = true; d.updatedAt = this.tick(); }
}

// ---------- a phone: local state + outbox ----------
function phone(server: FakeServer) {
  let n = 0;
  const st = { designs: [] as LocalDesign[], outbox: [] as Op[], wish: [] as WishItem[], since: 0 };
  const io: EngineIO = {
    designs: () => st.designs, setDesigns: (d) => { st.designs = d; },
    outbox: () => st.outbox, setOutbox: (o) => { st.outbox = o; },
    wishlist: () => st.wish, setWishlist: (w) => { st.wish = w; },
    since: () => st.since, setSince: (s) => { st.since = s; },
    newId: () => `copy-${++n}`, now: () => server.clock + 1, api: server.api(),
  };
  return {
    st, io,
    create(id: string, name = id) { st.designs.push({ id, name, createdAt: 1, items: [{ productId: 'p', offset: [0, 0, 0] }] }); st.outbox = queueUpsert(st.outbox, id); },
    rename(id: string, name: string) { st.designs = st.designs.map((d) => (d.id === id ? { ...d, name } : d)); st.outbox = queueUpsert(st.outbox, id); },
    remove(id: string) { const d = st.designs.find((x) => x.id === id)!; st.designs = st.designs.filter((x) => x.id !== id); st.outbox = queueDelete(st.outbox, id, d.cloudId); },
    wishToggle(pid: string) { const has = st.wish.some((w) => w.id === pid); st.wish = has ? st.wish.filter((w) => w.id !== pid) : [{ id: pid, addedAt: server.clock + 1 }, ...st.wish]; st.outbox = queueWish(st.outbox, pid, !has); },
  };
}

// ---- outbox helpers ----
assert.deepEqual(queueUpsert(queueUpsert([], 'a'), 'a'), [{ type: 'design.upsert', id: 'a' }], 'one pending upsert per design');
assert.deepEqual(queueDelete([{ type: 'design.upsert', id: 'a' }], 'a'), [], 'delete of a never-synced design leaves nothing');
assert.deepEqual(queueDelete([{ type: 'design.upsert', id: 'a' }], 'a', 5), [{ type: 'design.delete', id: 'a', cloudId: 5 }]);
assert.deepEqual(queueWish(queueWish([], 'x', true), 'x', false), [{ type: 'wish.remove', productId: 'x' }]);

// ---- offline create, then online: uploaded once, even if the sync is retried ----
{
  const s = new FakeServer(), a = phone(s);
  s.online = false;
  a.create('d-1');
  assert.ok((await sync(a.io)).error, 'offline reports an error');
  assert.equal(a.st.outbox.length, 1, 'nothing lost while offline');
  s.online = true;
  const r = await sync(a.io);
  assert.equal(r.error, undefined);
  assert.equal(s.designs.length, 1);
  assert.equal(a.st.designs[0].cloudId, 1);
  assert.equal(a.st.outbox.length, 0);
  // a lost response: the phone retries the create with the same clientId and does not duplicate
  a.st.designs = [{ id: 'd-1', name: 'd-1', createdAt: 1, items: [] }]; a.st.outbox = queueUpsert([], 'd-1');
  await sync(a.io);
  assert.equal(s.designs.length, 1, 'idempotent create');
  assert.equal(a.st.designs[0].cloudId, 1);
}

// ---- delete while offline: sent later, and the design does not come back ----
{
  const s = new FakeServer(), a = phone(s);
  a.create('d-1'); await sync(a.io);
  s.online = false;
  a.remove('d-1');
  await sync(a.io);
  assert.deepEqual(a.st.outbox, [{ type: 'design.delete', id: 'd-1', cloudId: 1 }]);
  s.online = true;
  await sync(a.io);
  assert.equal(a.st.designs.length, 0, 'still deleted after the pull');
  assert.equal(s.designs[0].deleted, true);
  assert.equal(a.st.outbox.length, 0);
}

// ---- two phones: A and B share an account ----
{
  const s = new FakeServer(), A = phone(s), B = phone(s);
  A.create('d-1', 'Living'); await sync(A.io);
  await sync(B.io);
  assert.equal(B.st.designs[0].name, 'Living', 'B pulls A\'s design');
  assert.equal(B.st.designs[0].id, 'd-1', 'same client id on both phones');

  // concurrent edit: both rename while B is offline
  s.online = false;
  A.rename('d-1', 'Living (A)'); B.rename('d-1', 'Living (B)');
  s.online = true;
  await sync(A.io); // A wins the race
  const r = await sync(B.io);
  assert.equal(r.conflicts, 1);
  const names = B.st.designs.map((d) => d.name).sort();
  assert.deepEqual(names, ['Living (A)', 'Living (B) (this phone)'], 'both versions are kept');
  await sync(B.io);
  assert.equal(s.designs.filter((d) => !d.deleted).length, 2, 'the copy was uploaded as its own design');
  await sync(A.io);
  assert.equal(A.st.designs.length, 2, 'and reaches the other phone');

  // an edit that nobody else touched goes through without conflict
  A.rename('d-1', 'Lounge');
  assert.equal((await sync(A.io)).conflicts, 0);
  await sync(B.io);
  assert.ok(B.st.designs.some((d) => d.name === 'Lounge'), 'LWW: newer server version replaces an untouched local one');
}

// ---- local unsynced edits are never overwritten by a pull ----
{
  const s = new FakeServer(), A = phone(s);
  A.create('d-1', 'Mine'); await sync(A.io);
  s.editElsewhere(1, 'Theirs');
  A.rename('d-1', 'Mine v2');
  // a pull happens before the push could (simulate by blocking pushes with an unrelated failing op first)
  s.online = true;
  const before = A.st.designs[0].name;
  assert.equal(before, 'Mine v2');
  const r = await sync(A.io); // push gets 409 -> conflict copy; original takes the server version
  assert.equal(r.conflicts, 1);
  assert.deepEqual(A.st.designs.map((d) => d.name).sort(), ['Mine v2 (this phone)', 'Theirs']);
}

// ---- tombstones: deleted elsewhere is removed here; but unsynced edits are kept and re-created ----
{
  const s = new FakeServer(), A = phone(s), B = phone(s);
  A.create('d-1'); A.create('d-2'); await sync(A.io); await sync(B.io);
  s.deleteElsewhere(1); s.deleteElsewhere(2);
  B.rename('d-2', 'Edited on B');
  const r = await sync(B.io);
  assert.equal(r.error, undefined);
  assert.deepEqual(B.st.designs.map((d) => d.name), ['Edited on B'], 'untouched d-1 removed, edited d-2 kept');
  await sync(B.io);
  assert.equal(s.designs.filter((d) => !d.deleted).map((d) => d.name).join(), 'Edited on B', 'the kept design is back on the server');
}

// ---- wishlist round trip ----
{
  const s = new FakeServer(), A = phone(s), B = phone(s);
  A.wishToggle('sofa-1'); A.wishToggle('bed-2');
  await sync(A.io);
  assert.deepEqual(s.wish.map((w) => w.id).sort(), ['bed-2', 'sofa-1']);
  await sync(B.io);
  assert.deepEqual(B.st.wish.map((w) => w.id).sort(), ['bed-2', 'sofa-1']);
  B.wishToggle('sofa-1'); // remove
  B.wishToggle('chair-3'); // add
  await sync(B.io);
  await sync(A.io);
  assert.deepEqual(A.st.wish.map((w) => w.id).sort(), ['bed-2', 'chair-3']);
  // offline add survives a pull
  s.online = false; A.wishToggle('rug-9'); await sync(A.io); s.online = true;
  assert.ok(A.st.wish.some((w) => w.id === 'rug-9'));
  await sync(A.io);
  assert.ok(s.wish.some((w) => w.id === 'rug-9'));
}

// ---- thumbnails: uploaded once before the design is sent; a failed upload does not block the design ----
{
  const s = new FakeServer(), A = phone(s);
  let uploads = 0;
  A.io.uploadThumbnail = async (d) => { uploads++; return `thumbnails/1/${d.id}.jpg`; };
  A.create('d-1');
  A.st.designs[0] = { ...A.st.designs[0], thumbnailUri: 'file:///thumb.jpg' };
  await sync(A.io);
  assert.equal(uploads, 1);
  assert.equal(A.st.designs[0].thumbnailKey, 'thumbnails/1/d-1.jpg');
  assert.equal(A.st.designs[0].thumbnailUri, 'file:///thumb.jpg', 'local file reference survives the pull');
  A.rename('d-1', 'Renamed');
  await sync(A.io);
  assert.equal(uploads, 1, 'not uploaded again');
  A.create('d-2');
  A.st.designs[1] = { ...A.st.designs[1], thumbnailUri: 'file:///two.jpg' };
  A.io.uploadThumbnail = async () => { throw new Error('storage down'); };
  assert.equal((await sync(A.io)).error, undefined, 'failed picture upload is not a sync error');
  assert.equal(s.designs.length, 2, 'design still synced');
}

// ---- a rejected op does not block the queue ----
{
  const s = new FakeServer(), A = phone(s);
  A.wishToggle('ghost');
  const real = s.api().wishAdd;
  A.io.api = { ...A.io.api, wishAdd: async (id) => { if (id === 'ghost') throw new ApiError(404, 'Product not found'); return real(id); } };
  A.wishToggle('ok-1');
  const r = await sync(A.io);
  assert.equal(A.st.outbox.length, 0, 'bad op dropped, good op sent');
  assert.deepEqual(s.wish.map((w) => w.id), ['ok-1']);
  assert.ok(r.error);
}

// ---------- HTTP client: refresh on 401, one in-flight refresh, sign out on failure ----------
function fakeFetch(handler: (url: string, init: RequestInit) => { status: number; body?: unknown }) {
  const log: string[] = [];
  const f = (async (url: string, init: RequestInit = {}) => {
    log.push(`${init.method ?? 'GET'} ${url.replace('http://api', '')}`);
    const r = handler(url, init);
    return new Response(r.status === 204 ? null : JSON.stringify(r.body ?? {}), { status: r.status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { f, log };
}
const hdr = (init: RequestInit) => (init.headers as Record<string, string>)?.authorization;

{ // 401 -> refresh -> retry succeeds with the new token
  let tokens: Tokens | null = { accessToken: 'old', refreshToken: 'r1' };
  const { f, log } = fakeFetch((url, init) => {
    if (url.endsWith('/auth/refresh')) return { status: 200, body: { accessToken: 'new', refreshToken: 'r2' } };
    return hdr(init) === 'Bearer new' ? { status: 200, body: { ok: 1 } } : { status: 401, body: { error: 'expired' } };
  });
  const http = createHttp({ baseUrl: 'http://api', tokens: { get: () => tokens, set: (t) => { tokens = t; } }, fetchImpl: f });
  assert.deepEqual(await http.request('/me'), { ok: 1 });
  assert.deepEqual(tokens, { accessToken: 'new', refreshToken: 'r2' });
  assert.deepEqual(log, ['GET /me', 'POST /auth/refresh', 'GET /me']);
}
{ // three parallel 401s share ONE refresh
  let tokens: Tokens | null = { accessToken: 'old', refreshToken: 'r1' };
  let refreshes = 0;
  const { f } = fakeFetch((url, init) => {
    if (url.endsWith('/auth/refresh')) { refreshes++; return { status: 200, body: { accessToken: 'new', refreshToken: 'r2' } }; }
    return hdr(init) === 'Bearer new' ? { status: 200, body: {} } : { status: 401 };
  });
  const http = createHttp({ baseUrl: 'http://api', tokens: { get: () => tokens, set: (t) => { tokens = t; } }, fetchImpl: f });
  await Promise.all([http.request('/a'), http.request('/b'), http.request('/c')]);
  assert.equal(refreshes, 1);
}
{ // refresh rejected -> signed out, typed error
  let tokens: Tokens | null = { accessToken: 'old', refreshToken: 'dead' };
  let out = 0;
  const { f } = fakeFetch((url) => (url.endsWith('/auth/refresh') ? { status: 401, body: { error: 'Session expired' } } : { status: 401, body: { error: 'expired' } }));
  const http = createHttp({ baseUrl: 'http://api', tokens: { get: () => tokens, set: (t) => { tokens = t; } }, onSignedOut: () => { out++; }, fetchImpl: f });
  await assert.rejects(() => http.request('/me'), (e: unknown) => e instanceof ApiError && e.status === 401);
  assert.equal(tokens, null);
  assert.equal(out, 1);
}
{ // offline during refresh keeps the session; network errors are typed
  let tokens: Tokens | null = { accessToken: 'old', refreshToken: 'r1' };
  const http = createHttp({ baseUrl: 'http://api', tokens: { get: () => tokens, set: (t) => { tokens = t; } }, fetchImpl: (async () => { throw new TypeError('network'); }) as unknown as typeof fetch });
  await assert.rejects(() => http.request('/me'), (e: unknown) => e instanceof ApiError && e.isNetwork);
  assert.ok(tokens, 'still signed in');
}
{ // public calls (login) never try to refresh; errors carry the server message
  const { f, log } = fakeFetch(() => ({ status: 401, body: { error: 'Email or password is incorrect' } }));
  const http = createHttp({ baseUrl: 'http://api', tokens: { get: () => ({ accessToken: 'x', refreshToken: 'y' }), set: () => {} }, fetchImpl: f });
  await assert.rejects(() => http.request('/auth/login', { method: 'POST', body: {}, auth: false }), /Email or password/);
  assert.deepEqual(log, ['POST /auth/login']);
}
assert.equal(apiBase('http://h:4000'), 'http://h:4000/v1');
assert.equal(apiBase('http://h:4000/'), 'http://h:4000/v1');
assert.equal(apiBase('https://h/v1/'), 'https://h/v1');
assert.equal(apiBase(''), '');

console.log('sync engine + http client tests passed');
