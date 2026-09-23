import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkOnly, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { createHandlerBoundToURL } from 'workbox-precaching';

// injectManifest (not generateSW) so the Supabase-exclusion rule below is
// explicit, reviewable code rather than a declarative config array that
// could accidentally grow a catch-all rule later. Registered FIRST — Workbox
// matches routes in registration order — so nothing below can shadow it.
precacheAndRoute(self.__WB_MANIFEST);

// NON-NEGOTIABLE: every Supabase request (REST/Auth/Storage/Functions/
// Realtime) bypasses the service worker entirely. All real offline data
// persistence happens in IndexedDB via application code (see
// src/lib/offlineDb.js) — this SW's only job is making the app shell itself
// loadable offline. Caching or intercepting a Supabase response here could
// silently serve a stale match result as if it were live.
registerRoute(({ url }) => url.hostname.endsWith('.supabase.co'), new NetworkOnly());

// SPA fallback: a hard reload on a deep route like /events/:id/matchlist
// still boots the app shell offline instead of hitting a browser error
// page, mirroring vercel.json's catch-all rewrite for online navigation.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

registerRoute(
  ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts' })
);

registerRoute(({ url }) => url.pathname.startsWith('/images/'), new CacheFirst({ cacheName: 'app-images' }));

self.skipWaiting();
self.addEventListener('activate', () => self.clients.claim());
