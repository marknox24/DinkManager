// CDN-cached copy of the public_checkin_roster view that the self-check-in
// flow (CheckInPage.jsx) reads from. Previously every player who opened a
// category, or confirmed a check-in, sent a fresh uncached query straight to
// Supabase — fine for one person, but a crowd arriving at once (the common
// case: everyone checks in in the 10 minutes before an event starts) turned
// into a direct-to-Postgres stampede, the same pattern already fixed for the
// Preview Screen and Match Schedule.
//
// 5s cache: short enough that the "already checked in" marker in the name
// search still feels current, long enough that a hundred phones opening the
// same category cost one query instead of a hundred.
//
//   /api/checkin-roster?event=<uuid>            (whole event, all categories)
//   /api/checkin-roster?event=<uuid>&category=<uuid>   (one category)
//
// The actual check-in write, and the read immediately after it that
// confirms the write succeeded, stay on the direct Supabase path in
// src/data/eventsApi.js — only roster *browsing* goes through this cache.
import { isUuid, sendCached, sendError, supabaseConfig, UPSTREAM_TIMEOUT_MS } from './_cache.js';

export default async function handler(req, res) {
  const { event, category } = req.query;
  if (!isUuid(event)) return sendError(res, 400, 'event must be a UUID');
  if (category !== undefined && !isUuid(category)) return sendError(res, 400, 'category must be a UUID');
  const cfg = supabaseConfig();
  if (!cfg) return sendError(res, 500, 'Supabase is not configured');

  try {
    const params = new URLSearchParams({ select: '*', event_id: `eq.${event}` });
    if (category) params.set('category_id', `eq.${category}`);
    const upstream = await fetch(`${cfg.url}/rest/v1/public_checkin_roster?${params}`, {
      headers: cfg.headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!upstream.ok) return sendError(res, 502, 'roster unavailable');
    sendCached(res, await upstream.json(), { maxAge: 5, staleWhileRevalidate: 10 });
  } catch {
    sendError(res, 502, 'roster unavailable');
  }
}
