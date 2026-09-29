// Vercel serverless function behind /sitemap.xml (see vercel.json). Lists
// the static marketing pages plus every published public event, so each new
// tournament becomes discoverable by Google without anyone resubmitting.
// Uses the same public anon key + public_published_events() RPC the
// /tournaments page uses — already limited to public, non-cancelled events.
const SITE_URL = 'https://dinkmanager.com';

const STATIC_PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/tournaments', changefreq: 'daily', priority: '0.9' },
  { path: '/signup', changefreq: 'monthly', priority: '0.6' },
  { path: '/player/signup', changefreq: 'monthly', priority: '0.5' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.2' },
  { path: '/terms', changefreq: 'yearly', priority: '0.2' },
];

function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function fetchPublishedEvents() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const res = await fetch(`${url}/rest/v1/rpc/public_published_events`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) return [];
  return res.json();
}

export function buildSitemap(events) {
  const entries = [
    ...STATIC_PAGES.map((p) => ({ loc: `${SITE_URL}${p.path}`, changefreq: p.changefreq, priority: p.priority })),
    ...events
      .filter((e) => e.slug)
      .map((e) => ({
        loc: `${SITE_URL}/e/${encodeURIComponent(e.slug)}`,
        changefreq: e.status === 'finished' ? 'monthly' : 'daily',
        priority: e.status === 'finished' ? '0.4' : '0.8',
      })),
  ];
  const urls = entries
    .map((e) => `  <url>\n    <loc>${escapeXml(e.loc)}</loc>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export default async function handler(req, res) {
  let events = [];
  try {
    events = await fetchPublishedEvents();
  } catch {
    // Still serve the static pages if Supabase is unreachable.
  }
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(buildSitemap(Array.isArray(events) ? events : []));
}
