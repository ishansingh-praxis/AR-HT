import assert from 'node:assert/strict';
import { scrubEvent, scrubString, scrubValue } from '../shared/scrub.mjs';

const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIn0.abcdefghijklmnop12345';
assert.equal(scrubString('mail asha.rao+test@example.co.in now'), 'mail [removed] now');
assert.equal(scrubString(`failed with Bearer ${jwt}`), 'failed with Bearer [removed]');
assert.equal(scrubString(`token ${jwt} leaked`), 'token [removed] leaked');
assert.equal(scrubString('nothing secret here'), 'nothing secret here');

const input = {
  message: 'Login failed for a@b.com',
  request: { url: 'https://x/v1/auth/login', headers: { Authorization: `Bearer ${jwt}`, 'user-agent': 'x' }, cookies: { s: '1' }, data: { password: 'hunter2' } },
  extra: { refreshToken: 'abc', nested: { code: '123456', ok: 'fine', list: ['c@d.com', 7] } },
  user: { id: 42, email: 'a@b.com', ip_address: '1.2.3.4', username: 'asha' },
};
const clean = scrubEvent(input);
const text = JSON.stringify(clean);
for (const secret of ['a@b.com', 'c@d.com', 'hunter2', jwt, '123456', '1.2.3.4', 'asha']) assert.ok(!text.includes(secret), `leaked: ${secret}`);
assert.equal(clean.user?.id, '42');
assert.equal(clean.request.headers['user-agent'], 'x', 'harmless fields survive');
assert.equal(clean.request.headers.Authorization, '[removed]');
assert.equal(clean.extra.nested.ok, 'fine');
assert.equal(clean.extra.nested.list[1], 7);
assert.equal(clean.request.cookies, undefined);
assert.equal(clean.request.data, undefined);
assert.ok(JSON.stringify(input).includes('a@b.com'), 'the input is not modified');
assert.equal(scrubEvent({ message: 'ok' }).user, undefined);
assert.deepEqual(scrubValue([1, 'x', null, undefined]), [1, 'x', null, undefined]);
const circularish: any = {}; let cur = circularish; for (let i = 0; i < 30; i++) { cur.n = {}; cur = cur.n; }
assert.ok(JSON.stringify(scrubValue(circularish)).includes('[removed]'), 'absurdly deep objects are cut off, not crashed on');

console.log('scrub tests passed');
