// Google Analytics 4 (account "DinkManager", property 556477475, web stream
// "DinkManager Website"). Only loads on the live production domain, so local
// dev and preview deploys never pollute the numbers. The Measurement ID is
// public by design (it's visible in any GA site's page source);
// VITE_GA_MEASUREMENT_ID can override it without a code change.
//
// Page views are sent manually on every in-app navigation (this is a
// single-page app), and GA's own "page changes based on browser history
// events" setting must be OFF in the GA data stream — otherwise GA would
// double-count, and would send raw URLs, including private event share
// tokens (/t/<token>), to Google.
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-RQGB28285H';
const PRODUCTION_HOSTS = ['dinkmanager.com', 'www.dinkmanager.com'];

let enabled = false;

export function initAnalytics() {
  if (enabled || !MEASUREMENT_ID || !import.meta.env.PROD || !PRODUCTION_HOSTS.includes(window.location.hostname)) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  // page_location is overridden with the sanitized URL before any event, so
  // auto-collected events (scrolls, clicks) never carry a raw token either.
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false, page_location: sanitizedLocation(window.location.pathname) });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(script);
  enabled = true;
}

// Private share tokens and database IDs never leave the browser; query
// strings and hashes (auth codes, reset links) are dropped entirely.
export function sanitizePath(pathname) {
  return pathname
    .replace(/^\/t\/[^/]+/, '/t/:token')
    .replace(/^\/events\/[^/]+\/preview\/[^/]+/, '/events/:id/preview/:category')
    .replace(/^\/events\/[^/]+/, '/events/:id')
    .replace(/^\/admin\/support-requests\/[^/]+/, '/admin/support-requests/:id');
}

function sanitizedLocation(pathname) {
  return `${window.location.origin}${sanitizePath(pathname)}`;
}

export function trackPageView(pathname) {
  if (!enabled) return;
  const path = sanitizePath(pathname);
  const pageContext = {
    page_path: path,
    page_location: sanitizedLocation(pathname),
    // A private event's name is as private as its link.
    page_title: path.startsWith('/t/') ? 'Private event' : document.title,
  };
  window.gtag('set', pageContext);
  window.gtag('event', 'page_view', pageContext);
}
