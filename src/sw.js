import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkOnly, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { createHandlerBoundToURL } from 'workbox-precaching';

// injectManifest (not generateSW) so the Supabase-exclusion rule below is
// explicit, reviewable code rather than a declarative config array that
// could accidentally grow a catch-all rule later. Registered FIRST — Workbox
// matches routes in registration order — so nothing below can shadow it.
precacheAndRoute(self.__WB_MANIFEST);

// Drops the previous deploy's now-unreferenced precache entries once this
// worker activates — unrelated to the skip-waiting decision below (that's
// about WHEN a new worker takes over; this is just not leaving the old
// worker's cached JS/CSS sitting in storage forever afterward).
cleanupOutdatedCaches();

// NON-NEGOTIABLE: every Supabase request (REST/Auth/Storage/Functions/
// Realtime) bypasses the service worker entirely. All real offline data
// persistence happens in IndexedDB via application code (see
// src/lib/offlineDb.js) — this SW's only job is making the app shell itself
// loadable offline. Caching or intercepting a Supabase response here could
// silently serve a stale match result as if it were live.
registerRoute(({ url }) => url.hostname.endsWith('.supabase.co'), new NetworkOnly());

// SPA fallback: a hard reload on a deep route like /events/:id/matchlist
// still boots the app shell offline instead of hitting a browser error
// page, mirroring vercel.json's catch-all rewrite for online navigation —
// including its exceptions (the sitemap function, robots.txt, /api).
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/sitemap\.xml$/, /^\/robots\.txt$/, /^\/api\//],
  })
);

registerRoute(
  ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts' })
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/images/'),
  new CacheFirst({
    cacheName: 'app-images',
    // These were unbounded — a phone that visited a lot of different
    // events over time would keep every cover photo/sponsor logo it ever
    // saw. 60 entries / 30 days is plenty for "load instantly on repeat
    // visits" without growing forever on a low-end phone's limited storage.
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  })
);

// Update flow: a new SW install now waits (the browser's default) instead
// of self-activating. Unconditional skipWaiting() used to swap an
// already-open tab onto a new precache mid-session while its in-memory JS
// still referenced the previous build's hashed chunk filenames — any
// lazy-loaded route fetched after that 404'd, which is what showed up as an
// intermittent blank white screen. main.jsx prompts the visitor via
// onNeedRefresh and only then posts this message (workbox-window's
// messageSkipWaiting()) to activate the waiting worker on purpose.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', () => self.clients.claim());
