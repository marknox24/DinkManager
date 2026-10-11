// CDN-cached copy of the teams query behind the public Single Elimination
// bracket view (listTeamsForEvent in src/data/bracketsApi.js — keep the two
// in sync). Teams only change when brackets are drawn/redrawn, so 60s is
// plenty; every spectator shares one cached copy instead of each running a
// joined teams query.
import { fetchPaginatedByCategory, parseCategoryIds, sendCached, sendError, supabaseConfig } from './_cache.js';

const SELECT = '*,bracket:bracket_id!inner(letter,kind,category_id)';

export default async function handler(req, res) {
  const ids = parseCategoryIds(req.query.categories);
  if (!ids) return sendError(res, 400, 'categories must be 1-50 comma-separated UUIDs');
  const cfg = supabaseConfig();
  if (!cfg) return sendError(res, 500, 'Supabase is not configured');

  try {
    const mapped = await fetchPaginatedByCategory(cfg, { table: 'teams', select: SELECT, categoryIds: ids });
    sendCached(res, mapped, { maxAge: 60, staleWhileRevalidate: 120 });
  } catch {
    sendError(res, 502, 'teams unavailable');
  }
}
