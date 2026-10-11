// Reads from a CDN-cached /api endpoint (api/*.js) so a crowd of viewers
// shares one database query. Returns null on ANY problem — endpoint missing
// (local dev serves index.html there), erroring, 404, malformed, or slow —
// so callers fall straight back to querying Supabase directly. The timeout
// matters on a phone with a bad venue wifi connection: without it, a hung
// request blocks every caller that's `await`ing this before they can fall
// back to anything.
const TIMEOUT_MS = 8000;

export async function fetchCachedJson(url, isValid) {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const body = await res.json();
    return isValid(body) ? body : null;
  } catch {
    return null;
  }
}
