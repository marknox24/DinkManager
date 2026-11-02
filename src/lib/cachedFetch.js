// Reads from a CDN-cached /api endpoint (api/*.js) so a crowd of viewers
// shares one database query. Returns null on ANY problem — endpoint missing
// (local dev serves index.html there), erroring, 404, malformed, or slow —
// so callers can fall back to querying Supabase directly. The timeout matters
// on a phone with a bad venue wifi connection: without it, a hung request
// blocks every caller that's `await`ing this before they can fall back to
// anything.
//
// A 5xx or timeout is tried once more after a random pause before giving up.
// Those usually mean a crowd missed the cache together: by the time a viewer
// retries, one of the others has filled it, while falling straight back would
// add every one of them to the database's queue at its busiest moment.
const TIMEOUT_MS = 8000;
const RETRY_TIMEOUT_MS = 4000;
const RETRY_MIN_DELAY_MS = 300;
const RETRY_DELAY_SPREAD_MS = 1200;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function attempt(url, isValid, timeoutMs) {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { body: null, retryable: res.status >= 500 };
    const body = await res.json();
    return { body: isValid(body) ? body : null, retryable: false };
  } catch (e) {
    // A timeout or dropped connection is worth another try; an unparseable
    // body (index.html from local dev) isn't.
    return { body: null, retryable: e?.name !== 'SyntaxError' };
  }
}

export async function fetchCachedJson(url, isValid, { retryDelayMs = RETRY_MIN_DELAY_MS + Math.random() * RETRY_DELAY_SPREAD_MS } = {}) {
  const first = await attempt(url, isValid, TIMEOUT_MS);
  if (!first.retryable) return first.body;
  await wait(retryDelayMs);
  return (await attempt(url, isValid, RETRY_TIMEOUT_MS)).body;
}
