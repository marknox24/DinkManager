import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchCachedJson } from '../lib/cachedFetch.js';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// Each entry is one response, in order; an Error is thrown instead of returned.
function mockResponses(...responses) {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return calls;
}
const json = (body) => new Response(JSON.stringify(body), { status: 200 });
const status = (code) => new Response('nope', { status: code });
const anyBody = (b) => Boolean(b);
const noDelay = { retryDelayMs: 0 };

test('a good response is returned with no second request', async () => {
  const calls = mockResponses(json({ ok: 1 }));
  assert.deepEqual(await fetchCachedJson('/api/x', anyBody, noDelay), { ok: 1 });
  assert.equal(calls.length, 1);
});

test('a 5xx is retried once, so a viewer gets the copy someone else just cached', async () => {
  const calls = mockResponses(status(502), json({ ok: 1 }));
  assert.deepEqual(await fetchCachedJson('/api/x', anyBody, noDelay), { ok: 1 });
  assert.equal(calls.length, 2);
});

test('a timeout is retried too', async () => {
  const timeout = new Error('timed out');
  timeout.name = 'TimeoutError';
  const calls = mockResponses(timeout, json({ ok: 1 }));
  assert.deepEqual(await fetchCachedJson('/api/x', anyBody, noDelay), { ok: 1 });
  assert.equal(calls.length, 2);
});

test('it gives up after one retry, and never keeps a crowd hammering', async () => {
  const calls = mockResponses(status(502), status(502), json({ ok: 1 }));
  assert.equal(await fetchCachedJson('/api/x', anyBody, noDelay), null);
  assert.equal(calls.length, 2);
});

test('a 404 is an answer, not a failure: drafts fall back at once', async () => {
  const calls = mockResponses(status(404), json({ ok: 1 }));
  assert.equal(await fetchCachedJson('/api/x', anyBody, noDelay), null);
  assert.equal(calls.length, 1);
});

test('a non-JSON page (local dev serves index.html) is not retried', async () => {
  const calls = mockResponses(new Response('<html>', { status: 200 }), json({ ok: 1 }));
  assert.equal(await fetchCachedJson('/api/x', anyBody, noDelay), null);
  assert.equal(calls.length, 1);
});

test('a body that fails validation is not retried', async () => {
  const calls = mockResponses(json({ wrong: true }), json({ ok: 1 }));
  assert.equal(await fetchCachedJson('/api/x', (b) => Boolean(b.ok), noDelay), null);
  assert.equal(calls.length, 1);
});
