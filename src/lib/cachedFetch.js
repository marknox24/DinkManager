// Reads from a CDN-cached /api endpoint (api/*.js) so a crowd of viewers
// shares one database query. Returns null on ANY problem — endpoint missing
// (local dev serves index.html there), erroring, 404, or malformed — so
// callers fall straight back to querying Supabase directly.
export async function fetchCachedJson(url, isValid) {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const body = await res.json();
    return isValid(body) ? body : null;
  } catch {
    return null;
  }
}
