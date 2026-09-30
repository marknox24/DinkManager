// Vercel serverless function behind /e/:slug and /t/:token for link-preview
// crawlers only (see vercel.json's `has` header match on the request path —
// regular browsers still get the SPA via the catch-all rewrite).
//
// Crawlers (Facebook, WhatsApp, Slack, X, Messenger, Discord, etc.) don't
// execute JavaScript, so the per-event og:image that src/hooks/useSeo.js sets
// via document.head is invisible to them — they only ever see whatever meta
// tags are already in the raw HTML response. This function fetches the
// event's own name/cover photo/description directly from Supabase REST
// (same env vars + no-JS-client pattern as api/sitemap.js) and returns a
// minimal HTML document with the correct per-event meta tags baked in.
const SITE_URL = 'https://dinkmanager.com';
const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;
const FALLBACK_TITLE = 'Pickleball Tournament Software & Bracket Maker | DinkManager';
const FALLBACK_DESCRIPTION =
  'Run pickleball tournaments in one place — online registration, automatic brackets, match scheduling, live scores and results. Pay per event, no monthly fees.';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cityOf(address) {
  if (!address) return '';
  const parts = address.split(',').map((p) => p.trim());
  return parts.length > 1 ? parts[parts.length - 2] || parts[0] : parts[0];
}

function formatDateRange(start, end) {
  if (!start && !end) return '';
  const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (start && end && start !== end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt(start || end);
}

function truncate(text, max) {
  if (!text || text.length <= max) return text || '';
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

async function fetchEvent(column, value) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const cols = 'name,slug,description,cover_photo_path,location_address,start_date,end_date,is_published';
  const res = await fetch(
    `${url}/rest/v1/events?${column}=eq.${encodeURIComponent(value)}&is_published=eq.true&select=${cols}&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

function eventMediaUrl(path) {
  const url = process.env.VITE_SUPABASE_URL;
  if (!url || !path) return null;
  return `${url}/storage/v1/object/public/event-media/${path}`;
}

function renderHtml({ title, description, image, url, noindex }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    ${noindex ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${escapeHtml(url)}" />`}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="DinkManager" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
  </head>
  <body></body>
</html>
`;
}

export default async function handler(req, res) {
  const { slug, token } = req.query;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  let event = null;
  try {
    event = slug ? await fetchEvent('slug', slug) : token ? await fetchEvent('share_token', token) : null;
  } catch {
    // Fall through to the sitewide default below.
  }

  if (!event) {
    res.status(200).send(renderHtml({ title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION, image: FALLBACK_IMAGE, url: SITE_URL, noindex: !!token }));
    return;
  }

  const city = cityOf(event.location_address);
  const when = formatDateRange(event.start_date, event.end_date);
  const lead = ['Pickleball tournament', when && `on ${when}`, event.location_address && `at ${event.location_address}`].filter(Boolean).join(' ');
  const title = `${event.name} — Pickleball Tournament${city ? ` in ${city}` : ''} | DinkManager`;
  const description = truncate(`${lead}. ${event.description || 'View divisions, fees and prizes, and register online.'}`, 160);
  const image = (event.cover_photo_path && eventMediaUrl(event.cover_photo_path)) || FALLBACK_IMAGE;
  // Token links are private share links: give them their own real preview
  // (the link itself is already the credential) but keep them out of search
  // indexes, mirroring PublicEventPage.jsx's eventSeo() noindex choice.
  const url = token ? `${SITE_URL}/t/${token}` : `${SITE_URL}/e/${event.slug}`;

  res.status(200).send(renderHtml({ title, description, image, url, noindex: !!token }));
}
