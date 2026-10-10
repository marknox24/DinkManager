// Shared helpers for the CDN-cached public read endpoints. The leading
// underscore keeps Vercel from exposing this file as a route of its own.
//
// Why these exist: spectators' phones and venue TVs all ask the database for
// the same answer every few seconds. Served from here with a short
// s-maxage, Vercel's CDN answers all of them from one cached copy, so
// database load stays flat no matter how big the crowd gets. They use the
// same anon key as the browser, so they can only read what RLS already lets
// an anonymous visitor read.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function supabaseConfig() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  return url && key ? { url, key, headers: { apikey: key, Authorization: `Bearer ${key}` } } : null;
}

// Errors are never cached, so one slow moment can't get stuck at the edge.
export function sendError(res, status, message) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json({ error: message });
}

export function sendCached(res, body, { maxAge, staleWhileRevalidate }) {
  res.setHeader('Cache-Control', `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
  res.status(200).json(body);
}

export const UPSTREAM_TIMEOUT_MS = 8000;
