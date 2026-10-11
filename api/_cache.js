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

// Validates a comma-separated list of category-id query params, shared by
// every endpoint that takes `?categories=`.
export function parseCategoryIds(raw, maxCategories = 50) {
  const ids = String(raw || '')
    .split(',')
    .filter(Boolean);
  if (ids.length === 0 || ids.length > maxCategories || !ids.every(isUuid)) return null;
  return ids;
}

// Shared by every /api/*.js endpoint that reads a bracket-joined table
// (teams, matches) filtered by category — api/event-teams.js and
// api/schedule-matches.js differ only in the table name and the `select`
// columns, so a fix to the pagination bound or the bracket-unwrap mapping
// now only needs to happen once. Pages through PostgREST's 1000-row cap and
// flattens the joined `bracket` relation onto each row the same way both
// callers already expected.
export async function fetchPaginatedByCategory(cfg, { table, select, categoryIds }) {
  const PAGE = 1000;
  const MAX_PAGES = 10;
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      select,
      'bracket.category_id': `in.(${categoryIds.join(',')})`,
      order: 'created_at.asc,id.asc',
      limit: String(PAGE),
      offset: String(page * PAGE),
    });
    const upstream = await fetch(`${cfg.url}/rest/v1/${table}?${params}`, {
      headers: cfg.headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const data = await upstream.json();
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows.map(({ bracket, ...row }) => ({
    ...row,
    bracket_letter: bracket.letter,
    bracket_kind: bracket.kind,
    category_id: bracket.category_id,
  }));
}
