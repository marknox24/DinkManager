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

// How long the CDN may keep answering from a stale copy while one background
// request refreshes it. This is what protects the database from a crowd: a
// viewer only forces a real read when nobody has asked for this exact response
// within the window, so the window has to outlast a quiet spell, not a poll.
// Otherwise a crowd arriving together (a QR code at the opening ceremony) all
// miss at once, and each holds a database connection until they queue past
// UPSTREAM_TIMEOUT_MS. The cost is small: the first viewer after a quiet spell
// sees the old copy until their next poll.
export const LONG_STALE_WINDOW_SECONDS = 3600;

// Validates a comma-separated list of category-id query params, shared by
// every endpoint that takes `?categories=`. 200 is far past any real event
// (Business plans have unlimited categories) and still keeps the URL here and
// the in.(...) filter sent upstream well under Vercel's 14KB URL limit.
// Over the cap, the client falls back to reading the database directly.
export function parseCategoryIds(raw, maxCategories = 200) {
  const ids = String(raw || '')
    .split(',')
    .filter(Boolean);
  if (ids.length === 0 || ids.length > maxCategories || !ids.every(isUuid)) return null;
  return ids;
}

// Reads every row of a PostgREST table, view, or set-returning RPC, paging
// through its 1000-row response cap. `params` must include a stable `order`
// (ending in a unique column) or pages can overlap or skip rows. Throws
// rather than returning a partial list when the result is bigger than
// MAX_PAGES: callers send an uncached error, and the client falls back to
// its own direct read, which pages without a ceiling. A truncated list
// cached at the edge would silently hide players or matches from everyone.
export async function fetchAllPages(cfg, path, params) {
  const PAGE = 1000;
  const MAX_PAGES = 20;
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams(params);
    query.set('limit', String(PAGE));
    query.set('offset', String(page * PAGE));
    const upstream = await fetch(`${cfg.url}/rest/v1/${path}?${query}`, {
      headers: cfg.headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const data = await upstream.json();
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
  throw new Error(`more than ${PAGE * MAX_PAGES} rows`);
}

// Shared by every /api/*.js endpoint that reads a bracket-joined table
// (teams, matches) filtered by category — api/event-teams.js and
// api/schedule-matches.js differ only in the table name and the `select`
// columns, so a fix to the pagination bound or the bracket-unwrap mapping
// now only needs to happen once. Flattens the joined `bracket` relation onto
// each row the same way both callers already expected.
export async function fetchPaginatedByCategory(cfg, { table, select, categoryIds }) {
  const rows = await fetchAllPages(cfg, table, {
    select,
    'bracket.category_id': `in.(${categoryIds.join(',')})`,
    order: 'created_at.asc,id.asc',
  });
  return rows.map(({ bracket, ...row }) => ({
    ...row,
    bracket_letter: bracket.letter,
    bracket_kind: bracket.kind,
    category_id: bracket.category_id,
  }));
}
