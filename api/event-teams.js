// CDN-cached copy of the teams query behind the public Single Elimination
// bracket view (listTeamsForEvent in src/data/bracketsApi.js — keep the two
// in sync). Teams only change when brackets are drawn/redrawn, so 60s is
// plenty; every spectator shares one cached copy instead of each running a
// joined teams query.
import { isUuid, sendCached, sendError, supabaseConfig, UPSTREAM_TIMEOUT_MS } from './_cache.js';

const SELECT = '*,bracket:bracket_id!inner(letter,kind,category_id)';
const PAGE = 1000;
const MAX_PAGES = 10;
const MAX_CATEGORIES = 50;

export default async function handler(req, res) {
  const ids = String(req.query.categories || '')
    .split(',')
    .filter(Boolean);
  if (ids.length === 0 || ids.length > MAX_CATEGORIES || !ids.every(isUuid)) {
    return sendError(res, 400, 'categories must be 1-50 comma-separated UUIDs');
  }
  const cfg = supabaseConfig();
  if (!cfg) return sendError(res, 500, 'Supabase is not configured');

  try {
    const rows = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const params = new URLSearchParams({
        select: SELECT,
        'bracket.category_id': `in.(${ids.join(',')})`,
        order: 'created_at.asc,id.asc',
        limit: String(PAGE),
        offset: String(page * PAGE),
      });
      const upstream = await fetch(`${cfg.url}/rest/v1/teams?${params}`, {
        headers: cfg.headers,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!upstream.ok) return sendError(res, 502, 'teams unavailable');
      const data = await upstream.json();
      rows.push(...data);
      if (data.length < PAGE) break;
    }
    const mapped = rows.map(({ bracket, ...t }) => ({
      ...t,
      bracket_letter: bracket.letter,
      bracket_kind: bracket.kind,
      category_id: bracket.category_id,
    }));
    sendCached(res, mapped, { maxAge: 60, staleWhileRevalidate: 120 });
  } catch {
    sendError(res, 502, 'teams unavailable');
  }
}
