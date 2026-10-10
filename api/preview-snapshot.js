// CDN-cached copy of the preview_live_snapshot RPC that the Preview Screen
// polls. Cached for 10s (then served stale for up to 20s more while it
// refreshes), so any number of TVs/phones costs the database ~6 queries a
// minute. The client falls back to calling Supabase directly if this fails.
import { isUuid, sendCached, sendError, supabaseConfig, UPSTREAM_TIMEOUT_MS } from './_cache.js';

export default async function handler(req, res) {
  const { event, category } = req.query;
  if (!isUuid(event) || !isUuid(category)) return sendError(res, 400, 'event and category must be UUIDs');
  const cfg = supabaseConfig();
  if (!cfg) return sendError(res, 500, 'Supabase is not configured');

  try {
    const upstream = await fetch(`${cfg.url}/rest/v1/rpc/preview_live_snapshot`, {
      method: 'POST',
      headers: { ...cfg.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_event_id: event, p_category_id: category }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!upstream.ok) return sendError(res, upstream.status === 404 ? 404 : 502, 'snapshot unavailable');
    sendCached(res, await upstream.json(), { maxAge: 10, staleWhileRevalidate: 20 });
  } catch {
    sendError(res, 502, 'snapshot unavailable');
  }
}
