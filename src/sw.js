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

// Page loads (navigations) go to the network first and only fall back to
// the precached app shell when offline or the network is too slow. Serving
// the precached index.html first was the cause of "the landing page
// sometimes doesn't load": after a deploy, a returning visitor got the
// previous build's index.html from this cache, which then asked Vercel for
// that build's lazy chunks (LandingPage-*.js isn't precached, see
// vite.config.js) — files the new deploy no longer has, so a 404 and the
// "Something went wrong" screen, again on every reload until all tabs were
// closed. The network copy always matches the chunks that exist.
// Pages are not cached separately: the fallback is always this worker's own
// precached shell, whose chunks are guaranteed to match. It still boots
// deep routes like /events/:id/matchlist offline, with vercel.json's
// catch-all exceptions (sitemap, robots.txt, /api).
const shellFallback = createHandlerBoundToURL('/index.html');
const navigationFromNetwork = new NetworkOnly({ networkTimeoutSeconds: 4 });
registerRoute(
  new NavigationRoute(
    async (options) => {
      try {
        const response = await navigationFromNetwork.handle(options);
        if (response?.ok) return response;
      } catch {
        // Offline or timed out with nothing cached yet: use the app shell.
      }
      return shellFallback(options);
    },
    { denylist: [/^\/sitemap\.xml$/, /^\/robots\.txt$/, /^\/api\//] }
  )
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

// Update flow: a new worker takes over as soon as it has installed. While
// it used to wait for every tab to close, a visitor stuck on an old build
// (see the navigation route above) stayed stuck: reloading never activated
// the waiting worker, so the old one kept serving the broken page. Taking
// over does NOT reload open tabs (main.jsx's registerSW only reloads after
// its own prompt), so nobody loses a half-filled form. An open tab that
// later lazy-loads a route from its old build gets a 404 for that chunk,
// and App.jsx's AppErrorBoundary reloads it onto the new build.
// SKIP_WAITING is still honoured for the sidebar's "Update now" and the
// update toast (appVersion.js, main.jsx), in case a worker is ever waiting.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', () => self.clients.claim());
