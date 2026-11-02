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
import { isUuid, LONG_STALE_WINDOW_SECONDS, sendCached, sendError, supabaseConfig, UPSTREAM_TIMEOUT_MS } from './_cache.js';

export default async function handler(req, res) {
  const { event } = req.query;
  if (!isUuid(event)) return sendError(res, 400, 'event must be a UUID');
  const cfg = supabaseConfig();
  if (!cfg) return sendError(res, 500, 'Supabase is not configured');

  try {
    const params = new URLSearchParams({ p_event_id: event });
    const upstream = await fetch(`${cfg.url}/rest/v1/rpc/public_event_roster?${params}`, {
      headers: cfg.headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!upstream.ok) return sendError(res, 502, 'roster unavailable');
    sendCached(res, await upstream.json(), { maxAge: 60, staleWhileRevalidate: LONG_STALE_WINDOW_SECONDS });
  } catch {
    sendError(res, 502, 'roster unavailable');
  }
}
