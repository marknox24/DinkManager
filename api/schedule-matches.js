// CDN-cached copy of the matches query behind the public Match Schedule —
// the heaviest recurring read (every match in the event, with joins).
// Cached for 15s (stale-while-revalidate 30s). Returns the same row shape as
// listScheduleMatchesForEvent in src/data/bracketsApi.js; keep them in sync.
import { isUuid, sendCached, sendError, supabaseConfig, UPSTREAM_TIMEOUT_MS } from './_cache.js';

const SELECT =
  '*,bracket:bracket_id!inner(letter,kind,category_id),team_a:team_a_id(id,player1_name,player2_name,club_name),team_b:team_b_id(id,player1_name,player2_name,club_name)';
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
      const upstream = await fetch(`${cfg.url}/rest/v1/matches?${params}`, {
        headers: cfg.headers,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!upstream.ok) return sendError(res, 502, 'schedule unavailable');
      const data = await upstream.json();
      rows.push(...data);
      if (data.length < PAGE) break;
    }
    const mapped = rows.map(({ bracket, ...m }) => ({
      ...m,
      bracket_letter: bracket.letter,
      bracket_kind: bracket.kind,
      category_id: bracket.category_id,
    }));
    sendCached(res, mapped, { maxAge: 15, staleWhileRevalidate: 30 });
  } catch {
    sendError(res, 502, 'schedule unavailable');
  }
}
