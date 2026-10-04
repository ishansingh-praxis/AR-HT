import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler } from '../src/middleware/errors.mjs';
import { initMonitoring } from '../src/lib/monitoring.mjs';

const run = (handler, err, req = { id: 'req-1', method: 'GET', path: '/v1/x', log: { error() {} } }) => {
  const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  handler(err, req, res, () => {});
  return res;
};

test('unexpected errors are reported once with the request id and hidden from the client', () => {
  const seen = [];
  const res = run(errorHandler((e, ctx) => seen.push([e.message, ctx])), new Error('db exploded: token=abc'));
  assert.equal(res.code, 500);
  assert.deepEqual(res.body, { error: 'Something went wrong', requestId: 'req-1' }, 'no internals leak to the client');
  assert.deepEqual(seen, [['db exploded: token=abc', { requestId: 'req-1', method: 'GET', path: '/v1/x' }]]);
});

test('expected errors (4xx) are not reported', () => {
  const seen = [];
  const h = errorHandler((e) => seen.push(e));
  assert.equal(run(h, Object.assign(new Error('nope'), { status: 404 })).code, 404);
  assert.equal(run(h, Object.assign(new Error('x'), { type: 'entity.parse.failed' })).code, 400);
  assert.equal(run(h, Object.assign(new Error('x'), { type: 'entity.too.large' })).code, 413);
  assert.equal(seen.length, 0);
});

test('a failing reporter never breaks the response', () => {
  const res = run(errorHandler(() => { throw new Error('sentry is down'); }), new Error('boom'));
  assert.equal(res.code, 500);
});

test('monitoring is off without a DSN: the reporter does nothing', () => {
  const report = initMonitoring({ dsn: '', release: 'x', environment: 'test' });
  assert.equal(report(new Error('x'), {}), undefined);
});
