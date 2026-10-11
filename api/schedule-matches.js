// CDN-cached copy of the matches query behind the public Match Schedule —
// the heaviest recurring read (every match in the event, with joins).
// Cached for 15s (stale-while-revalidate 30s). Returns the same row shape as
// listScheduleMatchesForEvent in src/data/bracketsApi.js; keep them in sync.
import { fetchPaginatedByCategory, parseCategoryIds, sendCached, sendError, supabaseConfig } from './_cache.js';

const SELECT =
  '*,bracket:bracket_id!inner(letter,kind,category_id),team_a:team_a_id(id,player1_name,player2_name,club_name),team_b:team_b_id(id,player1_name,player2_name,club_name)';

export default async function handler(req, res) {
  const ids = parseCategoryIds(req.query.categories);
  if (!ids) return sendError(res, 400, 'categories must be 1-50 comma-separated UUIDs');
  const cfg = supabaseConfig();
  if (!cfg) return sendError(res, 500, 'Supabase is not configured');

  try {
    const mapped = await fetchPaginatedByCategory(cfg, { table: 'matches', select: SELECT, categoryIds: ids });
    sendCached(res, mapped, { maxAge: 15, staleWhileRevalidate: 30 });
  } catch {
    sendError(res, 502, 'schedule unavailable');
  }
}
