// CDN-cached copy of public_event_roster, behind the Who's playing section.
// That section sits at the top of every public event page, so this runs on
// every visit rather than only when someone opens a tab: every viewer shares
// one cached copy instead of each sending a query to the database. Registrations
// arrive slowly, so 60s is plenty; a player who has just registered bypasses
// this (see noteRosterChanged in src/data/eventsApi.js).
//
//   /api/event-roster?event=<uuid>
//
// Registration's own duplicate check stays on the direct path, since it needs
// the current answer.
import { fetchAllPages, isUuid, LONG_STALE_WINDOW_SECONDS, sendCached, sendError, supabaseConfig } from './_cache.js';

export default async function handler(req, res) {
  const { event } = req.query;
  if (!isUuid(event)) return sendError(res, 400, 'event must be a UUID');
  const cfg = supabaseConfig();
  if (!cfg) return sendError(res, 500, 'Supabase is not configured');

  try {
    // Paged: the 1000-row cap applies to set-returning functions too. The
    // order matches the function's own (newest first), with id to keep pages
    // stable.
    const rows = await fetchAllPages(cfg, 'rpc/public_event_roster', { p_event_id: event, order: 'created_at.desc,id.desc' });
    sendCached(res, rows, { maxAge: 60, staleWhileRevalidate: LONG_STALE_WINDOW_SECONDS });
  } catch {
    sendError(res, 502, 'roster unavailable');
  }
}
