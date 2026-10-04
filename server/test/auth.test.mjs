import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { openDb, seedProducts } from '../src/db.mjs';
import { createApp } from '../src/app.mjs';
import { hashPassword, verifyPassword, needsRehash, passwordProblem } from '../src/lib/passwords.mjs';

const catalogue = JSON.parse(fs.readFileSync('../src/data/catalogue.json', 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ht-auth-'));
const PW = 'Correct-Horse-91';
let server, base, db, outbox, adminTok, storageDir;
const socialMock = { google: null, apple: null };

const call = async (method, url, { token, json } = {}) => {
  const res = await fetch(base + '/v1' + url, { method, headers: { ...(token && { authorization: `Bearer ${token}` }), ...(json && { 'content-type': 'application/json' }) }, body: json ? JSON.stringify(json) : undefined });
  const text = await res.text();
  let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
};
const register = (email, password = PW) => call('POST', '/auth/register', { json: { email, password } });
const lastCode = (to) => [...outbox].reverse().find((m) => m.to === to).text.match(/(\d{6})/)[1];

before(async () => {
  db = openDb(); seedProducts(db, catalogue);
  storageDir = path.join(tmp, 'uploads');
  const mailer = { outbox: [], send: async (m) => { mailer.outbox.push(m); } };
  outbox = mailer.outbox;
  const app = createApp({
    db, jwtSecret: 'test-secret-1234567', uploadDir: storageDir, publicUrl: 'http://x', authLimit: 3000, mail: mailer,
    verifyGoogle: async (t) => socialMock.google(t), verifyApple: async (t) => socialMock.apple(t),
  });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}`;
  adminTok = (await register('root@x.com')).body.accessToken;
  db.prepare("UPDATE users SET role='admin' WHERE email='root@x.com'").run();
});
after(() => server.close());

test('passwords: scrypt hash verifies, old bcrypt verifies and is flagged for rehash, social-only never matches', async () => {
  const h = await hashPassword('s3cret-pass');
  assert.ok(await verifyPassword('s3cret-pass', h));
  assert.ok(!(await verifyPassword('s3cret-pasX', h)));
  assert.equal(needsRehash(h), false);
  const old = bcrypt.hashSync('legacy-pass-1', 4);
  assert.ok(await verifyPassword('legacy-pass-1', old));
  assert.equal(needsRehash(old), true);
  assert.equal(await verifyPassword('anything', '!'), false);
});

test('passwords: min length, common-password list, email name', () => {
  assert.match(passwordProblem('short'), /8 characters/);
  assert.match(passwordProblem('password1'), /too common/);
  assert.match(passwordProblem('myjohnsmith99', 'johnsmith@x.com'), /email/);
  assert.equal(passwordProblem('Correct-Horse-91', 'a@b.com'), null);
});

test('register: weak password refused, session returned, verification mail sent, role is user', async () => {
  const weak = await register('weak@x.com', 'password1');
  assert.equal(weak.status, 400);
  const ok = await register('new@x.com');
  assert.equal(ok.status, 201);
  assert.ok(ok.body.accessToken && ok.body.refreshToken && ok.body.token === ok.body.accessToken);
  assert.equal(ok.body.expiresIn, 900);
  assert.equal(ok.body.user.role, 'user');
  assert.equal(ok.body.user.emailVerified, false);
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(outbox.some((m) => m.to === 'new@x.com' && /code/i.test(m.text)));
});

test('refresh rotates; reusing an old refresh token revokes the whole family', async () => {
  const s1 = (await register('rot@x.com')).body;
  const r1 = await call('POST', '/auth/refresh', { json: { refreshToken: s1.refreshToken } });
  assert.equal(r1.status, 200);
  assert.notEqual(r1.body.refreshToken, s1.refreshToken);
  assert.equal((await call('GET', '/me', { token: r1.body.accessToken })).status, 200);
  // replaying the first token = theft signal
  assert.equal((await call('POST', '/auth/refresh', { json: { refreshToken: s1.refreshToken } })).status, 401);
  // ...and now even the newest token of that family is dead
  assert.equal((await call('POST', '/auth/refresh', { json: { refreshToken: r1.body.refreshToken } })).status, 401);
  // a different login of the same user is a different family and is unaffected
  const login = (await call('POST', '/auth/login', { json: { email: 'rot@x.com', password: PW } })).body;
  assert.equal((await call('POST', '/auth/refresh', { json: { refreshToken: login.refreshToken } })).status, 200);
});

test('logout revokes the current token; logout-all revokes every session', async () => {
  const a = (await register('lo@x.com')).body;
  const b = (await call('POST', '/auth/login', { json: { email: 'lo@x.com', password: PW } })).body;
  await call('POST', '/auth/logout', { json: { refreshToken: a.refreshToken } });
  assert.equal((await call('POST', '/auth/refresh', { json: { refreshToken: a.refreshToken } })).status, 401);
  assert.equal((await call('POST', '/auth/logout-all', { token: b.accessToken })).status, 204);
  assert.equal((await call('POST', '/auth/refresh', { json: { refreshToken: b.refreshToken } })).status, 401);
});

test('access tokens expire after 15 minutes', async () => {
  const jwt = (await import('jsonwebtoken')).default;
  const s = (await register('exp@x.com')).body;
  const { sub, exp, iat } = jwt.decode(s.accessToken);
  assert.equal(exp - iat, 900);
  const expired = jwt.sign({ sub }, 'test-secret-1234567', { expiresIn: -10 });
  assert.equal((await call('GET', '/me', { token: expired })).status, 401);
});

test('lockout: 10 wrong passwords lock the account for 15 minutes, even with the right password', async () => {
  await register('lock@x.com');
  for (let i = 0; i < 10; i++) assert.equal((await call('POST', '/auth/login', { json: { email: 'lock@x.com', password: 'wrong-password' } })).status, 401);
  const locked = await call('POST', '/auth/login', { json: { email: 'lock@x.com', password: PW } });
  assert.equal(locked.status, 429);
  db.prepare("UPDATE users SET locked_until=? WHERE email='lock@x.com'").run(Date.now() - 1); // time passes
  assert.equal((await call('POST', '/auth/login', { json: { email: 'lock@x.com', password: PW } })).status, 200);
});

test('login upgrades an old bcrypt hash to scrypt', async () => {
  db.prepare('INSERT INTO users(email,password_hash,role,created_at) VALUES(?,?,?,?)').run('legacy@x.com', bcrypt.hashSync(PW, 4), 'user', Date.now());
  assert.equal((await call('POST', '/auth/login', { json: { email: 'legacy@x.com', password: PW } })).status, 200);
  assert.match(db.prepare("SELECT password_hash h FROM users WHERE email='legacy@x.com'").get().h, /^scrypt\$/);
  assert.equal((await call('POST', '/auth/login', { json: { email: 'legacy@x.com', password: PW } })).status, 200);
});

test('email verification: wrong code counts a try, 5 tries kill the code, right code verifies', async () => {
  const s = (await register('ver@x.com')).body;
  await new Promise((r) => setTimeout(r, 20));
  const code = lastCode('ver@x.com');
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await call('POST', '/auth/verify-email/confirm', { token: s.accessToken, json: { code: wrong } })).status, 400);
  assert.equal((await call('POST', '/auth/verify-email/confirm', { token: s.accessToken, json: { code } })).status, 400, 'dead after 5 tries');
  assert.equal((await call('POST', '/auth/verify-email/request', { token: s.accessToken })).status, 200);
  const fresh = lastCode('ver@x.com');
  assert.equal((await call('POST', '/auth/verify-email/confirm', { token: s.accessToken, json: { code: fresh } })).status, 200);
  assert.equal((await call('GET', '/me', { token: s.accessToken })).body.user.emailVerified, true);
});

test('verification codes expire after 15 minutes', async () => {
  const s = (await register('late@x.com')).body;
  await new Promise((r) => setTimeout(r, 20));
  const code = lastCode('late@x.com');
  db.prepare("UPDATE email_codes SET expires_at=? WHERE user_id=(SELECT id FROM users WHERE email='late@x.com')").run(Date.now() - 1);
  assert.equal((await call('POST', '/auth/verify-email/confirm', { token: s.accessToken, json: { code } })).status, 400);
});

test('password reset: same answer for unknown email, code resets, old sessions die, weak password refused', async () => {
  const s = (await register('reset@x.com')).body;
  assert.equal((await call('POST', '/auth/password/forgot', { json: { email: 'nobody@x.com' } })).status, 200);
  assert.ok(!outbox.some((m) => m.to === 'nobody@x.com'));
  assert.equal((await call('POST', '/auth/password/forgot', { json: { email: 'reset@x.com' } })).status, 200);
  await new Promise((r) => setTimeout(r, 20));
  const code = lastCode('reset@x.com');
  assert.equal((await call('POST', '/auth/password/reset', { json: { email: 'reset@x.com', code, password: 'password1' } })).status, 400, 'weak password refused');
  const code2 = code; // the refused attempt did not use up the code
  assert.equal((await call('POST', '/auth/password/reset', { json: { email: 'reset@x.com', code: code2, password: 'Brand-New-Pass-5' } })).status, 200);
  assert.equal((await call('POST', '/auth/refresh', { json: { refreshToken: s.refreshToken } })).status, 401, 'reset revokes refresh tokens');
  assert.equal((await call('POST', '/auth/login', { json: { email: 'reset@x.com', password: PW } })).status, 401);
  assert.equal((await call('POST', '/auth/login', { json: { email: 'reset@x.com', password: 'Brand-New-Pass-5' } })).status, 200);
  assert.equal((await call('POST', '/auth/password/reset', { json: { email: 'reset@x.com', code: code2, password: 'Another-Pass-77' } })).status, 400, 'code is single use');
});

test('google: creates a verified account, signs in again, links an existing verified email, refuses unverified takeover', async () => {
  socialMock.google = async () => ({ subject: 'g-1', email: 'gee@x.com', emailVerified: true, name: 'Gee' });
  const first = await call('POST', '/auth/google', { json: { idToken: 'x'.repeat(30) } });
  assert.equal(first.status, 200);
  assert.equal(first.body.user.emailVerified, true);
  assert.equal(first.body.user.name, 'Gee');
  const again = await call('POST', '/auth/google', { json: { idToken: 'x'.repeat(30) } });
  assert.equal(again.body.user.id, first.body.user.id);

  await register('exists@x.com');
  socialMock.google = async () => ({ subject: 'g-2', email: 'exists@x.com', emailVerified: true, name: 'E' });
  const linked = await call('POST', '/auth/google', { json: { idToken: 'x'.repeat(30) } });
  assert.equal(linked.status, 200);
  assert.equal(linked.body.user.email, 'exists@x.com');
  assert.equal((await call('POST', '/auth/login', { json: { email: 'exists@x.com', password: PW } })).status, 200, 'password still works');

  await register('victim@x.com');
  socialMock.google = async () => ({ subject: 'g-3', email: 'victim@x.com', emailVerified: false });
  assert.equal((await call('POST', '/auth/google', { json: { idToken: 'x'.repeat(30) } })).status, 409);
  // a social-only account has no password
  assert.equal((await call('POST', '/auth/login', { json: { email: 'gee@x.com', password: '!' } })).status, 401);
});

test('apple: private relay email, name only on first login, later logins by subject only', async () => {
  socialMock.apple = async () => ({ subject: 'a-1', email: 'abc123@privaterelay.appleid.com', emailVerified: true });
  const first = await call('POST', '/auth/apple', { json: { identityToken: 'y'.repeat(30), name: 'Asha Rao' } });
  assert.equal(first.status, 200);
  assert.equal(first.body.user.name, 'Asha Rao');
  socialMock.apple = async () => ({ subject: 'a-1' }); // no email the second time
  const second = await call('POST', '/auth/apple', { json: { identityToken: 'y'.repeat(30) } });
  assert.equal(second.status, 200);
  assert.equal(second.body.user.id, first.body.user.id);
  socialMock.apple = async () => ({ subject: 'a-new' }); // new subject and no email: cannot make an account
  assert.equal((await call('POST', '/auth/apple', { json: { identityToken: 'y'.repeat(30) } })).status, 400);
});

test('social sign-in without server setup says so (501) instead of crashing', async () => {
  const app = createApp({ db: openDb(), jwtSecret: 'test-secret-1234567', uploadDir: path.join(tmp, 'u2'), mail: { send: async () => {} } });
  const srv = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const res = await fetch(`http://localhost:${srv.address().port}/v1/auth/google`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: 'z'.repeat(30) }) });
  assert.equal(res.status, 501);
  srv.close();
});

test('me: update name; delete removes designs, wishlist, identities, tokens and stored thumbnails', async () => {
  const s = (await register('gone@x.com')).body;
  assert.equal((await call('PATCH', '/me', { token: s.accessToken, json: { name: 'Gone Girl' } })).body.user.name, 'Gone Girl');
  await call('POST', '/designs', { token: s.accessToken, json: { items: [{ productId: catalogue[0].id, offset: [0, 0, 0], rotationY: 0, scale: 1 }] } });
  await call('PUT', `/wishlist/${catalogue[0].id}`, { token: s.accessToken });
  const id = s.user.id;
  fs.mkdirSync(path.join(storageDir, 'thumbnails', String(id)), { recursive: true });
  fs.writeFileSync(path.join(storageDir, 'thumbnails', String(id), 'a.jpg'), 'x');
  assert.equal((await call('DELETE', '/me', { token: s.accessToken })).status, 204);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM designs WHERE user_id=?').get(id).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM wishlist WHERE user_id=?').get(id).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM refresh_tokens WHERE user_id=?').get(id).n, 0);
  assert.equal(fs.existsSync(path.join(storageDir, 'thumbnails', String(id))), false);
  assert.equal((await call('GET', '/me', { token: s.accessToken })).status, 401);
});

test('account delete page is public HTML', async () => {
  const res = await fetch(`${base}/account/delete`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Delete your HomeTown AR account/);
});

test('roles: editor can manage products but not users or the audit log; admin writes are audited; users can be disabled', async () => {
  const ed = (await register('editor@x.com')).body;
  const user = (await register('plain@x.com')).body;
  const adminList = await call('GET', '/admin/users?q=editor', { token: adminTok });
  assert.equal(adminList.status, 200);
  const edId = adminList.body[0].id;
  assert.equal((await call('PATCH', `/admin/users/${edId}`, { token: user.accessToken, json: { role: 'editor' } })).status, 403);
  assert.equal((await call('PATCH', `/admin/users/${edId}`, { token: adminTok, json: { role: 'editor' } })).body.role, 'editor');
  assert.equal((await call('GET', '/admin/users', { token: ed.accessToken })).status, 403, 'editor cannot list users');
  assert.equal((await call('GET', '/admin/audit', { token: ed.accessToken })).status, 403);
  assert.equal((await call('GET', `/admin/models/${catalogue[0].id}`, { token: ed.accessToken })).status, 200, 'editor can reach model tools');
  assert.equal((await call('GET', `/admin/models/${catalogue[0].id}`, { token: user.accessToken })).status, 403);
  // cannot change yourself
  const rootId = db.prepare("SELECT id FROM users WHERE email='root@x.com'").get().id;
  assert.equal((await call('PATCH', `/admin/users/${rootId}`, { token: adminTok, json: { role: 'user' } })).status, 400);
  // disabling kills sessions
  const uid = user.user.id;
  assert.equal((await call('PATCH', `/admin/users/${uid}`, { token: adminTok, json: { disabled: true } })).body.disabled, true);
  assert.equal((await call('GET', '/me', { token: user.accessToken })).status, 403);
  assert.equal((await call('POST', '/auth/refresh', { json: { refreshToken: user.refreshToken } })).status, 401);
  assert.equal((await call('POST', '/auth/login', { json: { email: 'plain@x.com', password: PW } })).status, 403);
  const log = (await call('GET', '/admin/audit', { token: adminTok })).body;
  assert.ok(log.some((x) => x.action === 'user.update' && x.target === String(edId)));
  assert.equal((await call('DELETE', `/admin/users/${uid}`, { token: adminTok })).status, 204);
});

test('rate limits: login is limited per email', async () => {
  const app = createApp({ db: openDb(), jwtSecret: 'test-secret-1234567', uploadDir: path.join(tmp, 'u3'), authLimit: 15, mail: { send: async () => {} } });
  const srv = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const url = `http://localhost:${srv.address().port}/v1/auth/login`;
  const statuses = [];
  for (let i = 0; i < 8; i++) statuses.push((await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'same@x.com', password: 'nope-nope' }) })).status);
  assert.ok(statuses.includes(429), statuses.join(','));
  // a different email from the same IP is still allowed (IP limit is higher)
  assert.equal((await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'other@x.com', password: 'nope-nope' }) })).status, 401);
  srv.close();
});
