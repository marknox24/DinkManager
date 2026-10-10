// CDN-cached "event bundle" for anonymous visitors. Every public page load
// used to send 3-4 separate select('*') queries to Supabase per visitor
// (event, categories, counts, sponsors, registration fields); this serves
// them as one response that Vercel's CDN shares between all visitors for 30s.
//
//   /api/public-event?slug=...  | ?token=...  | ?id=<uuid>
//   &include=counts,sponsors,fields   (optional; default = event + categories)
//
// Uses the anon key, so it returns exactly what an anonymous browser could
// already read. Any non-200 makes the client fall back to its direct queries
// (src/data/eventsApi.js loadPublicEventBundle), which keeps the old error
// behaviour (e.g. "not public" for a draft event).
import { isUuid, sendCached, sendError, supabaseConfig, UPSTREAM_TIMEOUT_MS } from './_cache.js';

const SAFE_KEY = /^[A-Za-z0-9_-]{1,128}$/;
const OPTIONAL = {
  counts: (id) => `public_category_counts?${new URLSearchParams({ select: '*', event_id: `eq.${id}` })}`,
  sponsors: (id) => `sponsors?${new URLSearchParams({ select: '*', event_id: `eq.${id}`, order: 'order_index.asc' })}`,
  fields: (id) => `registration_fields?${new URLSearchParams({ select: '*', event_id: `eq.${id}`, order: 'order_index.asc' })}`,
};

async function rest(cfg, path) {
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, { headers: cfg.headers, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  return res.json();
}

function eventPath({ slug, token, id }) {
  const params = new URLSearchParams({ select: '*', limit: '1' });
  if (slug) {
    params.set('slug', `eq.${slug}`);
    params.set('is_published', 'eq.true');
    params.set('visibility', 'eq.public');
  } else if (token) {
    params.set('share_token', `eq.${token}`);
    params.set('is_published', 'eq.true');
  } else {
    params.set('id', `eq.${id}`);
  }
  return `events?${params}`;
}

export default async function handler(req, res) {
  const { slug, token, id } = req.query;
  const keys = [slug, token, id].filter(Boolean);
  if (keys.length !== 1) return sendError(res, 400, 'pass exactly one of slug, token or id');
  if ((slug || token) && !SAFE_KEY.test(slug || token)) return sendError(res, 400, 'invalid slug or token');
  if (id && !isUuid(id)) return sendError(res, 400, 'id must be a UUID');
  const include = String(req.query.include || '')
    .split(',')
    .filter(Boolean);
  if (!include.every((k) => k in OPTIONAL)) return sendError(res, 400, 'unknown include');
  const cfg = supabaseConfig();
  if (!cfg) return sendError(res, 500, 'Supabase is not configured');

  try {
    const [event] = await rest(cfg, eventPath({ slug, token, id }));
    if (!event) return sendError(res, 404, 'event not found');

    const categoriesPath = `categories?${new URLSearchParams({ select: '*', event_id: `eq.${event.id}`, order: 'order_index.asc' })}`;
    const [categories, ...extras] = await Promise.all([rest(cfg, categoriesPath), ...include.map((k) => rest(cfg, OPTIONAL[k](event.id)))]);
    const body = { event, categories };
    include.forEach((k, i) => {
      body[k] = extras[i];
    });
    sendCached(res, body, { maxAge: 30, staleWhileRevalidate: 60 });
  } catch {
    sendError(res, 502, 'event unavailable');
  }
}
